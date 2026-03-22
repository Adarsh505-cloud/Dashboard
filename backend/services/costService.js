// backend/services/costService.js
// Full file implementing bulk CloudTrail enrichment using chunked VALUES(...) queries.
// Uses mapping tables (resource_creation_map/resource_deletion_map) + fallback to cloudtrail_resources for misses.

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { ResourceGroupsTaggingAPIClient } from "@aws-sdk/client-resource-groups-tagging-api";
import { EC2Client } from '@aws-sdk/client-ec2';

export class CostService {
  constructor(accountId, roleArn, targetAccountId = null, { startDate, endDate } = {}) {
    this.accountId = String(accountId).trim();
    this.roleArn = String(roleArn).trim();
    this.targetAccountId = targetAccountId ? String(targetAccountId).trim() : null;

    // Custom date range from frontend date selector
    this.customStartDate = startDate || null;
    this.customEndDate = endDate || null;
    
    this.region = process.env.ATHENA_REGION || 'us-east-1';
    
    const rawBucket = `s3://cost-analyzer-results-${this.accountId}-${this.region}/`;
    this.athenaOutput = rawBucket.toLowerCase();

    this.athenaDatabase = process.env.ATHENA_DATABASE || 'aws_cost_analysis_db';
    this.athenaCurTable = process.env.ATHENA_CUR_TABLE || 'data';
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || 'primary';

    this.bulkChunkSize = Number(process.env.BULK_CHUNK_SIZE || 200);
    this.ATHENA_POLL_MS = Number(process.env.ATHENA_POLL_MS || 22000);
    this.ATHENA_POLL_INTERVAL_MS = Number(process.env.ATHENA_POLL_INTERVAL_MS || 1500);
    this.START_RETRY_MAX = Number(process.env.START_RETRY_MAX || 3);

    this.serviceNameMap = {
      'AmazonEC2': 'EC2', 'AmazonVPC': 'VPC', 'AmazonRDS': 'RDS',
      'AmazonS3': 'S3', 'AWSGlue': 'Glue', 'awskms': 'KMS',
      'AWSSecretsManager': 'SecretsManager', 'AmazonRoute53': 'Route53',
      'AmazonCloudWatch': 'CloudWatch', 'AmazonAthena': 'Athena', 'AmazonECR': 'ECR',
    };
  }

  get targetAccountFilter() {
    return this.targetAccountId ? ` AND line_item_usage_account_id = '${this.targetAccountId}' ` : '';
  }

  // Excludes Credits, Discounts, Refunds, Taxes, RI/SP fees — shows gross infrastructure cost only
  get usageOnlyFilter() {
    return `AND line_item_line_item_type = 'Usage'`;
  }

