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
        status = QueryExecution.Status.State;
        if (status === "FAILED" || status === "CANCELLED") {
          throw new Error(
            `Athena query failed: ${QueryExecution.Status.StateChangeReason}`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const getQueryResultsCommand = new GetQueryResultsCommand({
        QueryExecutionId,
      });
      const { ResultSet } = await athenaClient.send(getQueryResultsCommand);

      const recommendations = this.parseAthenaResults(ResultSet);
      console.log(`✅ Fetched ${recommendations.length} recommendations`);
      return recommendations;
    } catch (error) {
      console.error("❌ Error fetching recommendations from Athena:", error);
      throw new Error(
        `Failed to fetch recommendations from Athena: ${error.message}`
      );
    }
  }

  parseAthenaResults(resultSet) {
    const rows = resultSet.Rows.slice(1); // Skip header row
    const columnInfo = resultSet.ResultSetMetadata.ColumnInfo;

    return rows.map((row) => {
      const recommendation = {};
      row.Data.forEach((datum, index) => {
        const columnName = columnInfo[index].Name;
        recommendation[columnName] = datum.VarCharValue;
      });
      return this.mapToRecommendationFormat(recommendation);
    });
  }

  mapToRecommendationFormat(athenaRecord) {
    return {
      id: athenaRecord.recommendation_id,
      type: athenaRecord.action_type,
      severity: this.getSeverity(athenaRecord.implementation_effort),
      resource: `${athenaRecord.current_resource_type} (${athenaRecord.current_resource_summary})`,
      description: athenaRecord.recommended_resource_summary,
      potentialSavings: parseFloat(
        athenaRecord.estimated_monthly_savings_after_discount
      ),
      lastActivity: new Date(
        athenaRecord.last_refresh_timestamp
      ).toLocaleDateString(),
      action: athenaRecord.action_type,
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