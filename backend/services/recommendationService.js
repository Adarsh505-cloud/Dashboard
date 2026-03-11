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
    })();
  }

  async getAthenaClient() {
    const credentials = await this.getCredentials();
    return new AthenaClient({
      region: this.region,
      credentials,
    });
  }

  // ✅ FIX 4: Paginate through ALL Athena result pages (default max is 1000 rows)
  async getAllQueryResults(athenaClient, QueryExecutionId) {
    let nextToken = undefined;
    let allRows = [];
    let columnInfo = [];

    do {
      const command = new GetQueryResultsCommand({
        QueryExecutionId,
        ...(nextToken && { NextToken: nextToken }),
      });

      const { ResultSet } = await athenaClient.send(command);

      if (columnInfo.length === 0) {
        columnInfo = ResultSet?.ResultSetMetadata?.ColumnInfo || [];
        // Skip header row on first page only
        allRows = allRows.concat((ResultSet?.Rows || []).slice(1));
      } else {
        allRows = allRows.concat(ResultSet?.Rows || []);
      }

      nextToken = ResultSet?.NextToken;
    } while (nextToken);

    return {
      Rows: allRows,
      ResultSetMetadata: { ColumnInfo: columnInfo },
    };
  }

  async getRecommendations() {
    try {
      console.log("🔍 Fetching recommendations from Athena...");
      console.log(
        `📊 Using WorkGroup: ${this.athenaWorkGroup}, Database: ${this.athenaDatabase}, Region: ${this.region}`
      );
      console.log(`✅ Evaluated Athena Output Location: ${this.athenaOutputLocation}`);

      const athenaClient = await this.getAthenaClient();

      // ✅ FIX 1: Filter by latest date partition to avoid scanning all history
      // ✅ FIX 2: Use date_parse + regexp_replace for correct timestamp ordering
      //           (format is "Tue Feb 24 00:18:51 UTC 2026" — not ISO, needs custom parse)
      //           Tested and confirmed working in Athena console
      // ✅ FIX 5: SELECT * EXCEPT not supported in Athena — rn stripped in parseAthenaResults instead
      const query = `
        SELECT *
        FROM (
          SELECT
            *,
            ROW_NUMBER() OVER (
              PARTITION BY recommendation_id
              ORDER BY TRY(date_parse(
                regexp_replace(last_refresh_timestamp, ' UTC ', ' '),
                '%a %b %e %H:%i:%s %Y'
              )) DESC
            ) AS rn
          FROM "${this.athenaDatabase}"."${this.athenaTable}"
          WHERE date = (SELECT MAX(date) FROM "${this.athenaDatabase}"."${this.athenaTable}")
          ${this.targetAccountId ? `AND account_id = '${this.targetAccountId}'` : ""}
        )
        WHERE rn = 1
      `;

      const startQueryExecutionCommand = new StartQueryExecutionCommand({
        QueryString: query,
        QueryExecutionContext: {
          Database: this.athenaDatabase,
        },
        WorkGroup: this.athenaWorkGroup,
        ResultConfiguration: {
          OutputLocation: this.athenaOutputLocation,
        },
      });

      const { QueryExecutionId } = await athenaClient.send(startQueryExecutionCommand);

      // Poll until query completes
      let status = "QUEUED";
      while (status === "QUEUED" || status === "RUNNING") {
        const getQueryExecutionCommand = new GetQueryExecutionCommand({
          QueryExecutionId,
        });
        const { QueryExecution } = await athenaClient.send(getQueryExecutionCommand);
        status = QueryExecution?.Status?.State;

        if (status === "FAILED" || status === "CANCELLED") {
          throw new Error(
            `Athena query failed: ${QueryExecution?.Status?.StateChangeReason}`
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // ✅ FIX 4: Use paginated fetcher instead of single GetQueryResultsCommand
      const ResultSet = await this.getAllQueryResults(athenaClient, QueryExecutionId);

      if (!ResultSet || !ResultSet.Rows || ResultSet.Rows.length === 0) {
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
    // getAllQueryResults already strips the header row
    const rows = resultSet.Rows || [];

    return rows.map((row) => {
      const record = {};
      (row.Data || []).forEach((datum, index) => {
        const columnName = columnInfo[index]?.Name;
        if (columnName && columnName !== "rn") {           // ✅ FIX 5: drop rn column here
          record[columnName] =
            datum && typeof datum.VarCharValue !== "undefined"
              ? datum.VarCharValue
              : null;
        }
      });
      return this.mapToRecommendationFormat(record);
    });
  }

  // ✅ FIX 6: Parse raw Athena map string e.g. "{Project=ERP-PAY, Cost Centre=S4}"
  // Tags come back as a raw string like "{Key=Value, Key2=Value2}", not as JSON
  parseTagsString(rawTags) {
    if (!rawTags || rawTags.trim() === "" || rawTags.trim() === "{}") return {};
    try {
      const inner = rawTags.trim().replace(/^\{/, "").replace(/\}$/, "");
      if (!inner) return {};

      const result = {};
      // Split on ", " only where next segment contains "=" (avoids splitting values with commas)
      const pairs = inner.split(/,\s*(?=[^=]+=)/);
      pairs.forEach((pair) => {
        const eqIndex = pair.indexOf("=");
        if (eqIndex > -1) {
          const key = pair.substring(0, eqIndex).trim();
          const value = pair.substring(eqIndex + 1).trim();
          if (key) result[key] = value;
        }
      });
      return result;
    } catch {
      return {};
    }
  }

  // Map Athena row to UI-friendly shape
  mapToRecommendationFormat(athenaRecord = {}) {
    const safeParseFloat = (value) => {
      if (value == null) return 0;
      if (typeof value === "number") return value;
      const cleaned = String(value).trim();
      if (cleaned === "") return 0;
      const n = Number(cleaned);
      return Number.isFinite(n) ? n : 0;
    };

    // ✅ FIX 3: Removed non-existent 'estimated_monthly_savings' middle fallback
    const rawSavings =
      athenaRecord.estimated_monthly_savings_after_discount ||
      athenaRecord.estimated_monthly_savings_before_discount;

    const potentialSavings = safeParseFloat(rawSavings);
    const estimatedCost = potentialSavings;

    // ✅ FIX 7: account_name is empty in real data — fall back to account_id for labelling
    const accountLabel =
      athenaRecord.account_name?.trim() ||
      athenaRecord.account_id ||
      null;

    // Build resource string from available fields
    const resourceParts = [];
    if (athenaRecord.current_resource_type)
      resourceParts.push(athenaRecord.current_resource_type);
    if (
      athenaRecord.recommended_resource_type &&
      athenaRecord.recommended_resource_type !== athenaRecord.current_resource_type
    ) {
      resourceParts.push(`→ ${athenaRecord.recommended_resource_type}`);
    }
    if (athenaRecord.resource_arn)
      resourceParts.push(athenaRecord.resource_arn);
    if (accountLabel)
      resourceParts.push(`(${accountLabel})`);

    const resource =
      resourceParts.length > 0
        ? resourceParts.join(" · ")
        : athenaRecord.recommendation_id || "Recommendation";

    const lastActivityRaw =
      athenaRecord.last_refresh_timestamp || athenaRecord.date || null;

    // Severity based on implementation_effort
    let severity = "low";
    if (athenaRecord.implementation_effort) {
      severity = this.getSeverity(athenaRecord.implementation_effort);
    }

    const descriptionParts = [];
    if (athenaRecord.recommendation_source)
      descriptionParts.push(athenaRecord.recommendation_source);
    if (athenaRecord.region)
      descriptionParts.push(athenaRecord.region);
    const description =
      descriptionParts.length > 0 ? descriptionParts.join(" · ") : null;

    // ✅ FIX 6: Parse tags map string into a proper JS object
    const tags = this.parseTagsString(athenaRecord.tags);

    return {
      id: athenaRecord.recommendation_id || null,
      type: athenaRecord.action_type || null,
      severity,
      resource,
      description,
      // UI reads this — contains the savings value
      estimatedCost,
      // Explicit savings fields
      potentialSavings,
      estimatedMonthlyCostAfterDiscount:  safeParseFloat(athenaRecord.estimated_monthly_cost_after_discount),
      estimatedMonthlyCostBeforeDiscount: safeParseFloat(athenaRecord.estimated_monthly_cost_before_discount),
      estimatedSavingsPercentage:         safeParseFloat(athenaRecord.estimated_savings_percentage_after_discount),
      lastActivity: lastActivityRaw,
      action: athenaRecord.action_type || null,
      accountId: athenaRecord.account_id || null,
      accountName: accountLabel,
      region: athenaRecord.region || null,
      resourceArn: athenaRecord.resource_arn || null,
      currentResourceType: athenaRecord.current_resource_type || null,
      recommendedResourceType: athenaRecord.recommended_resource_type || null,
      currentResourceSummary: athenaRecord.current_resource_summary || null,
      recommendedResourceSummary: athenaRecord.recommended_resource_summary || null,
      implementationEffort: athenaRecord.implementation_effort || null,
      recommendationSource: athenaRecord.recommendation_source || null,
      lookbackPeriodDays: athenaRecord.recommendation_lookback_period_in_days
        ? Number(athenaRecord.recommendation_lookback_period_in_days)
        : null,
      // ✅ Booleans come back as strings from Athena — parse explicitly
      restartNeeded: athenaRecord.restart_needed === "true",
      rollbackPossible: athenaRecord.rollback_possible === "true",
      tags,
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