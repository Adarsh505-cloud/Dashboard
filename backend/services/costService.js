// backend/services/costService.js
// Full file implementing bulk CloudTrail enrichment using chunked VALUES(...) queries.
// No infra/staging required. Tune chunk size with env var BULK_CHUNK_SIZE.

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { ResourceGroupsTaggingAPIClient } from "@aws-sdk/client-resource-groups-tagging-api";
import { EC2Client } from '@aws-sdk/client-ec2';
import { RDSClient } from '@aws-sdk/client-rds';
import { S3Client } from '@aws-sdk/client-s3';
import { EKSClient } from '@aws-sdk/client-eks';
import { WorkSpacesClient } from '@aws-sdk/client-workspaces';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { KMSClient } from '@aws-sdk/client-kms';
import { ConfigServiceClient } from '@aws-sdk/client-config-service';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ECRClient } from '@aws-sdk/client-ecr';
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { LocationClient } from '@aws-sdk/client-location';
import { EFSClient } from '@aws-sdk/client-efs';
import { BackupClient } from '@aws-sdk/client-backup';
import { SQSClient } from '@aws-sdk/client-sqs';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { StorageGatewayClient } from '@aws-sdk/client-storage-gateway';

export class CostService {
  constructor(accountId, roleArn) {
    this.accountId = accountId;
    this.roleArn = roleArn;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.athenaOutput = process.env.ATHENA_OUTPUT_S3; // required (e.g. s3://bucket/path/)
    this.athenaDatabase = process.env.ATHENA_DATABASE || 'aws_cost_analysis_db';
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || undefined;

    // bulk chunking config
    this.bulkChunkSize = Number(process.env.BULK_CHUNK_SIZE || 200); // safe default

    if (!this.athenaOutput) {
      console.warn('⚠️ ATHENA_OUTPUT_S3 not set. Athena StartQueryExecution will likely fail without an output location.');
    }

    // Map product codes (as seen in CUR) to friendly names used by the dashboard
    this.serviceNameMap = {
      'AmazonEC2': 'EC2',
      'AmazonVPC': 'VPC',
      'AmazonRDS': 'RDS',
      'AmazonS3': 'S3',
      'AWSGlue': 'Glue',
      'awskms': 'KMS',
      'AWSSecretsManager': 'SecretsManager',
      'AmazonRoute53': 'Route53',
      'AmazonCloudWatch': 'CloudWatch',
      'AmazonAthena': 'Athena',
      'AmazonECR': 'ECR',
      // add more as required
    };
  }

  // ---------- Credential & clients ----------
  async getCredentials() {
    return fromTemporaryCredentials({
      params: {
        RoleArn: this.roleArn,
        RoleSessionName: `cost-analysis-${Date.now()}`,
        DurationSeconds: 3600,
      },
    })();
  }

  async getAthenaClient() {
    const credentials = await this.getCredentials();
    return new AthenaClient({ region: this.region, credentials });
  }

  async getResourceGroupsClient() {
    const credentials = await this.getCredentials();
    return new ResourceGroupsTaggingAPIClient({ region: this.region, credentials });
  }

  async getEc2Client() {
    const credentials = await this.getCredentials();
    return new EC2Client({ region: this.region, credentials });
  }

  // (other AWS service clients factory methods could be added here if you call them elsewhere)

