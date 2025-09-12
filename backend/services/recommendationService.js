// recommendationService.js
import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
} from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

export class RecommendationService {
  constructor(accountId, roleArn) {
    this.accountId = accountId;
    this.roleArn = roleArn;
    this.region = process.env.AWS_REGION || "us-east-1";
    this.athenaDatabase = "aws_cost_analysis_db";
    this.athenaTable = "cur_recomdations_v1";
    this.athenaOutputLocation = `s3://athena-query-results-eutest/`; // FIXME: Add your S3 bucket for Athena results
  }

  async getCredentials() {
    return fromTemporaryCredentials({
      params: {
        RoleArn: this.roleArn,
        RoleSessionName: `recommendations-${Date.now()}`,
        DurationSeconds: 3600,
      },
    });
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
      const athenaClient = await this.getAthenaClient();

      const query = `SELECT * FROM "${this.athenaDatabase}"."${this.athenaTable}"`;

      const startQueryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
          Database: this.athenaDatabase,
        },
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
        // small delay before polling again
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
        `Failed to fetch recommendations from Athena: ${error.message || error}`
      );
    }
  }

  // Parse Athena ResultSet (rows + metadata) into JS objects
  parseAthenaResults(resultSet) {
    const columnInfo = resultSet.ResultSetMetadata?.ColumnInfo || [];
    // Rows include a header row at index 0; skip it
    const rows = (resultSet.Rows || []).slice(1);

    return rows.map((row) => {
      const recommendation = {};
      (row.Data || []).forEach((datum, index) => {
        const columnName = columnInfo[index]?.Name;
        // datum.VarCharValue may be undefined for NULL results
        recommendation[columnName] = datum && typeof datum.VarCharValue !== "undefined"
          ? datum.VarCharValue
          : null;
      });
      return this.mapToRecommendationFormat(recommendation);
    });
  }

  // Map Athena row to the shape expected by your React component
  mapToRecommendationFormat(athenaRecord = {}) {
    // helper to safely parse numbers (Athena returns strings often)
    const safeParseFloat = (value) => {
      if (value == null) return 0;
      if (typeof value === "number") return value;
      const cleaned = String(value).trim();
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // Use BEFORE discount savings first (your Athena data has values there),
    // otherwise fall back to after_discount.
    const savingsBefore = safeParseFloat(
      athenaRecord.estimated_monthly_savings_before_discount
    );
    const savingsAfter = safeParseFloat(
      athenaRecord.estimated_monthly_savings_after_discount
    );
    const potentialSavings = savingsBefore > 0 ? savingsBefore : savingsAfter;

    // cost (prefer before discount if present)
    const costBefore = safeParseFloat(
      athenaRecord.estimated_monthly_cost_before_discount
    );
    const costAfter = safeParseFloat(
      athenaRecord.estimated_monthly_cost_after_discount
    );
    const estimatedCost = costBefore > 0 ? costBefore : costAfter;

    // build a friendly resource/title string
    const resourceParts = [];
    if (athenaRecord.recommended_resource_summary) resourceParts.push(athenaRecord.recommended_resource_summary);
    if (athenaRecord.current_resource_summary && athenaRecord.current_resource_summary !== athenaRecord.recommended_resource_summary) resourceParts.push(athenaRecord.current_resource_summary);
    if (athenaRecord.current_resource_type) resourceParts.push(`(${athenaRecord.current_resource_type})`);
    const resource = resourceParts.length > 0 ? resourceParts.join(" · ") : (athenaRecord.resource_arn || athenaRecord.recommendation_id || "Recommendation");

    // last activity: use last_refresh_timestamp or date if available; keep raw string for client formatting
    const lastActivityRaw = athenaRecord.last_refresh_timestamp || athenaRecord.date || null;

    return {
      id: athenaRecord.recommendation_id || athenaRecord.recommendationId || null,
      type: athenaRecord.action_type || athenaRecord.actionType || null,
      severity: this.getSeverity(athenaRecord.implementation_effort),
      resource,
      description: athenaRecord.recommended_resource_details || athenaRecord.recommended_resource_summary || athenaRecord.current_resource_details || null,
      potentialSavings: potentialSavings, // numeric
      estimatedCost: estimatedCost, // numeric cost context
      lastActivity: lastActivityRaw, // string (client will format)
      action: athenaRecord.action_type || athenaRecord.action || null,
      // keep raw record for debugging if needed
      __raw: athenaRecord,
    };
  }

  getSeverity(implementationEffort) {
    switch (implementationEffort) {
      case "VeryLow":
      case "Low":
        return "low";
      case "Medium":
        return "medium";
      case "High":
      case "VeryHigh":
        return "high";
      default:
        return "low";
    }
  }
}
