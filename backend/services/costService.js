// cost-service-athena.js
import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { ResourceGroupsTaggingAPIClient, GetResourcesCommand } from "@aws-sdk/client-resource-groups-tagging-api";
import { EC2Client, DescribeInstancesCommand, DescribeRegionsCommand } from '@aws-sdk/client-ec2';
import { RDSClient, DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';
import { EKSClient, ListClustersCommand } from '@aws-sdk/client-eks';
import { WorkSpacesClient, DescribeWorkspacesCommand, DescribeWorkspaceBundlesCommand, DescribeWorkspaceDirectoriesCommand } from '@aws-sdk/client-workspaces';
import { CloudWatchClient, ListDashboardsCommand } from '@aws-sdk/client-cloudwatch';
import { SecretsManagerClient, ListSecretsCommand } from '@aws-sdk/client-secrets-manager';
import { KMSClient, ListKeysCommand } from '@aws-sdk/client-kms';
import { ConfigServiceClient, DescribeConfigRulesCommand } from '@aws-sdk/client-config-service';
import { Route53Client, ListHostedZonesCommand } from '@aws-sdk/client-route-53';
import { ECRClient, DescribeRepositoriesCommand } from '@aws-sdk/client-ecr';
import { ApiGatewayV2Client, GetApisCommand } from '@aws-sdk/client-apigatewayv2';
import { SSMClient, DescribeInstanceInformationCommand } from '@aws-sdk/client-ssm';
import { DynamoDBClient, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { LocationClient, ListGeofenceCollectionsCommand } from '@aws-sdk/client-location';
import { EFSClient, DescribeFileSystemsCommand } from '@aws-sdk/client-efs';
import { BackupClient, ListBackupVaultsCommand } from '@aws-sdk/client-backup';
import { SQSClient, ListQueuesCommand } from '@aws-sdk/client-sqs';
import { LambdaClient, ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { StorageGatewayClient, ListGatewaysCommand } from '@aws-sdk/client-storage-gateway';

export class CostService {
  constructor(accountId, roleArn) {
    this.accountId = accountId;
    this.roleArn = roleArn;
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.athenaOutput = process.env.ATHENA_OUTPUT_S3; // e.g. 's3://my-athena-results/'
    this.athenaDatabase = process.env.ATHENA_DATABASE || 'aws_cost_analysis_db';
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || undefined; // optional
    if (!this.athenaOutput) {
      console.warn('⚠️ ATHENA_OUTPUT_S3 not set. Athena StartQueryExecution will likely fail without an output location.');
    }
  }

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

  // ---------- Athena helper ----------
  // Runs an Athena query, polls until completion, and returns rows as array of objects.
  async runAthenaQuery(sql, { database = this.athenaDatabase, workGroup = this.athenaWorkGroup } = {}) {
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
    const maxMs = 120_000; // 120s poll timeout
    const intervalMs = 1000;
    const startTs = Date.now();
    while (true) {
      const execRes = await client.send(getExec);
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
        // subsequent pages may or may not repeat header - safer to parse using first page header saved earlier
        // But GetQueryResults does not return header on subsequent pages - we'll assume header already captured.
        // We'll fetch header from the initial page by re-fetching first page if needed.
        // Simpler approach: fetch the header once from the first page above. Here we assume 'rows' already started.
        const header = Object.keys(rows[0] || {});
        // If rows is empty and we didn't capture header, attempt simple fallback:
        if (!header.length) {
          // fallback to positional mapping like col0, col1...
          for (let i = 0; i < rsRows.length; i++) {
            const dataRow = rsRows[i].Data.map(d => (d.VarCharValue || null));
            const obj = {};
            for (let c = 0; c < dataRow.length; c++) obj[`col${c}`] = dataRow[c];
            rows.push(obj);
          }
        } else {
          // map by header positions
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

    // convert numeric-looking fields to numbers where applicable
    return rows.map(r => {
      const converted = {};
      for (const k of Object.keys(r)) {
        const v = r[k];
        if (v === null) { converted[k] = null; continue; }
        // try to detect integers and floats
        if (/^-?\d+$/.test(v)) converted[k] = parseInt(v, 10);
        else if (/^-?\d+\.\d+(e[-+]?\d+)?$/i.test(v) || /^-?\d+e[-+]?\d+$/i.test(v)) converted[k] = Number(v);
        else converted[k] = v;
      }
      return converted;
    });
  }
  // ---------- end Athena helper ----------

  // date helpers (returns { Start: 'YYYY-MM-DD', End: 'YYYY-MM-DD' })
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

  // returns array of { day: 'YYYY-MM-DD', Groups: [ { Keys: [service], Metrics: { BlendedCost: { Amount: 'X' } } } ] }
  async getDailyCostData() {
    try {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
  
      // UPDATED: Simple, robust query
      const sql = `
        SELECT
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          canonical_service AS service,
          SUM(line_item_unblended_cost) AS total_cost_usd
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}'
          AND date(line_item_usage_start_date) <= DATE '${endStr}'
        GROUP BY 1, 2
        ORDER BY day ASC, total_cost_usd DESC;
      `;
  
      const rows = await this.runAthenaQuery(sql);
  
      // Map Athena service names to friendly names for the dashboard
      const serviceNameMap = {
        'Amazon Elastic Compute Cloud': 'EC2',
        'Amazon Virtual Private Cloud': 'VPC',
        'Amazon Relational Database Service': 'RDS',
        'Amazon Simple Storage Service': 'S3',
        // Add more mappings here to match your Cost Explorer data
      };
  
      const dayMap = {};
      rows.forEach(r => {
        const day = r.day;
        const originalService = r.service;
        const mappedService = serviceNameMap[originalService] || originalService; // Use mapped name or original
        const cost = Number(r.total_cost_usd || 0);
        
        if (!dayMap[day]) dayMap[day] = {};
        
        // Aggregate costs for services that might map to the same name
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

  // weekly: aggregate the last 12 weeks of daily data into weeks of 7 days
  async getWeeklyCostData() {
    try {
      // reuse daily data then bucket into 7-day windows
      const daily = await this.getDailyCostData();
      // transform into weeks (sliding by 7 from the start)
      const chunks = [];
      for (let i = 0; i < daily.length; i += 7) {
        const week = daily.slice(i, i + 7);
        if (week.length === 0) continue;
        // sum per service across the week
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

  // monthly trend for past 6 months
  async getCostTrendData() {
    try {
      const end = new Date();
      const start = new Date();
      start.setMonth(start.getMonth() - 6);
      start.setDate(1);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT date_format(line_item_usage_start_date, '%Y-%m') AS month,
               SUM(cost_cents) AS cost_cents
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}'
          AND date(line_item_usage_start_date) <= DATE '${endStr}'
        GROUP BY date_format(line_item_usage_start_date, '%Y-%m')
        ORDER BY month ASC;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows.map(r => {
        const monthLabel = r.month;
        const cost = Number(r.cost_cents || 0) / 100;
        return { month: monthLabel, cost, period: monthLabel };
      });
    } catch (err) {
      console.error('❌ getCostTrendData failed:', err);
      throw err;
    }
  }

  async getTotalMonthlyCost() {
    try {
      const { Start, End } = this.getDateRange(1); // current month from 1st to today
      // Use date range inclusive of today
      const sql = `
        SELECT SUM(cost_cents) AS cost_cents
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}';
      `;
      const rows = await this.runAthenaQuery(sql);
      const cents = (rows[0] && rows[0].cost_cents) ? Number(rows[0].cost_cents) : 0;
      return Number((cents / 100).toFixed(2));
    } catch (err) {
      console.error('❌ getTotalMonthlyCost failed:', err);
      throw err;
    }
  }

  async getServiceCosts() {
    try {
      const { Start, End } = this.getDateRange(1);
      // group by canonical service and region (product_location)
      const sql = `
        SELECT canonical_service AS service,
               product_location AS region,
               SUM(cost_cents) AS cost_cents
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
        GROUP BY canonical_service, product_location
        ORDER BY cost_cents DESC
        LIMIT 500;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows
        .map(r => ({ service: r.service || 'Unknown', region: r.region || 'NoRegion', cost: Number(r.cost_cents || 0) / 100 }))
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
        SELECT product_location AS region,
               SUM(cost_cents) AS cost_cents
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
        GROUP BY product_location
        ORDER BY cost_cents DESC;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows
        .map(r => ({ region: r.region || 'Unknown', cost: Number(r.cost_cents || 0) / 100 }))
        .filter(x => x.cost > 0);
    } catch (err) {
      console.error('❌ getRegionCosts failed:', err);
      throw err;
    }
  }

  // Owner/user costs using CUR tags (resource_tags map)
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
        SELECT owner_tag, total_usd, total_cents, resource_count
        FROM (
          SELECT
            COALESCE(
              NULLIF(TRIM(resource_tags['user_owner']), '')
            ) AS owner_tag,
            SUM(cost_usd) AS total_usd,
            SUM(cost_cents) AS total_cents,
            COUNT(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)) AS resource_count
          FROM ${this.athenaDatabase}.cur_canonical_services_v1
          WHERE date(line_item_usage_start_date) >= DATE '${Start}'
            AND date(line_item_usage_start_date) <= DATE '${End}'
            AND line_item_unblended_cost IS NOT NULL
            AND line_item_unblended_cost <> 0
          GROUP BY
            COALESCE(
              NULLIF(TRIM(resource_tags['user_owner']), '')
            )
        ) t
        WHERE owner_tag IS NOT NULL
        ORDER BY total_cents DESC
        LIMIT 500;
      `;
  
      console.log('getUserCosts SQL:\n', sql);
      const rows = await this.runAthenaQuery(sql);
      console.log('getUserCosts - sample rows:', rows.slice(0, 8));
  
      return rows.map(r => ({
        user: r.owner_tag,
        cost: Number(r.total_usd || 0),
        cost_cents: Number(r.total_cents || 0),
        resources: Number(r.resource_count || 0)
      }));
    } catch (err) {
      console.error('❌ getUserCosts failed:', err);
      return [];
    }
  }

  // resource costs: daily trend for services (uses Athena for cost trend + Resource Groups for counts)
  async getResourceCosts() {
    try {
      console.log('🔍 Validating resource data from Athena...');
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
  
      const sql = `
        SELECT
          canonical_service AS service,
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          SUM(cost_cents) AS cost_cents,
          COUNT(DISTINCT line_item_resource_id) AS resource_count
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE
          date(line_item_usage_start_date) >= DATE '${startStr}' AND
          date(line_item_usage_start_date) <= DATE '${endStr}' AND
          line_item_resource_id IS NOT NULL AND
          canonical_service IS NOT NULL
        GROUP BY
          canonical_service,
          date_format(line_item_usage_start_date, '%Y-%m-%d')
        ORDER BY
          service, day;
      `;
      
      const rows = await this.runAthenaQuery(sql);
  
      // Convert to structure: service -> dailyTrend array and total
      const svcMap = {};
      const uniqueDays = [...new Set(rows.map(r => r.day))].sort();
  
      rows.forEach(r => {
        const s = r.service || 'Unknown';
        if (!svcMap[s]) svcMap[s] = {
          type: s,
          dailyTrend: uniqueDays.map(_ => 0),
          cost: 0,
          count: 0
        };
        
        const dayIndex = uniqueDays.indexOf(r.day);
        const dollars = Number(r.cost_cents || 0) / 100;
        svcMap[s].dailyTrend[dayIndex] = dollars;
        svcMap[s].cost += dollars;
        
        // We will sum the count for each day to get a total for the month,
        // as resource IDs might appear on multiple days.
        svcMap[s].count += Number(r.resource_count || 0);
      });
  
      const results = Object.values(svcMap).map(item => ({
        ...item,
        // Use the daily trend array
        trend: item.dailyTrend
      }));
  
      // Sort by total cost and return the top 10
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
        SELECT project_tag, total_usd, total_cents, resource_count
        FROM (
          SELECT
            COALESCE(NULLIF(TRIM(resource_tags['user_project']), '')) AS project_tag,
            SUM(cost_usd) AS total_usd,
            SUM(cost_cents) AS total_cents,
            COUNT(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)) AS resource_count
          FROM ${this.athenaDatabase}.cur_canonical_services_v1
          WHERE date(line_item_usage_start_date) >= DATE '${Start}'
            AND date(line_item_usage_start_date) <= DATE '${End}'
            AND line_item_unblended_cost IS NOT NULL
            AND line_item_unblended_cost <> 0
          GROUP BY COALESCE(NULLIF(TRIM(resource_tags['user_project']), ''))
        ) t
        WHERE project_tag IS NOT NULL
        ORDER BY total_cents DESC
        LIMIT 500;
      `;
  
      console.log('getProjectCosts SQL:\n', sql);
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
    // This function is now deprecated as we'll get actual costs from CUR.
    // However, if you have other uses for it, you can keep it.
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

  // ---------- RESOURCE FETCHING FUNCTIONS (UPDATED to use Athena) ----------
  async getResourcesForService(serviceName) {
    try {
      console.log(`🔍 Fetching resource details for: ${serviceName} from Athena.`);
      const { Start, End } = this.getDateRange(1);
      const sql = `
        SELECT
            line_item_resource_id,
            canonical_service,
            product_location,
            SUM(line_item_unblended_cost) AS total_cost
        FROM ${this.athenaDatabase}.cur_canonical_services_v1
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
            AND date(line_item_usage_start_date) <= DATE '${End}'
            AND canonical_service = '${serviceName}'
            AND line_item_resource_id IS NOT NULL
        GROUP BY
            line_item_resource_id,
            canonical_service,
            product_location
        ORDER BY
            total_cost DESC;
      `;
      
      const rows = await this.runAthenaQuery(sql);

      const formattedResources = rows.map(r => ({
        id: r.line_item_resource_id,
        name: r.line_item_resource_id,
        type: r.canonical_service,
        region: r.product_location || 'unknown',
        // Note: Owner and Project tags would require a slightly more complex query
        // to extract from the 'resource_tags' column if needed, but for now
        // let's use placeholders as an example.
        owner: 'Unknown (from CUR)',
        project: 'Unassigned (from CUR)',
        createdDate: 'N/A',
        status: 'Active',
        cost: Number(r.total_cost),
        tags: [], // Tags can be extracted with a more complex query if needed
        specifications: {},
      }));

      console.log(`✅ Formatted and enriched ${formattedResources.length} resources for ${serviceName} from Athena.`);
      return formattedResources;
    } catch (err) {
      console.error(`❌ getResourcesForService failed for ${serviceName}:`, err.message || err);
      throw err;
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