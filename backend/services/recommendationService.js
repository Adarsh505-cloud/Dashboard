// recommendationService.js
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

export class RecommendationService {
  constructor(accountId, roleArn, targetAccountId = null) {
    this.accountId = String(accountId).trim();
    this.roleArn = String(roleArn).trim();
    this.targetAccountId = targetAccountId ? String(targetAccountId).trim() : null;

    // Fixed region
    this.region = "us-east-1";

    // Dynamic bucket, DB, table, workgroup (strictly formatted)
    const rawBucket = `s3://cost-analyzer-results-${this.accountId}-${this.region}/`;
    this.athenaOutputLocation = rawBucket.toLowerCase();

    this.athenaDatabase = process.env.ATHENA_DATABASE || "aws_cost_analysis_db";
    this.athenaTable = process.env.ATHENA_RECOMMENDATIONS_TABLE || "cur_recomdations_v1";
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || "primary";
  }

  async getCredentials() {
    return fromTemporaryCredentials({
      params: {
        RoleArn: this.roleArn,
        RoleSessionName: `recommendations-${Date.now()}`,
        DurationSeconds: 3600,
      },
    })(); // <-- IMPORTANT: Added () to invoke the provider
  }

  async getAthenaClient() {
    const credentials = await this.getCredentials();
    return new AthenaClient({
      region: this.region,
      credentials,
    });
  }

  async getRecommendations() {
    try {
      console.log("🔍 Fetching recommendations from Athena...");
      console.log(
        `📊 Using WorkGroup: ${this.athenaWorkGroup}, Database: ${this.athenaDatabase}, Region: ${this.region}`
      );
      console.log(`✅ Evaluated Athena Output Location: ${this.athenaOutputLocation}`);

      const athenaClient = await this.getAthenaClient();

      // One row per recommendation_id: keep latest refresh only
      const query = `
        SELECT *
        FROM (
          SELECT
            *,
            ROW_NUMBER() OVER (
              PARTITION BY recommendation_id
              ORDER BY last_refresh_timestamp DESC
            ) AS rn
          FROM "${this.athenaDatabase}"."${this.athenaTable}"
          ${this.targetAccountId ? `WHERE account_id = '${this.targetAccountId}'` : ''} 
        )
        WHERE rn = 1
      `;

      const startQueryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
          Database: this.athenaDatabase,
        },
        WorkGroup: this.athenaWorkGroup,
        // <-- IMPORTANT: Added ResultConfiguration so Athena knows where to write
        ResultConfiguration: {
          OutputLocation: this.athenaOutputLocation,
        },
      });

      const { QueryExecutionId } = await athenaClient.send(
        startQueryExecutionCommand
      );

      let status = "QUEUED";
      while (status === "QUEUED" || status === "RUNNING") {
        const getQueryExecutionCommand = new GetQueryExecutionCommand({
          QueryExecutionId,
        });
        const { QueryExecution } = await athenaClient.send(
          getQueryExecutionCommand
        );
        status = QueryExecution?.Status?.State;
        if (status === "FAILED" || status === "CANCELLED") {
          throw new Error(
            `Athena query failed: ${QueryExecution?.Status?.StateChangeReason}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const getQueryResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId,
      });
      const { ResultSet } = await athenaClient.send(getQueryResultsCommand);

      if (!ResultSet || !ResultSet.Rows || ResultSet.Rows.length <= 1) {
        console.warn("⚠️ Athena returned no rows for recommendations.");
        return [];
      }

      const recommendations = this.parseAthenaResults(ResultSet);
      console.log(`✅ Fetched ${recommendations.length} recommendations`);
      return recommendations;
    } catch (error) {
      console.error("❌ Error fetching recommendations from Athena:", error);
      throw new Error(
        `Failed to fetch recommendations from Athena: ${
          error.message || error
        }`
      );
    }
  }

  // Parse Athena ResultSet (rows + metadata) into JS objects
  parseAthenaResults(resultSet) {
    const columnInfo = resultSet.ResultSetMetadata?.ColumnInfo || [];
    const rows = (resultSet.Rows || []).slice(1); // skip header

    return rows.map((row) => {
      const recommendation = {};
      (row.Data || []).forEach((datum, index) => {
        const columnName = columnInfo[index]?.Name;
        recommendation[columnName] =
          datum && typeof datum.VarCharValue !== "undefined"
            ? datum.VarCharValue
            : null;
      });
      return this.mapToRecommendationFormat(recommendation);
    });
  }

  // Map Athena row (new schema) to UI-friendly shape
  mapToRecommendationFormat(athenaRecord = {}) {
    const safeParseFloat = (value) => {
      if (value == null) return 0;
      if (typeof value === "number") return value;
      const cleaned = String(value).trim();
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // Safely check for 'after_discount' first. 
    // If it's null/blank, fallback to the standard 'estimated_monthly_savings'
    const rawSavings = 
      athenaRecord.estimated_monthly_savings_after_discount || 
      athenaRecord.estimated_monthly_savings || 
      athenaRecord.estimated_monthly_savings_before_discount; 

    const potentialSavings = safeParseFloat(rawSavings);

    // IMPORTANT: reuse existing UI field, map it to savings
    const estimatedCost = potentialSavings;

    // Build resource string from available fields
    const resourceParts = [];
    if (athenaRecord.current_resource_type)
      resourceParts.push(athenaRecord.current_resource_type);
    if (
      athenaRecord.recommended_resource_type &&
      athenaRecord.recommended_resource_type !==
        athenaRecord.current_resource_type
    ) {
      resourceParts.push(athenaRecord.recommended_resource_type);
    }
    if (athenaRecord.resource_arn) resourceParts.push(athenaRecord.resource_arn);
    if (athenaRecord.account_name)
      resourceParts.push(`(${athenaRecord.account_name})`);

    const resource =
      resourceParts.length > 0
        ? resourceParts.join(" · ")
        : athenaRecord.recommendation_id || "Recommendation";

    const lastActivityRaw = athenaRecord.last_refresh_timestamp || athenaRecord.date || null;

    // Dynamically assign severity based on implementation_effort
    let severity = "low";
    if (athenaRecord.implementation_effort) {
      severity = this.getSeverity(athenaRecord.implementation_effort);
    }

    const descriptionParts = [];
    if (athenaRecord.recommendation_source)
      descriptionParts.push(athenaRecord.recommendation_source);
    if (athenaRecord.region) descriptionParts.push(athenaRecord.region);
    const description =
      descriptionParts.length > 0 ? descriptionParts.join(" · ") : null;

    return {
      id: athenaRecord.recommendation_id || null,
      type: athenaRecord.action_type || null,
      severity,
      resource,
      description,
      // UI reads this and now it contains the savings value
      estimatedCost,
      // keep explicit savings field for future use
      potentialSavings,
      lastActivity: lastActivityRaw,
      action: athenaRecord.action_type || null,
      __raw: athenaRecord,
    };
  }

  getSeverity(implementationEffort) {
    switch (String(implementationEffort).toLowerCase()) {
      case "verylow":
      case "low":
        return "low";
      case "medium":
        return "medium";
      case "high":
      case "veryhigh":
        return "high";
      default:
        return "low";
    }
  }
}