import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

export class CostService {
  constructor(accountId, roleArn) {
    this.accountId = accountId;
    this.roleArn = roleArn;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.athenaOutput = process.env.ATHENA_OUTPUT_S3;
    this.athenaDatabase = process.env.ATHENA_DATABASE || 'aws_cost_analysis_db';
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || undefined;
    this.bulkChunkSize = Number(process.env.BULK_CHUNK_SIZE || 200);

    if (!this.athenaOutput) {
      throw new Error('FATAL: ATHENA_OUTPUT_S3 environment variable is not set. Athena cannot run queries without an S3 bucket for results.');
    }

    this.serviceNameMap = {
      'AmazonEC2': 'EC2', 'AmazonVPC': 'VPC', 'AmazonRDS': 'RDS',
      'AmazonS3': 'S3', 'AWSGlue': 'Glue', 'awskms': 'KMS',
      'AWSSecretsManager': 'SecretsManager', 'AmazonRoute53': 'Route53',
      'AmazonCloudWatch': 'CloudWatch', 'AmazonAthena': 'Athena', 'AmazonECR': 'ECR',
    };
  }

  async getCredentials() {
    return fromTemporaryCredentials({
      params: {
        RoleArn: this.roleArn,
        RoleSessionName: `cost-analysis-heavy-${Date.now()}`,
        DurationSeconds: 3600,
      },
    })();
  }

  async getAthenaClient() {
    const credentials = await this.getCredentials();
    return new AthenaClient({ region: this.region, credentials });
  }

  async runAthenaQuery(sql, { database = this.athenaDatabase, workGroup = this.athenaWorkGroup, timeoutMs = 840000 } = {}) { // 14 minutes
    const client = await this.getAthenaClient();
    const startCmd = new StartQueryExecutionCommand({
      QueryString: sql,
      ResultConfiguration: { OutputLocation: this.athenaOutput },
      QueryExecutionContext: { Database: database },
      WorkGroup: workGroup,
    });
    const { QueryExecutionId } = await client.send(startCmd);
    if (!QueryExecutionId) throw new Error('Failed to start Athena query');

    const getExec = new GetQueryExecutionCommand({ QueryExecutionId });
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const execRes = await client.send(getExec);
      const state = execRes?.QueryExecution?.Status?.State;
      if (state === 'SUCCEEDED') {
        const rows = [];
        let headerRow = [];
        let nextToken;
        do {
          const resultsRes = await client.send(new GetQueryResultsCommand({ QueryExecutionId, NextToken: nextToken }));
          const { ResultSet, NextToken } = resultsRes;
          const rsRows = ResultSet?.Rows || [];
          if (rows.length === 0 && rsRows.length > 0) {
            headerRow = rsRows.shift().Data.map(d => d.VarCharValue.trim());
          }
          rsRows.forEach(row => {
            const obj = {};
            row.Data.forEach((d, i) => {
              if (headerRow[i]) {
                  obj[headerRow[i]] = d.VarCharValue || null;
              }
            });
            rows.push(obj);
          });
          nextToken = NextToken;
        } while (nextToken);
        return rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && /^-?\d+(\.\d+)?(E[-+]?\d+)?$/i.test(v) ? Number(v) : v])));
      }
      if (state === 'FAILED' || state === 'CANCELLED') {
        throw new Error(`Athena query ${QueryExecutionId} ${state}: ${execRes?.QueryExecution?.Status?.StateChangeReason}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error(`Athena query ${QueryExecutionId} timed out`);
  }
  
  getDateRange(months = 1) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(endDate.getMonth() - (months - 1));
    startDate.setDate(1);
    const formatDate = (d) => d.toISOString().split('T')[0];
    return { Start: formatDate(startDate), End: formatDate(endDate) };
  }
  
  async getResourcesForService(serviceName) {
    console.log(`[costService] Fetching resources for service: ${serviceName}`);
    const { Start, End } = this.getDateRange(1);
    const candidateCodes = new Set([serviceName]);
    for (const [code, friendly] of Object.entries(this.serviceNameMap)) {
        if (friendly.toLowerCase() === String(serviceName).toLowerCase()) {
            candidateCodes.add(code);
        }
    }
    const codesArr = Array.from(candidateCodes).map(c => `'${c.replace(/'/g, "''")}'`).join(',');
    
    const sql = `
      SELECT
          line_item_resource_id, 
          COALESCE(line_item_product_code, 'Unknown') AS product_code, 
          product_location,
          SUM(COALESCE(amortized_cost, line_item_unblended_cost, 0)) AS total_cost, 
          resource_tags
      FROM ${this.athenaDatabase}.cur_daily_v1
      WHERE date(line_item_usage_start_date) BETWEEN DATE '${Start}' AND DATE '${End}'
        AND line_item_resource_id IS NOT NULL 
        AND COALESCE(line_item_product_code, 'Unknown') IN (${codesArr})
      GROUP BY 1, 2, 3, 5 
      ORDER BY 4 DESC;
    `;
    
    const rows = await this.runAthenaQuery(sql);

    // This is a simplified mapping. You would add your CloudTrail enrichment logic here if needed.
    return rows.map(r => {
      const tags = [];
      try {
        if (r.resource_tags) {
            const parsedTags = JSON.parse(r.resource_tags.replace(/=/g, '":"').replace(/, /g, '","').replace(/{/g, '{"').replace(/}/g, '"}'));
            for(const key in parsedTags) {
                tags.push({ key, value: parsedTags[key] });
            }
        }
      } catch (e) {
        // ignore tag parsing errors
      }

      return {
          id: r.line_item_resource_id,
          name: r.line_item_resource_id,
          type: this.serviceNameMap[r.product_code] || r.product_code,
          region: r.product_location || 'unknown',
          owner: tags.find(t => t.key === 'user_owner')?.value || 'Unknown',
          project: tags.find(t => t.key === 'user_project')?.value || 'Unassigned',
          createdDate: null, // Placeholder for enrichment
          createdBy: null,   // Placeholder for enrichment
          status: 'running', // Placeholder
          deletionDate: null,// Placeholder for enrichment
          deletedBy: null,   // Placeholder for enrichment
          cost: Number(r.total_cost || 0),
          tags,
          specifications: {},
      };
    });
  }
}