  // ---------- Athena helper (robust) ----------
  // Runs an Athena query, polls until completion, and returns rows as array of objects.
  // Also logs/returns query statistics if available.
  async runAthenaQuery(sql, { database = this.athenaDatabase, workGroup = this.athenaWorkGroup, timeoutMs = 120_000 } = {}) {
    const client = await this.getAthenaClient();
    if (!this.athenaOutput) throw new Error('ATHENA_OUTPUT_S3 environment variable is required (e.g. s3://bucket/path/)');

    const startCmd = new StartQueryExecutionCommand({
      QueryString: sql,
      ResultConfiguration: { OutputLocation: this.athenaOutput },
      QueryExecutionContext: { Database: database },
      WorkGroup: workGroup,
    });

    const startRes = await client.send(startCmd);
    const qid = startRes.QueryExecutionId;
    if (!qid) throw new Error('Failed to start Athena query');

    // poll for completion
    const getExec = new GetQueryExecutionCommand({ QueryExecutionId: qid });
    let state;
    const maxMs = timeoutMs;
    const intervalMs = 1000;
    const startTs = Date.now();
    let execRes;
    while (true) {
      execRes = await client.send(getExec);
      state = execRes?.QueryExecution?.Status?.State;
      if (state === 'SUCCEEDED') break;
      if (state === 'FAILED' || state === 'CANCELLED') {
        const reason = execRes?.QueryExecution?.Status?.StateChangeReason || 'unknown';
        throw new Error(`Athena query ${qid} ${state}: ${reason}`);
      }
      if (Date.now() - startTs > maxMs) {
        throw new Error(`Athena query ${qid} timed out after ${maxMs}ms (state=${state})`);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    // fetch results (handle pagination)
    const rows = [];
    let nextToken = undefined;
    do {
      const resultsCmd = new GetQueryResultsCommand({ QueryExecutionId: qid, NextToken: nextToken });
      const resultsRes = await client.send(resultsCmd);
      const resultSet = resultsRes.ResultSet;
      const rsRows = resultSet?.Rows || [];
      // First result row contains column names (header) on first page.
      if (!rows.length && rsRows.length > 0) {
        // On Athena, first row is header. Convert to column names:
        const headerRow = rsRows[0].Data.map(d => (d.VarCharValue || '').trim());
        // For the rest of rows map fields by header.
        for (let i = 1; i < rsRows.length; i++) {
          const dataRow = rsRows[i].Data.map(d => (d.VarCharValue || null));
          const obj = {};
          for (let c = 0; c < headerRow.length; c++) obj[headerRow[c]] = dataRow[c] === null ? null : dataRow[c];
          rows.push(obj);
        }
      } else if (rsRows.length > 0) {
        const header = Object.keys(rows[0] || {});
        if (!header.length) {
          for (let i = 0; i < rsRows.length; i++) {
            const dataRow = rsRows[i].Data.map(d => (d.VarCharValue || null));
            const obj = {};
            for (let c = 0; c < dataRow.length; c++) obj[`col${c}`] = dataRow[c];
            rows.push(obj);
          }
        } else {
          for (let i = 0; i < rsRows.length; i++) {
            const dataRow = rsRows[i].Data.map(d => (d.VarCharValue || null));
            const obj = {};
            for (let c = 0; c < header.length; c++) obj[header[c]] = dataRow[c] === null ? null : dataRow[c];
            rows.push(obj);
          }
        }
      }
      nextToken = resultsRes.NextToken;
    } while (nextToken);

    // Parse numeric-looking fields, including scientific notation.
    const convertedRows = rows.map(r => {
      const converted = {};
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (v === null) { converted[k] = null; continue; }
        if (/^-?\d+(\.\d+)?(E[-+]?\d+)?$/i.test(v)) {
          converted[k] = Number(v);
        } else {
          converted[k] = v;
        }
      }
      return converted;
    });

    // Try to get statistics (DataScannedInBytes) if present
    const stats = execRes?.QueryExecution?.Statistics || null;
    if (stats) {
      const scanned = stats?.DataScannedInBytes ?? null;
      const engineTime = stats?.EngineExecutionTimeInMillis ?? null;
      console.info(`Athena query ${qid} completed; scannedBytes=${scanned}, engineMs=${engineTime}`);
    }

    return convertedRows;
  }

  // ---------- date helpers ----------
  // returns { Start: 'YYYY-MM-DD', End: 'YYYY-MM-DD' }
  getDateRange(months = 1) {
    const endDate = new Date();
    const startDate = new Date();
    if (months === 1) startDate.setDate(1);
    else {
      startDate.setMonth(startDate.getMonth() - months);
      startDate.setDate(1);
    }

    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    return { Start: formatDate(startDate), End: formatDate(endDate) };
  }

  // ---------- COST ANALYSIS FUNCTIONS (Athena-based) ----------
  async getDailyCostData() {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          COALESCE(line_item_product_code, 'Unknown') AS service,
          SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS total_cost_usd
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}'
          AND date(line_item_usage_start_date) <= DATE '${endStr}'
        GROUP BY 1, 2
        ORDER BY day ASC, total_cost_usd DESC;
      `;

      const rows = await this.runAthenaQuery(sql);

      const dayMap = {};
      rows.forEach(r => {
        const day = r.day;
        const originalService = r.service;
        const mappedService = this.serviceNameMap[originalService] || originalService; // Map product code -> friendly name
        const cost = Number(r.total_cost_usd || 0);

        if (!dayMap[day]) dayMap[day] = {};
        if (!dayMap[day][mappedService]) dayMap[day][mappedService] = 0;
        dayMap[day][mappedService] += cost;
      });

      // Convert the data to the final format for the frontend
      const dailyData = Object.keys(dayMap).sort().map(day => {
        const groups = Object.keys(dayMap[day]).map(service => ({
          Keys: [service],
          Metrics: { BlendedCost: { Amount: dayMap[day][service].toFixed(4) } }
        }));
        return {
          TimePeriod: { Start: day, End: day },
          Groups: groups
        };
      });

      return dailyData;
    } catch (err) {
      console.error('❌ getDailyCostData failed:', err.message || err);
      throw err;
    }
  }

  async getWeeklyCostData() {
    try {
      const daily = await this.getDailyCostData();
      const chunks = [];
      for (let i = 0; i < daily.length; i += 7) {
        const week = daily.slice(i, i + 7);
        if (week.length === 0) continue;
        const svcSums = {};
        week.forEach(day => {
          day.Groups?.forEach(g => {
            const service = g.Keys?.[0] || 'Unknown';
            const amt = parseFloat(g.Metrics?.BlendedCost?.Amount || '0');
            svcSums[service] = (svcSums[service] || 0) + amt;
          });
        });

        const groups = Object.entries(svcSums).map(([svc, cost]) => ({
          Keys: [svc],
          Metrics: { BlendedCost: { Amount: cost.toString() } }
        }));

        const start = week[0].TimePeriod.Start;
        const end = week[week.length - 1].TimePeriod.End;
        chunks.push({ TimePeriod: { Start: start, End: end }, Groups: groups });
      }
      return chunks;
    } catch (err) {
      console.error('❌ getWeeklyCostData failed:', err);
      throw err;
    }
  }

  async getCostTrendData() {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          SUM(CAST(ROUND(COALESCE(amortized_cost, line_item_unblended_cost, 0) * 100, 0) AS BIGINT)) AS cost_cents
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}'
          AND date(line_item_usage_start_date) <= DATE '${endStr}'
        GROUP BY 1
        ORDER BY 1 ASC;
      `;

      console.log('getCostTrendData SQL:\n', sql);
      const rows = await this.runAthenaQuery(sql);

      return rows.map(r => ({
        date: r.day,
        cost: Number((Number(r.cost_cents || 0) / 100).toFixed(2))
      }));
    } catch (err) {
      console.error('❌ getCostTrendData failed:', err.message || err);
      throw err;
    }
  }

  async getTotalMonthlyCost() {
    try {
      const { Start, End } = this.getDateRange(1); // current month from 1st to today
      const sql = `
        SELECT SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS total_cost
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}';
      `;
      const rows = await this.runAthenaQuery(sql);
      const cost = (rows[0] && rows[0].total_cost) ? Number(rows[0].total_cost) : 0;
      return Number(cost.toFixed(2));
    } catch (err) {
      console.error('❌ getTotalMonthlyCost failed:', err);
      throw err;
    }
  }

  async getServiceCosts() {
    try {
      const { Start, End } = this.getDateRange(1);
      const sql = `
        SELECT COALESCE(line_item_product_code, 'Unknown') AS service,
               product_location AS region,
               SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS total_cost
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
        GROUP BY COALESCE(line_item_product_code, 'Unknown'), product_location
        ORDER BY total_cost DESC
        LIMIT 500;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows
        .map(r => ({ service: this.serviceNameMap[r.service] || r.service || 'Unknown', region: r.region || 'NoRegion', cost: Number(r.total_cost || 0) }))
        .filter(x => x.cost > 0)
        .sort((a,b) => b.cost - a.cost);
    } catch (err) {
      console.error('❌ getServiceCosts failed:', err);
      throw err;
    }
  }

  async getRegionCosts() {
    try {
      const { Start, End } = this.getDateRange(1);
      const sql = `
        SELECT
          CASE
            WHEN product_location IS NULL OR trim(product_location) = '' THEN 'Global'
            WHEN lower(product_location) IN ('any','(any)','unknown') THEN 'Global'
            ELSE product_location
          END AS region,
          SUM(COALESCE(amortized_cost, line_item_unblended_cost, 0)) AS total_cost
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
        GROUP BY 1
        ORDER BY total_cost DESC;
      `;
  
      const rows = await this.runAthenaQuery(sql);
      return rows
        .map(r => ({ region: r.region || 'Global', cost: Number(r.total_cost || 0) }))
        .filter(x => x.cost > 0);
    } catch (err) {
      console.error('❌ getRegionCosts failed:', err);
      throw err;
    }
  }

  async getUserCosts({ billingPeriod = null, fullMonth = false } = {}) {
    try {
      let Start, End;
      if (billingPeriod) {
        const [y, m] = billingPeriod.split('-').map(x => parseInt(x, 10));
        const startDate = new Date(y, m - 1, 1);
        const nextMonth = new Date(y, m, 1);
        nextMonth.setDate(0); // last day of month
        Start = startDate.toISOString().split('T')[0];
        End = nextMonth.toISOString().split('T')[0];
      } else {
        ({ Start, End } = this.getDateRange(1, { fullMonth }));
      }
      
      const sql = `
        WITH owner_sums AS (
          -- cost summed per resource + explicit owner (only rows that have an explicit owner)
          SELECT
            COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id) AS resource_id,
            COALESCE(NULLIF(TRIM(resource_tags['user_owner']), '')) AS explicit_owner,
            SUM(COALESCE(amortized_cost, line_item_unblended_cost, 0)) AS owner_cost,
            COUNT(*) AS owner_rows
          FROM ${this.athenaDatabase}.cur_daily_v1
          WHERE date(line_item_usage_start_date) BETWEEN DATE '${Start}' AND DATE '${End}'
            AND (amortized_cost IS NOT NULL OR line_item_unblended_cost IS NOT NULL)
            AND COALESCE(NULLIF(TRIM(resource_tags['user_owner']), '')) IS NOT NULL
          GROUP BY
            COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id),
            COALESCE(NULLIF(TRIM(resource_tags['user_owner']), ''))
        ),
        owner_ranked AS (
          -- choose the top owner per resource by cost (if multiple explicit owners seen for same resource)
          SELECT
            resource_id,
            explicit_owner,
            owner_cost,
            owner_rows,
            row_number() OVER (PARTITION BY resource_id ORDER BY owner_cost DESC, owner_rows DESC) AS rn
          FROM owner_sums
        ),
        owner_lookup AS (
          -- the inferred owner per resource (the explicit owner with highest cost)
          SELECT resource_id, explicit_owner AS inferred_owner
          FROM owner_ranked
          WHERE rn = 1
        ),
        resolved_rows AS (
          -- every row in the date window, annotated with explicit_owner, inferred_owner, and resolved_owner
          SELECT
            COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) AS resource_id,
            COALESCE(NULLIF(TRIM(t.resource_tags['user_owner']), '')) AS explicit_owner,
            l.inferred_owner,
            COALESCE(NULLIF(TRIM(t.resource_tags['user_owner']), ''), l.inferred_owner) AS resolved_owner,
            COALESCE(t.amortized_cost, t.line_item_unblended_cost, 0) AS usd_cost
          FROM ${this.athenaDatabase}.cur_daily_v1 t
          LEFT JOIN owner_lookup l
            ON COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) = l.resource_id
          WHERE date(t.line_item_usage_start_date) BETWEEN DATE '${Start}' AND DATE '${End}'
            AND (t.amortized_cost IS NOT NULL OR t.line_item_unblended_cost IS NOT NULL)
        )
        SELECT
          resolved_owner AS user_owner,
          -- CSV of distinct resource ids (may be long) - useful for quick display / export
          array_join(array_agg(DISTINCT resource_id), ',') AS resources_csv,
          -- an actual array of distinct resource ids (if your client can handle arrays)
          array_agg(DISTINCT resource_id) AS resources_array,
          COUNT(DISTINCT resource_id) AS resource_count,
          SUM(usd_cost) AS total_usd,
          SUM(CAST(ROUND(usd_cost * 100, 0) AS BIGINT)) AS total_cents,
          COUNT(*) AS rows_count
        FROM resolved_rows
        WHERE resolved_owner IS NOT NULL
        GROUP BY resolved_owner
        ORDER BY total_cents DESC
        LIMIT 500;
      `;
      
      console.log('getUserCosts SQL:\n', sql);
      const rows = await this.runAthenaQuery(sql);
      console.log('getUserCosts - sample rows:', rows.slice(0, 8));
      
      return rows.map(r => ({
        user: r.user_owner,
        cost: Number(r.total_usd || 0),
        cost_cents: Number(r.total_cents || 0),
        resources: Number(r.resource_count || 0),
        resourcesList: r.resources_array || [] // Add this line to include resources list
      }));
    } catch (err) {
      console.error('❌ getUserCosts failed:', err);
      return [];
    }
  }
  

  async getResourceCosts() {
    try {
      console.log('🔍 Fetching daily resource cost data from Athena...');
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT
          COALESCE(line_item_product_code, 'Unknown') AS service,
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS daily_cost,
          COUNT(DISTINCT line_item_resource_id) AS resource_count
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE
          date(line_item_usage_start_date) >= DATE '${startStr}' AND
          date(line_item_usage_start_date) <= DATE '${endStr}' AND
          line_item_resource_id IS NOT NULL AND
          COALESCE(line_item_product_code, '') <> ''
        GROUP BY
          COALESCE(line_item_product_code, 'Unknown'),
          date_format(line_item_usage_start_date, '%Y-%m-%d')
        ORDER BY
          service, day;
      `;

      const rows = await this.runAthenaQuery(sql);

      const serviceMap = {};
      const uniqueDays = [...new Set(rows.map(r => r.day))].sort();

      rows.forEach(r => {
        const s = this.serviceNameMap[r.service] || r.service || 'Unknown';
        if (!serviceMap[s]) {
          serviceMap[s] = {
            type: s,
            dailyTrend: uniqueDays.map(() => 0),
            cost: 0,
            count: 0
          };
        }

        const dayIndex = uniqueDays.indexOf(r.day);
        const dollars = Number(r.daily_cost || 0);
        serviceMap[s].dailyTrend[dayIndex] = dollars;
        serviceMap[s].cost += dollars;
        serviceMap[s].count += Number(r.resource_count || 0);
      });

      const results = Object.values(serviceMap).map(item => ({
        ...item,
        trend: item.dailyTrend
      }));

      return results.sort((a, b) => b.cost - a.cost).slice(0, 10);
    } catch (err) {
      console.error('❌ getResourceCosts failed:', err);
      throw err;
    }
  }

  async getProjectCosts({ billingPeriod = null, fullMonth = false } = {}) {
    try {
      let Start, End;
      if (billingPeriod) {
        const [y, m] = billingPeriod.split('-').map(x => parseInt(x, 10));
        const startDate = new Date(y, m - 1, 1);
        const nextMonth = new Date(y, m, 1);
        nextMonth.setDate(0); // last day of month
        Start = startDate.toISOString().split('T')[0];
        End = nextMonth.toISOString().split('T')[0];
      } else {
        ({ Start, End } = this.getDateRange(1, { fullMonth }));
      }
  
      const sql = `
      WITH project_sums AS (
        -- per-resource sums for rows that explicitly have a user_project
        SELECT
          COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id) AS resource_id,
          NULLIF(TRIM(resource_tags['user_project']), '') AS user_project,
          SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS project_cost,
          COUNT(*) AS project_rows
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
          AND (amortized_cost IS NOT NULL OR line_item_unblended_cost IS NOT NULL)
          AND NULLIF(TRIM(resource_tags['user_project']), '') IS NOT NULL
        GROUP BY
          COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id),
          NULLIF(TRIM(resource_tags['user_project']), '')
      ),
      
      project_ranked AS (
        -- pick the dominant project per resource (by cost, then by rows)
        SELECT
          resource_id,
          user_project,
          project_cost,
          project_rows,
          ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY project_cost DESC, project_rows DESC) AS rn
        FROM project_sums
      ),
      
      project_lookup AS (
        -- one dominant project per resource (if present)
        SELECT resource_id, user_project AS inferred_project
        FROM project_ranked
        WHERE rn = 1
      ),
      
      resolved AS (
        -- attach inferred project to every row; explicit wins (COALESCE chooses explicit if present)
        SELECT
          COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) AS resource_id,
          NULLIF(TRIM(t.resource_tags['user_project']), '') AS explicit_project,
          l.inferred_project,
          COALESCE(NULLIF(TRIM(t.resource_tags['user_project']), ''), l.inferred_project) AS resolved_project,
          COALESCE(t.amortized_cost, t.line_item_unblended_cost, 0) AS usd_cost
        FROM ${this.athenaDatabase}.cur_daily_v1 t
        LEFT JOIN project_lookup l
          ON COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) = l.resource_id
        WHERE date(t.line_item_usage_start_date) >= DATE '${Start}'
          AND date(t.line_item_usage_start_date) <= DATE '${End}'
          AND (t.amortized_cost IS NOT NULL OR t.line_item_unblended_cost IS NOT NULL)
      )
      
      SELECT
        COALESCE(resolved_project, '<UNMAPPED>') AS project_tag,
        SUM(usd_cost) AS total_usd,
        SUM(CAST(ROUND(usd_cost * 100, 0) AS BIGINT)) AS total_cents,
        COUNT(DISTINCT resource_id) AS resource_count,
        COUNT(*) AS rows
      FROM resolved
      GROUP BY COALESCE(resolved_project, '<UNMAPPED>')
      ORDER BY total_cents DESC
      LIMIT 500;
          `;
      
          console.log('getProjectCosts SQL:\\n', sql);
          const rows = await this.runAthenaQuery(sql);
          console.log('getProjectCosts - sample rows:', rows.slice(0, 8));
      
          return rows.map(r => ({
            project: r.project_tag,
            cost: Number(r.total_usd || 0),
            cost_cents: Number(r.total_cents || 0),
            resources: Number(r.resource_count || 0)
          }));
        } catch (err) {
          console.error('❌ getProjectCosts failed:', err);
          return [];
        }
      }

  estimateResourcesCost(resources) {
    let totalCost = 0;
    resources.forEach(resource => {
      const resourceType = resource.ResourceARN?.split(':')[2];
      const resourceSubType = resource.ResourceARN?.split(':')[5]?.split('/')[0];
      switch (resourceType) {
        case 'ec2':
          if (resourceSubType === 'instance') totalCost += Math.random() * 100 + 50;
          else if (resourceSubType === 'volume') totalCost += Math.random() * 30 + 10;
          break;
        case 'rds': totalCost += Math.random() * 200 + 100; break;
        case 's3': totalCost += Math.random() * 50 + 10; break;
        case 'lambda': totalCost += Math.random() * 20 + 5; break;
        case 'elasticloadbalancing': totalCost += Math.random() * 40 + 20; break;
        default: totalCost += Math.random() * 30 + 10;
      }
    });

    return Math.round(totalCost);
  }

  // ----------------------------
  // small util: split array into chunks
  // ----------------------------
  chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  // ----------------------------
  // Bulk helpers (VALUES chunking)
  // ----------------------------
  // build a VALUES(...) table string safely for Athena SQL
  safeValuesForIds(ids) {
    // escape single quotes in IDs
    return ids.map(id => `('${String(id).replace(/'/g, "''")}')`).join(',\n');
  }

  // Query CloudTrail once per chunk to find earliest creation events for the provided resource ids
  // Returns: Map { id -> { createdDate, createdBy } }
  async getCreationEventsForResources(resourceIds = [], { startDate, endDate } = {}) {
    if (!resourceIds || resourceIds.length === 0) return new Map();
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    const resultsMap = new Map();

    // safety: use date window default to last 30 days if not provided
    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30);
    const Start = startDate || defaultStart.toISOString().split('T')[0];
    const End = endDate || now.toISOString().split('T')[0];

    for (const chunk of chunks) {
      // build VALUES table
      const valuesSql = this.safeValuesForIds(chunk);
      const sql = `
        WITH target_ids(id) AS (
          VALUES
            ${valuesSql}
        ),
        ct AS (
          SELECT
            -- Normalize eventtime to a proper TIMESTAMP no matter the source type/format
            CASE
              WHEN regexp_like(cast(eventtime AS varchar), '^\\d{4}-\\d{2}-\\d{2}T') THEN from_iso8601_timestamp(cast(eventtime AS varchar))
              ELSE cast(eventtime AS timestamp)
            END AS eventtime_parsed,
            eventname,
            requestparameters,
            responseelements,
            sourceipaddress,
            useridentity,
            resources
          FROM ${this.athenaDatabase}.cloudtrail_logs_titans
          WHERE
            -- conservative string-based partition prune: we still try to avoid scanning everything by date range,
            -- but use the raw eventtime string to prune where possible (this will not fail even if eventtime is timestamp)
            ( (try(cast(eventtime AS date)) BETWEEN DATE '${Start}' AND DATE '${End}')
              OR (regexp_like(cast(eventtime AS varchar), '^\\d{4}-\\d{2}-\\d{2}T') AND date(from_iso8601_timestamp(cast(eventtime AS varchar))) BETWEEN DATE '${Start}' AND DATE '${End}')
            )
        )
        SELECT
          t.id AS target_id,
          MIN(CASE WHEN lower(ct.eventname) LIKE '%create%' OR lower(ct.eventname) LIKE '%run%' OR lower(ct.eventname) LIKE '%launch%' OR lower(ct.eventname) LIKE '%start%' THEN ct.eventtime_parsed END) AS first_create,
          any_value(ct.useridentity.arn) FILTER (WHERE lower(ct.eventname) LIKE '%create%') AS sample_creator,
          any_value(ct.sourceipaddress) FILTER (WHERE lower(ct.eventname) LIKE '%create%') AS sample_creator_ip
        FROM ct
        CROSS JOIN target_ids t
        LEFT JOIN UNNEST(ct.resources) AS u(res) ON TRUE
        WHERE
          lower(ct.requestparameters) LIKE concat('%', lower(t.id), '%')
          OR lower(ct.responseelements) LIKE concat('%', lower(t.id), '%')
          OR lower(coalesce(u.res.arn, '')) LIKE concat('%', lower(t.id), '%')
        GROUP BY t.id;
      `;

      try {
        const rows = await this.runAthenaQuery(sql);
        rows.forEach(r => {
          if (!r || !r.target_id) return;
          resultsMap.set(String(r.target_id), {
            createdDate: r.first_create || null,
            createdBy: r.sample_creator || null,
            sampleCreatorIp: r.sample_creator_ip || null
          });
        });
      } catch (err) {
        console.error('❌ getCreationEventsForResources chunk failed:', err && err.message ? err.message : err);
        // continue with next chunk (errors shouldn't break whole enrichment)
      }
    }

    return resultsMap;
  }

  // Query CloudTrail once per chunk to find latest deletion events for the provided resource ids
  // Returns: Map { id -> { deletionDate, deletedBy } }
  async getDeletionEventsForResources(resourceIds = [], { startDate, endDate } = {}) {
    if (!resourceIds || resourceIds.length === 0) return new Map();
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    const resultsMap = new Map();

    const now = new Date();
    const defaultStart = new Date();
    defaultStart.setDate(now.getDate() - 30);
    const Start = startDate || defaultStart.toISOString().split('T')[0];
    const End = endDate || now.toISOString().split('T')[0];

    for (const chunk of chunks) {
      const valuesSql = this.safeValuesForIds(chunk);
      const sql = `
        WITH target_ids(id) AS (
          VALUES
            ${valuesSql}
        ),
        ct AS (
          SELECT
            CASE
              WHEN regexp_like(cast(eventtime AS varchar), '^\\d{4}-\\d{2}-\\d{2}T') THEN from_iso8601_timestamp(cast(eventtime AS varchar))
              ELSE cast(eventtime AS timestamp)
            END AS eventtime_parsed,
            eventname,
            requestparameters,
            responseelements,
            sourceipaddress,
            useridentity,
            resources
          FROM ${this.athenaDatabase}.cloudtrail_logs_titans
          WHERE
            ( (try(cast(eventtime AS date)) BETWEEN DATE '${Start}' AND DATE '${End}')
              OR (regexp_like(cast(eventtime AS varchar), '^\\d{4}-\\d{2}-\\d{2}T') AND date(from_iso8601_timestamp(cast(eventtime AS varchar))) BETWEEN DATE '${Start}' AND DATE '${End}')
            )
        )
        SELECT
          t.id AS target_id,
          MAX(CASE WHEN lower(ct.eventname) LIKE '%delete%' OR lower(ct.eventname) LIKE '%terminate%' OR lower(ct.eventname) LIKE '%remove%' THEN ct.eventtime_parsed END) AS last_delete,
          any_value(ct.useridentity.arn) FILTER (WHERE lower(ct.eventname) LIKE '%delete%' OR lower(ct.eventname) LIKE '%terminate%') AS sample_deleter,
          any_value(ct.sourceipaddress) FILTER (WHERE lower(ct.eventname) LIKE '%delete%' OR lower(ct.eventname) LIKE '%terminate%') AS sample_deleter_ip
        FROM ct
        CROSS JOIN target_ids t
        LEFT JOIN UNNEST(ct.resources) AS u(res) ON TRUE
        WHERE
          lower(ct.requestparameters) LIKE concat('%', lower(t.id), '%')
          OR lower(ct.responseelements) LIKE concat('%', lower(t.id), '%')
          OR lower(coalesce(u.res.arn, '')) LIKE concat('%', lower(t.id), '%')
        GROUP BY t.id;
      `;

      try {
        const rows = await this.runAthenaQuery(sql);
        rows.forEach(r => {
          if (!r || !r.target_id) return;
          resultsMap.set(String(r.target_id), {
            deletionDate: r.last_delete || null,
            deletedBy: r.sample_deleter || null,
            sampleDeleterIp: r.sample_deleter_ip || null
          });
        });
      } catch (err) {
        console.error('❌ getDeletionEventsForResources chunk failed:', err && err.message ? err.message : err);
        // continue with next chunk
      }
    }

    return resultsMap;
  }

  // ===============================
  // getResourcesForService (enhanced with bulk creation/deletion enrichment)
  // ===============================
  async getResourcesForService(serviceName) {
    try {
      console.log(`🔍 Fetching enhanced resource details for: ${serviceName} from Athena.`);
      const { Start, End } = this.getDateRange(1);

      // Build candidate product codes list: serviceName might be friendly or a product code.
      const candidateCodes = new Set();
      candidateCodes.add(serviceName);
      // If serviceName matches a friendly name, add product codes mapping
      for (const [code, friendly] of Object.entries(this.serviceNameMap)) {
        if (friendly.toLowerCase() === String(serviceName).toLowerCase()) candidateCodes.add(code);
      }
      const codesArr = Array.from(candidateCodes).map(c => `'${String(c).replace("'", "''")}'`).join(',');

      const sql = `
        SELECT
            line_item_resource_id,
            COALESCE(line_item_product_code, 'Unknown') AS product_code,
            product_location,
            SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS total_cost,
            resource_tags,
            COALESCE(NULLIF(TRIM(resource_tags['user_owner']), ''), 'Unknown (from CUR)') AS owner_tag,
            COALESCE(NULLIF(TRIM(resource_tags['user_project']), ''), 'Unassigned (from CUR)') AS project_tag
        FROM ${this.athenaDatabase}.cur_daily_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
            AND date(line_item_usage_start_date) <= DATE '${End}'
            AND line_item_resource_id IS NOT NULL
            AND COALESCE(line_item_product_code, 'Unknown') IN (${codesArr})
        GROUP BY
            line_item_resource_id,
            COALESCE(line_item_product_code, 'Unknown'),
            product_location,
            resource_tags
        ORDER BY
            total_cost DESC;
      `;

      const rows = await this.runAthenaQuery(sql);

      // Build canonical search keys (prefer exact id; also include shortId)
      const canonicalIdSet = new Set();
      rows.forEach(r => {
        const raw = String(r.line_item_resource_id || '').trim();
        if (!raw) return;
        canonicalIdSet.add(raw);
        const short = raw.includes('/') ? raw.split('/').pop() : raw;
        if (short) canonicalIdSet.add(short);
      });
      const canonicalIds = Array.from(canonicalIdSet);

      // Bulk fetch creation and deletion events for canonicalIds
      console.log(`📊 Running bulk CloudTrail creation queries for ${canonicalIds.length} canonical ids (chunk=${this.bulkChunkSize})`);
      const creationMap = await this.getCreationEventsForResources(canonicalIds, { startDate: Start, endDate: End });
      console.log(`📊 Running bulk CloudTrail deletion queries for ${canonicalIds.length} canonical ids (chunk=${this.bulkChunkSize})`);
      const deletionMap = await this.getDeletionEventsForResources(canonicalIds, { startDate: Start, endDate: End });

      // Map CUR rows into formatted resources enriched from creationMap/deletionMap
      const formattedResources = rows.map((r) => {
        const resourceId = r.line_item_resource_id || String(r.identity_line_item_id || '');
        const raw = String(resourceId || '').trim();
        const short = raw.includes('/') ? raw.split('/').pop() : raw;

        // prefer exact ARN match in maps, fallback to short
        const creationInfo = creationMap.get(raw) || creationMap.get(short) || { createdDate: null, createdBy: null };
        const deletionInfo = deletionMap.get(raw) || deletionMap.get(short) || { deletionDate: null, deletedBy: null };

        // Parse tags from CUR data
        const tags = [];
        if (r.resource_tags && typeof r.resource_tags === 'object') {
          Object.entries(r.resource_tags).forEach(([key, value]) => {
            if (key && value && key.trim() && value.trim()) {
              tags.push({ key: key.trim(), value: value.trim() });
            }
          });
        }

        // Determine actual status based on deletion info and cost data
        let status = 'running'; // default
        if (deletionInfo && deletionInfo.deletionDate) {
          status = 'terminated';
        } else if (Number(r.total_cost || 0) === 0) {
          status = 'unknown';
        } else {
          status = 'running';
        }

        return {
          id: raw,
          name: raw,
          type: this.serviceNameMap[r.product_code] || r.product_code,
          region: r.product_location || 'unknown',
          owner: r.owner_tag || 'Unknown (from CUR)',
          project: r.project_tag || 'Unassigned (from CUR)',
          createdDate: creationInfo.createdDate || null,
          createdBy: creationInfo.createdBy || null,
          status: status,
          deletionDate: deletionInfo.deletionDate || null,
          deletedBy: deletionInfo.deletedBy || null,
          cost: Number(r.total_cost || 0),
          tags: tags,
          specifications: {},
        };
      });

      console.log(`✅ Enhanced and enriched ${formattedResources.length} resources for ${serviceName} from Athena (bulk).`);
      return formattedResources;
    } catch (err) {
      console.error(`❌ getResourcesForService failed for ${serviceName}:`, err.message || err);
      throw err;
    }
  }

  // ADDITIONAL: top spending resources
  async getTopSpendingResources() {
    try {
      const sql = `
        SELECT
            COALESCE(line_item_product_code, 'Unknown') AS service,
            CASE
                WHEN strpos(line_item_resource_id, ':') > 0 THEN
                    split_part(split_part(line_item_resource_id, ':', 6), '/', 1)
                WHEN line_item_resource_id LIKE 'i-%' THEN 'ec2-instance'
                WHEN line_item_resource_id LIKE 'vol-%' THEN 'ebs-volume'
                WHEN line_item_resource_id LIKE 'snap-%' THEN 'ebs-snapshot'
                WHEN line_item_resource_id LIKE 'nat-%' THEN 'nat-gateway'
                ELSE 'other'
            END AS resource_type,
            COALESCE(
              regexp_extract(trim(line_item_resource_id), '([^/]+)$', 1),
              NULLIF(trim(line_item_resource_id), ''),
              identity_line_item_id
            ) AS resource_id,
            COALESCE(NULLIF(trim(line_item_resource_id), ''), identity_line_item_id) AS raw_resource_id,
            SUM( COALESCE(amortized_cost, line_item_unblended_cost, 0) ) AS total_cost
        FROM "${this.athenaDatabase}".cur_daily_v1
        WHERE date(line_item_usage_start_date) >= (current_date - interval '30' day)
          AND (line_item_resource_id IS NOT NULL OR identity_line_item_id IS NOT NULL)
          AND trim(COALESCE(line_item_resource_id, identity_line_item_id, '')) <> ''
        GROUP BY 1, 2, 3, 4
        ORDER BY total_cost DESC
        LIMIT 10;
      `;
      const rows = await this.runAthenaQuery(sql);
      // normalize output shape to match frontend expected keys
      return (rows || []).map(r => ({
        service: r.service || 'Unknown',
        resource_type: r.resource_type || 'other',
        // prefer the parsed resource_id (short/pretty), but fall back to the raw authoritative id
        resource_id: r.resource_id || r.raw_resource_id || 'unknown',
        raw_resource_id: r.raw_resource_id || null,
        total_cost: Number(r.total_cost || 0)
      }));
    } catch (err) {
      console.error('❌ getTopSpendingResources failed:', err);
      return [];
    }
  }

  getResourceTypeForService(serviceName) {
    const serviceToResourceType = {
      'Amazon Elastic Compute Cloud - Compute': 'ec2:instance',
      'EC2 - Other': 'ec2',
      'Amazon Relational Database Service': 'rds:db',
      'Amazon Simple Storage Service': 's3:bucket',
      'Amazon Elastic Kubernetes Service': 'eks:cluster',
      'Amazon WorkSpaces': 'workspaces:workspace',
      'Amazon CloudWatch': 'cloudwatch:dashboard',
      'AmazonCloudWatch': 'cloudwatch:dashboard',
      'AWS Secrets Manager': 'secretsmanager:secret',
      'AWS Key Management Service': 'kms:key',
      'AWS Config': 'config:rule',
      'Amazon Route 53': 'route53:hostedzone',
      'Amazon Elastic Container Registry': 'ecr:repository',
      'Amazon API Gateway': 'apigateway:restapis',
      'AWS Systems Manager': 'ssm:managed-instance',
      'Amazon DynamoDB': 'dynamodb:table',
      'Amazon Location Service': 'location:geofence-collection',
      'Amazon Elastic File System': 'efs:file-system',
      'AWS Backup': 'backup:backup-vault',
      'Amazon Simple Queue Service': 'sqs:queue',
      'AWS Lambda': 'lambda:function',
      'AWS Storage Gateway': 'storagegateway:gateway',
    };
    return serviceToResourceType[serviceName] || null;
  }
}
