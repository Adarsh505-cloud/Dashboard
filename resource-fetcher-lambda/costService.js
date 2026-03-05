// resource-fetcher-lambda/costService.js
// Robust Athena wrapper with short synchronous polling to avoid API Gateway 29s timeouts,
// graceful fallbacks and defensive error handling.

import { AthenaClient, StartQueryExecutionCommand, GetQueryExecutionCommand, GetQueryResultsCommand } from "@aws-sdk/client-athena";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";

export class CostService {
  constructor(accountId, roleArn) {
    this.accountId = String(accountId).trim();
    this.roleArn = String(roleArn).trim();
    this.region = process.env.ATHENA_REGION || 'us-east-1';
    
    const rawBucket = `s3://cost-analyzer-results-${this.accountId}-${this.region}/`;
    this.athenaOutput = process.env.ATHENA_OUTPUT_S3 || rawBucket.toLowerCase();

    this.athenaDatabase = process.env.ATHENA_DATABASE || 'aws_cost_analysis_db';
    this.athenaCurTable = process.env.ATHENA_CUR_TABLE || 'data';
    this.athenaWorkGroup = process.env.ATHENA_WORKGROUP || undefined;

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

  async getCredentials() {
    return fromTemporaryCredentials({
      params: { RoleArn: this.roleArn, RoleSessionName: `cost-analysis-${Date.now()}`, DurationSeconds: 3600 }
    })();
  }

  async getAthenaClient() {
    const creds = await this.getCredentials();
    return new AthenaClient({ region: this.region, credentials: creds });
  }

  async startQuery(client, sql, database = this.athenaDatabase, workGroup = this.athenaWorkGroup) {
    let lastErr;
    for (let attempt = 1; attempt <= this.START_RETRY_MAX; attempt++) {
      try {
        const cmd = new StartQueryExecutionCommand({
          QueryString: sql, ResultConfiguration: { OutputLocation: this.athenaOutput },
          QueryExecutionContext: { Database: database }, WorkGroup: workGroup
        });
        const res = await client.send(cmd);
        if (res && res.QueryExecutionId) return res.QueryExecutionId;
        lastErr = new Error('No QueryExecutionId returned');
      } catch (err) {
        lastErr = err;
        const backoff = 300 * attempt;
        console.warn(`[costService] startQuery attempt ${attempt} failed, retrying in ${backoff}ms`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }
    throw lastErr || new Error('StartQueryExecution failed (unknown)');
  }

  async runAthenaQuery(sql, { database = this.athenaDatabase, workGroup = this.athenaWorkGroup } = {}) {
    const client = await this.getAthenaClient();
    console.log('[costService] runAthenaQuery SQL:', sql.slice(0, 1000).replace(/\s+/g,' ') + (sql.length > 1000 ? '... (truncated)' : ''));
    const startTime = Date.now();
    let QueryExecutionId;
    try {
      QueryExecutionId = await this.startQuery(client, sql, database, workGroup);
    } catch (err) {
      return { rows: [], queryExecutionId: null, finished: false, state: 'FAILED_TO_START', error: String(err && err.message || err) };
    }

    const getExecCmd = new GetQueryExecutionCommand({ QueryExecutionId });
    while (Date.now() - startTime < this.ATHENA_POLL_MS) {
      try {
        const execRes = await client.send(getExecCmd);
        const state = execRes?.QueryExecution?.Status?.State;
        if (state === 'SUCCEEDED') {
          const rows = [];
          let header = [];
          let nextToken;
          do {
            const getRes = await client.send(new GetQueryResultsCommand({ QueryExecutionId, NextToken: nextToken }));
            const rsRows = (getRes?.ResultSet?.Rows) || [];
            if (rows.length === 0 && rsRows.length > 0 && rsRows[0].Data.some(d => d.VarCharValue)) {
              header = rsRows.shift().Data.map(d => d.VarCharValue ? d.VarCharValue.trim() : '');
            }
            rsRows.forEach(r => {
              const obj = {};
              r.Data.forEach((d, i) => { if (header[i]) obj[header[i]] = d.VarCharValue || null; });
              rows.push(obj);
            });
            nextToken = getRes.NextToken;
          } while (nextToken);
          const normalized = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v && /^-?\d+(\.\d+)?(E[-+]?\d+)?$/i.test(v) ? Number(v) : v])));
          return { rows: normalized, queryExecutionId: QueryExecutionId, finished: true, state: 'SUCCEEDED' };
        }
        if (state === 'FAILED' || state === 'CANCELLED') {
          const reason = execRes?.QueryExecution?.Status?.StateChangeReason || 'unknown';
          console.warn(`[costService] Athena query ${QueryExecutionId} ended with state ${state}: ${reason}`);
          return { rows: [], queryExecutionId: QueryExecutionId, finished: true, state, reason };
        }
      } catch (err) {
        console.warn('[costService] Athena polling error (will retry until poll window ends)');
      }
      await new Promise(r => setTimeout(r, this.ATHENA_POLL_INTERVAL_MS));
    }
    console.warn(`[costService] Athena poll window expired after ${this.ATHENA_POLL_MS}ms for QueryExecutionId=${QueryExecutionId}. Returning early.`);
    return { rows: [], queryExecutionId: QueryExecutionId, finished: false, state: 'RUNNING' };
  }

  getDateRange(months = 1) {
    const end = new Date(); end.setDate(end.getDate() - 1);
    const start = new Date(end); start.setMonth(end.getMonth() - (months - 1)); start.setDate(1);
    const fmt = d => d.toISOString().split('T')[0];
    return { Start: fmt(start), End: fmt(end) };
  }

  chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  safeValuesForIds(ids) {
    return ids.map(id => `('${String(id).replace(/'/g, "''")}')`).join(',\n');
  }

  normalizeActorString(actor) {
    if (!actor) return null;
    const s = String(actor).trim().replace(/\r?\n/g, ' ');
    if (s.includes('/')) return s.split('/').pop().trim();
    if (s.includes(':')) return s.split(':').pop().trim();
    return s;
  }

  toIsoSafe(ts) {
    if (!ts) return null;
    try {
      if (ts instanceof Date) return ts.toISOString();
      const s = String(ts).trim();
      if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(s)) {
        const t = s.replace(' ', 'T');
        return (new Date(t + (/[zZ]|[+\-]\d{2}:\d{2}$/.test(s) ? '' : 'Z'))).toISOString();
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d.toISOString();
    } catch (e) {}
    return null;
  }

  async getCreationEventsForResources(resourceIds = []) {
    const out = new Map();
    if (!resourceIds || resourceIds.length === 0) return out;
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    for (const chunk of chunks) {
      const vals = this.safeValuesForIds(chunk);
      const sql = `
        WITH target_ids (id) AS ( VALUES ${vals} )
        SELECT t.id AS target_id, c.first_create, c.sample_creator_arn, c.sample_creator_username
        FROM target_ids t
        LEFT JOIN ( SELECT resource_short AS target_id, first_create, sample_creator_arn, sample_creator_username FROM ${this.athenaDatabase}.resource_creation_map ) c
        ON lower(c.target_id) = lower(t.id)
      `;
      try {
        const res = await this.runAthenaQuery(sql);
        if (res.state === 'SUCCEEDED' && Array.isArray(res.rows)) {
          res.rows.forEach(r => {
            if (!r || !r.target_id) return;
            let createdBy = null;
            if (r.sample_creator_username) createdBy = String(r.sample_creator_username).trim();
            else if (r.sample_creator_arn) createdBy = this.normalizeActorString(r.sample_creator_arn);
            out.set(String(r.target_id), { createdDate: r.first_create ? this.toIsoSafe(r.first_create) : null, createdBy: createdBy || 'Not found in creation map' });
          });
        }
      } catch (err) {}
    }
    return out;
  }

  async getDeletionEventsForResources(resourceIds = []) {
    const out = new Map();
    if (!resourceIds || resourceIds.length === 0) return out;
    const chunks = this.chunkArray(resourceIds, this.bulkChunkSize);
    for (const chunk of chunks) {
      const vals = this.safeValuesForIds(chunk);
      const sql = `
        WITH target_ids (id) AS ( VALUES ${vals} )
        SELECT t.id AS target_id, d.last_delete, d.sample_deleter_arn, d.sample_deleter_username
        FROM target_ids t
        LEFT JOIN ( SELECT resource_short AS target_id, last_delete, sample_deleter_arn, sample_deleter_username FROM ${this.athenaDatabase}.resource_deletion_map ) d
        ON lower(d.target_id) = lower(t.id)
      `;
      try {
        const res = await this.runAthenaQuery(sql);
        if (res.state === 'SUCCEEDED' && Array.isArray(res.rows)) {
          res.rows.forEach(r => {
            if (!r || !r.target_id) return;
            let deletedBy = null;
            if (r.sample_deleter_username) deletedBy = String(r.sample_deleter_username).trim();
            else if (r.sample_deleter_arn) deletedBy = this.normalizeActorString(r.sample_deleter_arn);
            out.set(String(r.target_id), { deletionDate: r.last_delete ? this.toIsoSafe(r.last_delete) : null, deletedBy: deletedBy || 'Not found in deletion map' });
          });
        }
      } catch (err) {}
    }
    return out;
  }

  async getResourcesForService(serviceName, targetAccountId = null) {
    try {
      const { Start, End } = this.getDateRange(1); // FIXED: Fetching Start and End dates for current month
      const candidateCodes = new Set([serviceName]);
      for (const [code, friendly] of Object.entries(this.serviceNameMap)) {
        if (friendly.toLowerCase() === String(serviceName).toLowerCase()) candidateCodes.add(code);
      }
      const codesArr = Array.from(candidateCodes).map(c => `'${c.replace(/'/g, "''")}'`).join(',');
      const targetAccountFilter = targetAccountId ? `AND line_item_usage_account_id = '${String(targetAccountId).replace(/'/g, "''")}'` : '';

      // Primary Attempt: With Element_At (Map tags) and Current Month dates
      let sql = `
        SELECT
            line_item_resource_id, 
            COALESCE(line_item_product_code, 'Unknown') AS product_code, 
            product_location,
            SUM(COALESCE(line_item_unblended_cost, 0)) AS total_cost, 
            MAX(element_at(resource_tags, 'user:Owner')) AS owner_tag,
            MAX(element_at(resource_tags, 'user:Project')) AS project_tag
        FROM ${this.athenaDatabase}.${this.athenaCurTable}
        WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
          AND line_item_resource_id IS NOT NULL 
          AND TRIM(line_item_resource_id) <> ''
          AND COALESCE(line_item_product_code, 'Unknown') IN (${codesArr})
          ${targetAccountFilter}
        GROUP BY 1, 2, 3
        ORDER BY 4 DESC;
      `;

      let baseRes = await this.runAthenaQuery(sql);

      // Fallback Attempt: Drop tags entirely if column does not exist (Using Current Month dates)
      if (baseRes.state === 'FAILED' && baseRes.reason && (baseRes.reason.includes('COLUMN_NOT_FOUND') || baseRes.reason.includes('TABLE_NOT_FOUND') || baseRes.reason.includes('cannot be resolved'))) {
        console.warn(`[costService] resource_tags column missing! Executing fallback query...`);
        sql = `
          SELECT
              line_item_resource_id, 
              COALESCE(line_item_product_code, 'Unknown') AS product_code, 
              product_location,
              SUM(COALESCE(line_item_unblended_cost, 0)) AS total_cost
          FROM ${this.athenaDatabase}.${this.athenaCurTable}
          WHERE date(line_item_usage_start_date) >= DATE '${Start}' AND date(line_item_usage_start_date) <= DATE '${End}'
            AND line_item_resource_id IS NOT NULL 
            AND TRIM(line_item_resource_id) <> ''
            AND COALESCE(line_item_product_code, 'Unknown') IN (${codesArr})
            ${targetAccountFilter}
          GROUP BY 1, 2, 3
          ORDER BY 4 DESC;
        `;
        baseRes = await this.runAthenaQuery(sql);
      }

      if (!baseRes.finished && baseRes.queryExecutionId) {
        return [];
      }
      
      const rows = baseRes.rows || [];
      const resourceIds = rows.map(r => r.line_item_resource_id).filter(Boolean);

      const [creationMap, deletionMap] = await Promise.all([
        this.getCreationEventsForResources(resourceIds),
        this.getDeletionEventsForResources(resourceIds)
      ]);

      return rows.map(r => {
        const c = creationMap.get(r.line_item_resource_id) || {};
        const d = deletionMap.get(r.line_item_resource_id) || {};

        const tags = [];
        if (r.owner_tag) tags.push({ key: 'user_owner', value: r.owner_tag });
        if (r.project_tag) tags.push({ key: 'user_project', value: r.project_tag });

        const owner = r.owner_tag || c.createdBy || 'Unknown';
        const project = r.project_tag || 'Unassigned';
        const status = d.deletionDate ? 'terminated' : 'running';

        return {
          id: r.line_item_resource_id,
          name: r.line_item_resource_id,
          type: this.serviceNameMap[r.product_code] || r.product_code,
          region: r.product_location || 'unknown',
          owner,
          project,
          createdDate: c.createdDate || null,
          createdBy: c.createdBy || null,
          status,
          deletionDate: d.deletionDate || null,
          deletedBy: d.deletedBy || null,
          cost: Number(r.total_cost || 0),
          tags,
          specifications: {}
        };
      });
    } catch (err) {
      return [];
    }
  }
}

export default CostService;