  async getCredentials() {
    return fromTemporaryCredentials({
      params: { RoleArn: this.roleArn, RoleSessionName: `cost-analysis-${Date.now()}`, DurationSeconds: 3600 },
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

  async runAthenaQuery(sql, { database = this.athenaDatabase, workGroup = this.athenaWorkGroup, timeoutMs = 120_000 } = {}) {
    const client = await this.getAthenaClient();
    if (!this.athenaOutput) throw new Error('ATHENA_OUTPUT_S3 environment variable is required');

    const startCmd = new StartQueryExecutionCommand({
      QueryString: sql,
      ResultConfiguration: { OutputLocation: this.athenaOutput },
      QueryExecutionContext: { Database: database },
      WorkGroup: workGroup,
    });

    const startRes = await client.send(startCmd);
    const qid = startRes.QueryExecutionId;
    if (!qid) throw new Error('Failed to start Athena query');

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
        throw new Error(`Athena query ${qid} FAILED: ${reason}`);
      }
      if (Date.now() - startTs > maxMs) {
        throw new Error(`Athena query ${qid} timed out after ${maxMs}ms (state=${state})`);
      }
      await new Promise(r => setTimeout(r, intervalMs));
    }

    const rows = [];
    let nextToken = undefined;
    do {
      const resultsCmd = new GetQueryResultsCommand({ QueryExecutionId: qid, NextToken: nextToken });
      const resultsRes = await client.send(resultsCmd);
      const resultSet = resultsRes.ResultSet;
      const rsRows = resultSet?.Rows || [];
      if (!rows.length && rsRows.length > 0) {
        const headerRow = rsRows[0].Data.map(d => (d.VarCharValue || '').trim());
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

    return convertedRows;
  }

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

  getEffectiveDateRange(fallbackMonths = 1) {
    if (this.customStartDate && this.customEndDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (dateRegex.test(this.customStartDate) && dateRegex.test(this.customEndDate)) {
        return { Start: this.customStartDate, End: this.customEndDate };
      }
    }
    return this.getDateRange(fallbackMonths);
  }

  chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  safeValuesForIds(ids) {
    return ids.map(id => `('${String(id).replace(/'/g, "''")}')`).join(',\n');
  }

  partitionPredicateForRange(Start, End) {
    if (!Start || !End) return '';
    const startDate = new Date(Start);
    const endDate = new Date(End);
    const days = [];
    for (let dt = new Date(startDate); dt <= endDate; dt.setDate(dt.getDate() + 1)) {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const d = String(dt.getDate()).padStart(2, '0');
      days.push(`(year='${y}' AND month='${m}' AND day='${d}')`);
    }
    if (!days.length) return '';
    return ` AND (${days.join(' OR ')})`;
  }

  async queryCreationMapForIds(ids = [], { Start, End } = {}) {
    if (!ids || !ids.length) return [];
    const valuesSql = this.safeValuesForIds(ids);
    const partitionPred = this.partitionPredicateForRange(Start, End);
    const sql = `
      WITH target_ids(id) AS ( VALUES ${valuesSql} )
      SELECT t.id AS target_id, r.first_create, r.sample_creator_arn AS sample_creator, r.sample_creator_ip
      FROM target_ids t
      LEFT JOIN ${this.athenaDatabase}.resource_creation_map r
        ON lower(r.resource_arn) = lower(t.id) OR lower(r.resource_short) = lower(t.id)
      WHERE 1=1 ${partitionPred};
    `;
    try { return await this.runAthenaQuery(sql); } catch (err) { return []; }
  }

  async queryDeletionMapForIds(ids = [], { Start, End } = {}) {
    if (!ids || !ids.length) return [];
    const valuesSql = this.safeValuesForIds(ids);
    const partitionPred = this.partitionPredicateForRange(Start, End);
    const sql = `
      WITH target_ids(id) AS ( VALUES ${valuesSql} )
      SELECT t.id AS target_id, r.last_delete, r.sample_deleter_arn AS sample_deleter, r.sample_deleter_ip
      FROM target_ids t
      LEFT JOIN ${this.athenaDatabase}.resource_deletion_map r
        ON lower(r.resource_arn) = lower(t.id) OR lower(r.resource_short) = lower(t.id)
      WHERE 1=1 ${partitionPred};
    `;
    try { return await this.runAthenaQuery(sql); } catch (err) { return []; }
  }

  async queryCloudtrailResourcesForCreation(ids = [], { Start, End } = {}) {
    if (!ids || !ids.length) return [];
    const valuesSql = this.safeValuesForIds(ids);
    const partitionPred = this.partitionPredicateForRange(Start, End);
    const sql = `
      WITH target_ids(id) AS ( VALUES ${valuesSql} )
      SELECT t.id AS target_id,
        MIN(CASE WHEN lower(cr.eventname) LIKE '%create%' OR lower(cr.eventname) LIKE '%launch%' OR lower(cr.eventname) LIKE '%run%' OR lower(cr.eventname) LIKE '%start%' THEN cr.eventtime_parsed END) AS first_create,
        any_value(cr.useridentity_arn) FILTER (WHERE lower(cr.eventname) LIKE '%create%') AS sample_creator,
        any_value(cr.sourceipaddress) FILTER (WHERE lower(cr.eventname) LIKE '%create%') AS sample_creator_ip
      FROM ${this.athenaDatabase}.cloudtrail_resources cr
      CROSS JOIN target_ids t
      WHERE ( lower(cr.resource_arn) = lower(t.id) OR lower(cr.resource_short) = lower(t.id) )
        ${partitionPred}
      GROUP BY t.id;
    `;
    try { return await this.runAthenaQuery(sql); } catch (err) { return []; }
  }

  async queryCloudtrailResourcesForDeletion(ids = [], { Start, End } = {}) {
    if (!ids || !ids.length) return [];
    const valuesSql = this.safeValuesForIds(ids);
    const partitionPred = this.partitionPredicateForRange(Start, End);
    const sql = `
      WITH target_ids(id) AS ( VALUES ${valuesSql} )
      SELECT t.id AS target_id,
        MAX(CASE WHEN lower(cr.eventname) LIKE '%delete%' OR lower(cr.eventname) LIKE '%terminate%' OR lower(cr.eventname) LIKE '%remove%' THEN cr.eventtime_parsed END) AS last_delete,
        any_value(cr.useridentity_arn) FILTER (WHERE lower(cr.eventname) LIKE '%delete%' OR lower(cr.eventname) LIKE '%terminate%') AS sample_deleter,
        any_value(cr.sourceipaddress) FILTER (WHERE lower(cr.eventname) LIKE '%delete%' OR lower(cr.eventname) LIKE '%terminate%') AS sample_deleter_ip
      FROM ${this.athenaDatabase}.cloudtrail_resources cr
      CROSS JOIN target_ids t
      WHERE ( lower(cr.resource_arn) = lower(t.id) OR lower(cr.resource_short) = lower(t.id) )
        ${partitionPred}
      GROUP BY t.id;
    `;
    try { return await this.runAthenaQuery(sql); } catch (err) { return []; }
  }

  async getCreationEventsForResources(resourceIds = [], { startDate, endDate } = {}) {
    if (!resourceIds || resourceIds.length === 0) return new Map();
    const now = new Date();
    const defaultStart = new Date(); defaultStart.setDate(now.getDate() - 30);
    const Start = startDate || defaultStart.toISOString().split('T')[0];
    const End = endDate || now.toISOString().split('T')[0];
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    const resultsMap = new Map();

    for (const chunk of chunks) {
      try {
        const mapRows = await this.queryCreationMapForIds(chunk, { Start, End });
        const found = new Set();
        mapRows.forEach(r => {
          if (!r || !r.target_id) return;
          found.add(String(r.target_id));
          resultsMap.set(String(r.target_id), { createdDate: r.first_create || null, createdBy: r.sample_creator || null, sampleCreatorIp: r.sample_creator_ip || null });
        });
        const misses = chunk.filter(id => !found.has(String(id)));
        if (misses.length > 0) {
          const fallbackRows = await this.queryCloudtrailResourcesForCreation(misses, { Start, End });
          fallbackRows.forEach(r => {
            if (!r || !r.target_id) return;
            resultsMap.set(String(r.target_id), { createdDate: r.first_create || null, createdBy: r.sample_creator || null, sampleCreatorIp: r.sample_creator_ip || null });
          });
        }
      } catch (err) {}
    }
    return resultsMap;
  }

  async getDeletionEventsForResources(resourceIds = [], { startDate, endDate } = {}) {
    if (!resourceIds || resourceIds.length === 0) return new Map();
    const now = new Date();
    const defaultStart = new Date(); defaultStart.setDate(now.getDate() - 30);
    const Start = startDate || defaultStart.toISOString().split('T')[0];
    const End = endDate || now.toISOString().split('T')[0];
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    const resultsMap = new Map();

    for (const chunk of chunks) {
      try {
        const mapRows = await this.queryDeletionMapForIds(chunk, { Start, End });
        const found = new Set();
        mapRows.forEach(r => {
          if (!r || !r.target_id) return;
          found.add(String(r.target_id));
          resultsMap.set(String(r.target_id), { deletionDate: r.last_delete || null, deletedBy: r.sample_deleter || null, sampleDeleterIp: r.sample_deleter_ip || null });
        });
        const misses = chunk.filter(id => !found.has(String(id)));
        if (misses.length > 0) {
          const fallbackRows = await this.queryCloudtrailResourcesForDeletion(misses, { Start, End });
          fallbackRows.forEach(r => {
            if (!r || !r.target_id) return;
            resultsMap.set(String(r.target_id), { deletionDate: r.last_delete || null, deletedBy: r.sample_deleter || null, sampleDeleterIp: r.sample_deleter_ip || null });
          });
        }
      } catch (err) {}
    }
    return resultsMap;
  }

  async getLinkedAccountsSummary() {
    try {
      const { Start, End } = this.getEffectiveDateRange(1);
      const sqlPrimary = `
        SELECT
            line_item_usage_account_id AS linked_account_id,
            MAX(line_item_usage_account_name) AS linked_account_name,
            SUM( COALESCE(line_item_unblended_cost, 0) ) AS total_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}'
          AND date(line_item_usage_start_date) <= DATE '${End}'
          ${this.usageOnlyFilter}
        GROUP BY 1 ORDER BY total_cost DESC;
      `;
      try {
        const rows = await this.runAthenaQuery(sqlPrimary);
        return rows.map(r => ({
          accountId: r.linked_account_id,
          accountName: r.linked_account_name || null,
          cost: Number(r.total_cost || 0)
        }));
      } catch (err) {
        if (err.message && err.message.includes('COLUMN_NOT_FOUND')) {
          const sqlFallback = `
            SELECT
                line_item_usage_account_id AS linked_account_id,
                SUM( COALESCE(line_item_unblended_cost, 0) ) AS total_cost
            FROM ${this.athenaDatabase}.${this.athenaCurTable}
            WHERE date(line_item_usage_start_date) >= DATE '${Start}'
              AND date(line_item_usage_start_date) <= DATE '${End}'
              ${this.usageOnlyFilter}
            GROUP BY 1 ORDER BY total_cost DESC;
          `;
          const fbRows = await this.runAthenaQuery(sqlFallback);
          return fbRows.map(r => ({ accountId: r.linked_account_id, accountName: null, cost: Number(r.total_cost || 0) }));
        }
        throw err;
      }
    } catch (err) { return []; }
  }

  async getDailyCostData() {
    try {
      const end = new Date();
      const start = new Date(); start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT
          date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
          COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown') AS service,
          SUM( COALESCE(line_item_unblended_cost, 0) ) AS total_cost_usd
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}' AND date(line_item_usage_start_date) <= DATE '${endStr}'
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY 1, 2 ORDER BY day ASC, total_cost_usd DESC;
      `;

      const rows = await this.runAthenaQuery(sql);
      const dayMap = {};
      rows.forEach(r => {
        const day = r.day;
        const mappedService = this.serviceNameMap[r.service] || r.service;
        if (!dayMap[day]) dayMap[day] = {};
        if (!dayMap[day][mappedService]) dayMap[day][mappedService] = 0;
        dayMap[day][mappedService] += Number(r.total_cost_usd || 0);
      });

      return Object.keys(dayMap).sort().map(day => ({
        TimePeriod: { Start: day, End: day },
        Groups: Object.keys(dayMap[day]).map(service => ({ Keys: [service], Metrics: { BlendedCost: { Amount: dayMap[day][service].toFixed(4) } } }))
      }));
    } catch (err) { throw err; }
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
            svcSums[service] = (svcSums[service] || 0) + parseFloat(g.Metrics?.BlendedCost?.Amount || '0');
          });
        });
        chunks.push({
          TimePeriod: { Start: week[0].TimePeriod.Start, End: week[week.length - 1].TimePeriod.End },
          Groups: Object.entries(svcSums).map(([svc, cost]) => ({ Keys: [svc], Metrics: { BlendedCost: { Amount: cost.toString() } } }))
        });
      }
      return chunks;
    } catch (err) { throw err; }
  }

  async getCostTrendData() {
    try {
      const end = new Date();
      const start = new Date(); start.setDate(start.getDate() - 30);
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const sql = `
        SELECT date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
               SUM(CAST(ROUND(COALESCE(line_item_unblended_cost, 0) * 100, 0) AS BIGINT)) AS cost_cents
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}' AND date(line_item_usage_start_date) <= DATE '${endStr}'
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY 1 ORDER BY 1 ASC;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows.map(r => ({ date: r.day, cost: Number((Number(r.cost_cents || 0) / 100).toFixed(2)) }));
    } catch (err) { throw err; }
  }

  async getTotalMonthlyCost() {
    try {
      const { Start, End } = this.getEffectiveDateRange(1);
      const sql = `
        SELECT SUM( COALESCE(line_item_unblended_cost, 0) ) AS total_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter};
      `;
      const rows = await this.runAthenaQuery(sql);
      return Number(((rows[0] && rows[0].total_cost) ? Number(rows[0].total_cost) : 0).toFixed(2));
    } catch (err) { throw err; }
  }

  async getServiceCosts() {
    try {
      const { Start, End } = this.getEffectiveDateRange(1);
      const sql = `
        SELECT COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown') AS service, product_location AS region,
               SUM( COALESCE(line_item_unblended_cost, 0) ) AS total_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown'), product_location
        ORDER BY total_cost DESC LIMIT 500;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows.map(r => ({ service: this.serviceNameMap[r.service] || r.service || 'Unknown', region: r.region || 'NoRegion', cost: Number(r.total_cost || 0) })).filter(x => x.cost > 0).sort((a,b) => b.cost - a.cost);
    } catch (err) { throw err; }
  }

  async getRegionCosts() {
    try {
      const { Start, End } = this.getEffectiveDateRange(1);
      const sql = `
        SELECT
          CASE WHEN product_location IS NULL OR trim(product_location) = '' THEN 'Global'
               WHEN lower(product_location) IN ('any','(any)','unknown') THEN 'Global'
               ELSE product_location END AS region,
          SUM(COALESCE(line_item_unblended_cost, 0)) AS total_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY 1 ORDER BY total_cost DESC;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows.map(r => ({ region: r.region || 'Global', cost: Number(r.total_cost || 0) })).filter(x => x.cost > 0);
    } catch (err) { throw err; }
  }

  async getUserCosts({ billingPeriod = null, fullMonth = false } = {}) {
    let Start, End;
    if (billingPeriod) {
      const [y, m] = billingPeriod.split('-').map(x => parseInt(x, 10));
      Start = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const endD = new Date(y, m, 1); endD.setDate(0);
      End = endD.toISOString().split('T')[0];
    } else {
      ({ Start, End } = this.getEffectiveDateRange(1));
    }

    // Resolve user from multiple tag keys: user_owner, user_name, user:Owner, user:owner
    const userTagExpr = `COALESCE(
      NULLIF(TRIM(element_at(resource_tags, 'user_owner')), ''),
      NULLIF(TRIM(element_at(resource_tags, 'user_name')), ''),
      NULLIF(TRIM(element_at(resource_tags, 'user:Owner')), ''),
      NULLIF(TRIM(element_at(resource_tags, 'user:owner')), '')
    )`;

    const sqlPrimary = `
      SELECT
        ${userTagExpr} AS user_name,
        ROUND(SUM(COALESCE(line_item_unblended_cost, 0)), 2) AS total_usd,
        SUM(CAST(ROUND(COALESCE(line_item_unblended_cost, 0) * 100, 0) AS BIGINT)) AS total_cents,
        COUNT(DISTINCT line_item_resource_id) AS resource_count,
        array_join(array_agg(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), '')), ',') AS resources_csv
      FROM ${this.athenaDatabase}.${this.athenaCurTable}
      WHERE date(line_item_usage_start_date) BETWEEN DATE '${Start}' AND DATE '${End}'
        AND line_item_unblended_cost > 0
        ${this.usageOnlyFilter}
        AND ${userTagExpr} IS NOT NULL
        ${this.targetAccountFilter}
      GROUP BY ${userTagExpr}
      ORDER BY total_usd DESC
      LIMIT 500
    `;

    console.log(`[getUserCosts] Date range: ${Start} to ${End}`);
    console.log(`[getUserCosts] SQL:`, sqlPrimary);

    try {
      const rows = await this.runAthenaQuery(sqlPrimary);
      console.log(`[getUserCosts] Returned ${rows.length} users`);
      if (rows.length > 0) console.log(`[getUserCosts] Sample:`, JSON.stringify(rows[0]));
      return rows.map(r => ({
        user: r.user_name,
        cost: Number(r.total_usd || 0),
        cost_cents: Number(r.total_cents || 0),
        resources: Number(r.resource_count || 0),
        resourcesList: r.resources_csv ? r.resources_csv.split(',').filter(Boolean) : []
      }));
    } catch (err) {
      console.error(`[getUserCosts] Error:`, err.message);
      if (err.message && (err.message.includes('COLUMN_NOT_FOUND') || err.message.includes('TABLE_NOT_FOUND') || err.message.includes('cannot be resolved'))) {
        console.log(`[getUserCosts] Falling back to untagged query...`);
        const fallbackSql = `
          SELECT
            'Unknown' AS user_name,
            ROUND(SUM(COALESCE(line_item_unblended_cost, 0)), 2) AS total_usd,
            SUM(CAST(ROUND(COALESCE(line_item_unblended_cost, 0) * 100, 0) AS BIGINT)) AS total_cents,
            COUNT(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)) AS resource_count,
            array_join(array_agg(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), '')), ',') AS resources_csv
          FROM ${this.athenaDatabase}.${this.athenaCurTable}
          WHERE date(line_item_usage_start_date) BETWEEN DATE '${Start}' AND DATE '${End}'
            AND line_item_unblended_cost > 0
            ${this.usageOnlyFilter}
            ${this.targetAccountFilter}
        `;
        const fbRows = await this.runAthenaQuery(fallbackSql);
        return fbRows.map(r => ({
          user: r.user_name,
          cost: Number(r.total_usd || 0),
          cost_cents: Number(r.total_cents || 0),
          resources: Number(r.resource_count || 0),
          resourcesList: r.resources_csv ? r.resources_csv.split(',').filter(Boolean) : []
        }));
      }
      return [];
    }
  }

  async getResourceCosts() {
    try {
      const { Start: startStr, End: endStr } = this.getEffectiveDateRange(1);

      const sql = `
        SELECT COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown') AS service, date_format(line_item_usage_start_date, '%Y-%m-%d') AS day,
               SUM( COALESCE(line_item_unblended_cost, 0) ) AS daily_cost, COUNT(DISTINCT line_item_resource_id) AS resource_count
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${startStr}' AND date(line_item_usage_start_date) <= DATE '${endStr}'
          AND line_item_resource_id IS NOT NULL AND COALESCE(line_item_product_code, '') <> ''
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown'), date_format(line_item_usage_start_date, '%Y-%m-%d')
        ORDER BY service, day;
      `;
      const rows = await this.runAthenaQuery(sql);
      const serviceMap = {};
      const uniqueDays = [...new Set(rows.map(r => r.day))].sort();

      rows.forEach(r => {
        const s = this.serviceNameMap[r.service] || r.service || 'Unknown';
        if (!serviceMap[s]) serviceMap[s] = { type: s, dailyTrend: uniqueDays.map(() => 0), cost: 0, count: 0 };
        const dayIndex = uniqueDays.indexOf(r.day);
        serviceMap[s].dailyTrend[dayIndex] = Number(r.daily_cost || 0);
        serviceMap[s].cost += Number(r.daily_cost || 0);
        serviceMap[s].count += Number(r.resource_count || 0);
      });
      return Object.values(serviceMap).map(item => ({ ...item, trend: item.dailyTrend })).sort((a, b) => b.cost - a.cost).slice(0, 10);
    } catch (err) { throw err; }
  }

  async getProjectCosts({ billingPeriod = null, fullMonth = false } = {}) {
    let Start, End;
    if (billingPeriod) {
      const [y, m] = billingPeriod.split('-').map(x => parseInt(x, 10));
      Start = new Date(y, m - 1, 1).toISOString().split('T')[0];
      const endD = new Date(y, m, 1); endD.setDate(0);
      End = endD.toISOString().split('T')[0];
    } else {
      ({ Start, End } = this.getEffectiveDateRange(1));
    }

    const sqlPrimary = `
      WITH project_sums AS (
        SELECT
          COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id) AS resource_id,
          NULLIF(TRIM(element_at(resource_tags, 'user:Project')), '') AS user_project,
          SUM(COALESCE(line_item_unblended_cost, 0)) AS project_cost, COUNT(*) AS project_rows
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
          AND (line_item_unblended_cost IS NOT NULL) AND NULLIF(TRIM(element_at(resource_tags, 'user:Project')), '') IS NOT NULL
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
        GROUP BY COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id), NULLIF(TRIM(element_at(resource_tags, 'user:Project')), '')
      ),
      project_ranked AS (
        SELECT resource_id, user_project, project_cost, project_rows, ROW_NUMBER() OVER (PARTITION BY resource_id ORDER BY project_cost DESC, project_rows DESC) AS rn
        FROM project_sums
      ),
      project_lookup AS ( SELECT resource_id, user_project AS inferred_project FROM project_ranked WHERE rn = 1 ),
      resolved AS (
        SELECT
          COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) AS resource_id,
          NULLIF(TRIM(element_at(t.resource_tags, 'user:Project')), '') AS explicit_project, l.inferred_project,
          COALESCE(NULLIF(TRIM(element_at(t.resource_tags, 'user:Project')), ''), l.inferred_project) AS resolved_project,
          COALESCE(t.line_item_unblended_cost, 0) AS usd_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable} t
        LEFT JOIN project_lookup l ON COALESCE(NULLIF(TRIM(t.line_item_resource_id), ''), t.identity_line_item_id) = l.resource_id
        WHERE date(t.line_item_usage_start_date) >= DATE '${Start}' AND date(t.line_item_usage_start_date) <= DATE '${End}'
          AND (t.line_item_unblended_cost IS NOT NULL)
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
      )
      SELECT
        COALESCE(resolved_project, '<UNMAPPED>') AS project_tag, SUM(usd_cost) AS total_usd, SUM(CAST(ROUND(usd_cost * 100, 0) AS BIGINT)) AS total_cents,
        COUNT(DISTINCT resource_id) AS resource_count, COUNT(*) AS rows, array_agg(DISTINCT resource_id) AS resources_array, array_join(array_agg(DISTINCT resource_id), ',') AS resources_csv
      FROM resolved GROUP BY COALESCE(resolved_project, '<UNMAPPED>') ORDER BY total_cents DESC LIMIT 500;
    `;

    try {
      const rows = await this.runAthenaQuery(sqlPrimary);
      return rows.map(r => ({ project: r.project_tag, cost: Number(r.total_usd || 0), cost_cents: Number(r.total_cents || 0), resources: Number(r.resource_count || 0), resourcesList: r.resources_array || null, resources_csv: r.resources_csv || null }));
    } catch (err) {
      if (err.message && (err.message.includes('COLUMN_NOT_FOUND') || err.message.includes('TABLE_NOT_FOUND') || err.message.includes('cannot be resolved'))) {
        const fallbackSql = `
          SELECT
            '<UNMAPPED>' AS project_tag, SUM(COALESCE(line_item_unblended_cost, 0)) AS total_usd, SUM(CAST(ROUND(COALESCE(line_item_unblended_cost, 0) * 100, 0) AS BIGINT)) AS total_cents,
            COUNT(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)) AS resource_count, COUNT(*) AS rows,
            array_agg(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)) AS resources_array,
            array_join(array_agg(DISTINCT COALESCE(NULLIF(TRIM(line_item_resource_id), ''), identity_line_item_id)), ',') AS resources_csv
          FROM ${this.athenaDatabase}.${this.athenaCurTable}
          WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
            AND (line_item_unblended_cost IS NOT NULL)
            ${this.usageOnlyFilter}
            ${this.targetAccountFilter}
        `;
        const fbRows = await this.runAthenaQuery(fallbackSql);
        return fbRows.map(r => ({ project: r.project_tag, cost: Number(r.total_usd || 0), cost_cents: Number(r.total_cents || 0), resources: Number(r.resource_count || 0), resourcesList: r.resources_array || null, resources_csv: r.resources_csv || null }));
      }
      return [];
    }
  }

  async getTopSpendingResources() {
    try {
      const regionExpr = `
        COALESCE(
          NULLIF(trim(product_region_code), ''),
          CASE
            WHEN strpos(line_item_resource_id, ':') > 0
            THEN NULLIF(split_part(line_item_resource_id, ':', 4), '')
            ELSE NULL
          END,
          NULLIF(regexp_extract(line_item_availability_zone, '^([a-z]+-[a-z]+-[0-9]+)', 1), ''),
          'unknown'
        ) AS region
      `;
  
      const resourceTypeExpr = `
        CASE
          WHEN strpos(line_item_resource_id, ':') > 0 THEN split_part(split_part(line_item_resource_id, ':', 6), '/', 1)
          WHEN line_item_resource_id LIKE 'i-%' THEN 'ec2-instance'
          WHEN line_item_resource_id LIKE 'vol-%' THEN 'ebs-volume'
          WHEN line_item_resource_id LIKE 'snap-%' THEN 'ebs-snapshot'
          WHEN line_item_resource_id LIKE 'nat-%' THEN 'natgateway'
          ELSE 'other'
        END AS resource_type
      `;
  
      const whereClause = `
        WHERE date(line_item_usage_start_date) >= (current_date - interval '30' day)
          AND (line_item_resource_id IS NOT NULL OR identity_line_item_id IS NOT NULL)
          AND trim(COALESCE(line_item_resource_id, identity_line_item_id, '')) <> ''
          ${this.usageOnlyFilter}
          ${this.targetAccountFilter}
      `;
  
      const mapRow = (r, includeAccountName) => ({
        service: r.service || 'Unknown',
        resource_type: r.resource_type || 'other',
        region: r.region || 'unknown',
        resource_id: r.resource_id || r.raw_resource_id || 'unknown',
        raw_resource_id: r.raw_resource_id || null,
        account_id: r.line_item_usage_account_id || 'Unknown',
        account_name: includeAccountName ? (r.account_name || null) : null,
        total_cost: Number(r.total_cost || 0),
      });
  
      const sqlPrimary = `
        SELECT
            COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown') AS service,
            ${resourceTypeExpr},
            ${regionExpr},
            COALESCE(regexp_extract(trim(line_item_resource_id), '([^/]+)$', 1), NULLIF(trim(line_item_resource_id), ''), identity_line_item_id) AS resource_id,
            COALESCE(NULLIF(trim(line_item_resource_id), ''), identity_line_item_id) AS raw_resource_id,
            line_item_usage_account_id,
            MAX(line_item_usage_account_name) AS account_name,
            SUM(COALESCE(line_item_unblended_cost, 0)) AS total_cost
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        ${whereClause}
        GROUP BY 1, 2, 3, 4, 5, 6
        ORDER BY total_cost DESC
        LIMIT 10;
      `;
  
      try {
        const rows = await this.runAthenaQuery(sqlPrimary);
        return (rows || []).map(r => mapRow(r, true));
      } catch (err) {
        if (err.message && err.message.includes('COLUMN_NOT_FOUND')) {
          const sqlFallback = `
            SELECT
                COALESCE(element_at(product, 'product_name'), line_item_product_code, 'Unknown') AS service,
                ${resourceTypeExpr},
                ${regionExpr},
                COALESCE(regexp_extract(trim(line_item_resource_id), '([^/]+)$', 1), NULLIF(trim(line_item_resource_id), ''), identity_line_item_id) AS resource_id,
                COALESCE(NULLIF(trim(line_item_resource_id), ''), identity_line_item_id) AS raw_resource_id,
                line_item_usage_account_id,
                SUM(COALESCE(line_item_unblended_cost, 0)) AS total_cost
            FROM ${this.athenaDatabase}.${this.athenaCurTable}
            ${whereClause}
            GROUP BY 1, 2, 3, 4, 5, 6
            ORDER BY total_cost DESC
            LIMIT 10;
          `;
          const fbRows = await this.runAthenaQuery(sqlFallback);
          return (fbRows || []).map(r => mapRow(r, false));
        }
        throw err;
      }
    } catch (err) { return []; }
  }

  // FIXED: Added getCarbonFootprint to fetch directly from the new carbon_model table
  async getCarbonFootprint() {
    try {
      const sql = `
        SELECT 
            region_code AS region,
            SUM(COALESCE(total_lbm_emissions_value, 0)) AS emissions,
            COUNT(DISTINCT product_code) AS count
        FROM ${this.athenaDatabase}.carbon_model_version_v3_0_0
        WHERE region_code IS NOT NULL AND TRIM(region_code) <> ''
          ${this.targetAccountId ? `AND (usage_account_id = '${this.targetAccountId}' OR payer_account_id = '${this.targetAccountId}')` : ''}
        GROUP BY region_code
        ORDER BY emissions DESC;
      `;
      const rows = await this.runAthenaQuery(sql);
      return rows.map(r => ({
        region: r.region,
        emissions: Number(r.emissions || 0),
        count: Number(r.count || 0)
      }));
    } catch (err) {
      console.warn(`[costService] Carbon Footprint table might not exist yet or failed: ${err.message}`);
      return []; // Return empty array so the main dashboard doesn't crash if the table is missing
    }
  }

  getResourceTypeForService(serviceName) {
    const serviceToResourceType = {
      'Amazon Elastic Compute Cloud - Compute': 'ec2:instance', 'EC2 - Other': 'ec2', 'Amazon Relational Database Service': 'rds:db',
      'Amazon Simple Storage Service': 's3:bucket', 'Amazon Elastic Kubernetes Service': 'eks:cluster', 'Amazon WorkSpaces': 'workspaces:workspace',
      'Amazon CloudWatch': 'cloudwatch:dashboard', 'AmazonCloudWatch': 'cloudwatch:dashboard', 'AWS Secrets Manager': 'secretsmanager:secret',
      'AWS Key Management Service': 'kms:key', 'AWS Config': 'config:rule', 'Amazon Route 53': 'route53:hostedzone',
      'Amazon Elastic Container Registry': 'ecr:repository', 'Amazon API Gateway': 'apigateway:restapis', 'AWS Systems Manager': 'ssm:managed-instance',
      'Amazon DynamoDB': 'dynamodb:table', 'Amazon Location Service': 'location:geofence-collection', 'Amazon Elastic File System': 'efs:file-system',
      'AWS Backup': 'backup:backup-vault', 'Amazon Simple Queue Service': 'sqs:queue', 'AWS Lambda': 'lambda:function', 'AWS Storage Gateway': 'storagegateway:gateway',
    };
    return serviceToResourceType[serviceName] || null;
  }
}

export default CostService;