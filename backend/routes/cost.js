import express from 'express';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import { validateCredentials, validateResourceRequest } from '../middleware/validation.js';
import { CostService } from '../services/costService.js';
import { RecommendationService } from '../services/recommendationService.js';

const router = express.Router();
const lambdaClient = new LambdaClient({});

const CACHE_TTL_MS = 8 * 60 * 60 * 1000; // 8 Hours
// Bump this version whenever query logic changes to auto-invalidate stale caches
const CACHE_VERSION = 'v3';

/**
 * S3 Cache Wrapper: Intercepts the request and serves from S3 if fresh (< 8 hours).
 * When custom date ranges are provided, they are included in the cache key so
 * different date selections produce separate cache entries.
 */
async function getCachedData(accountId, roleArn, cacheKey, fetchCallback) {
  const region = process.env.ATHENA_REGION || 'us-east-1';

  // 1. Get the raw string from .env or fallback
  let rawPath = process.env.ATHENA_OUTPUT_S3 || `s3://cost-analyzer-results-${accountId}-${region}/`;

  // 2. Safely replace literal string placeholders if they exist in the .env variable
  rawPath = rawPath.replace(/\$\{this\.accountId\}/gi, accountId)
                     .replace(/\$\{this\.accountid\}/gi, accountId)
                     .replace(/\$\{accountId\}/gi, accountId)
                     .replace(/\$\{this\.region\}/gi, region)
                     .replace(/\$\{region\}/gi, region);

  // 3. Extract the final clean bucket name
  const bucketName = rawPath.toLowerCase().replace(/['"]/g, '').trim().replace('s3://', '').split('/')[0];
  const objectKey = `dashboard-cache/${CACHE_VERSION}/${cacheKey}.json`;

  const credentials = await fromTemporaryCredentials({
    params: { RoleArn: roleArn, RoleSessionName: `cache-read-${Date.now()}`, DurationSeconds: 3600 }
  })();

  const s3 = new S3Client({ region, credentials });

  // Try to read from Cache
  try {
    const getRes = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: objectKey }));
    const age = Date.now() - getRes.LastModified.getTime();
    if (age < CACHE_TTL_MS) {
      console.log(`[Cache] HIT for ${cacheKey} (Age: ${Math.round(age / 60000)}m)`);
      const body = await getRes.Body.transformToString();
      return JSON.parse(body);
    } else {
      console.log(`[Cache] EXPIRED for ${cacheKey}`);
    }
  } catch (err) {
    console.log(`[Cache] MISS for ${cacheKey}`);
  }

  // Cache Miss or Expired -> Run the heavy Athena queries
  console.log(`[Cache] Fetching fresh data for ${cacheKey}...`);
  const freshData = await fetchCallback();

  // Save the fresh results back to S3 in the background
  try {
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      Body: JSON.stringify(freshData),
      ContentType: 'application/json'
    }));
    console.log(`[Cache] SAVED fresh data to s3://${bucketName}/${objectKey}`);
  } catch (err) {
    console.error(`[Cache] FAILED to save ${cacheKey} to bucket '${bucketName}':`, err.message);
  }

  return freshData;
}

/**
 * Build a date-aware cache key suffix.
 * If custom dates are provided, include them so different date ranges get separate caches.
 */
function buildDateSuffix(startDate, endDate) {
  if (startDate && endDate) {
    return `_${startDate}_${endDate}`;
  }
  return '_default';
}

router.post('/analysis', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId, accountType, startDate, endDate } = req.body;

    const dateSuffix = buildDateSuffix(startDate, endDate);
    const cacheKey = `analysis_${accountId}_${targetAccountId || 'master'}${dateSuffix}`;

    const data = await getCachedData(accountId, roleArn, cacheKey, async () => {
      const costService = new CostService(accountId, roleArn, targetAccountId, { startDate, endDate });
      const recommendationService = new RecommendationService(accountId, roleArn, targetAccountId);

      const results = await Promise.all([
        costService.getTotalMonthlyCost(), costService.getServiceCosts(),
        costService.getRegionCosts(), costService.getUserCosts(),
        costService.getResourceCosts(), costService.getProjectCosts(),
        recommendationService.getRecommendations(), costService.getCostTrendData(),
        costService.getDailyCostData(), costService.getWeeklyCostData(),
        costService.getTopSpendingResources(),
        (accountType === 'master' && !targetAccountId) ? costService.getLinkedAccountsSummary() : Promise.resolve([]),
        costService.getCarbonFootprint()
      ]);

      return {
        totalMonthlyCost: results[0] != null ? results[0] : 0,
        serviceCosts: results[1] || [],
        regionCosts: results[2] || [],
        userCosts: results[3] || [],
        resourceCosts: results[4] || [],
        projectCosts: results[5] || [],
        recommendations: results[6] || [],
        costTrendData: results[7] || [],
        dailyCostData: results[8] || [],
        weeklyCostData: results[9] || [],
        topSpendingResources: Array.isArray(results[10]) ? results[10] : [],
        linkedAccountsSummary: results[11] || [],
        carbonFootprint: results[12] || []
      };
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/services', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const cacheKey = `services_${accountId}_${targetAccountId || 'master'}`;

    const data = await getCachedData(accountId, roleArn, cacheKey, async () => {
      const costService = new CostService(accountId, roleArn, targetAccountId);
      return await costService.getServiceCosts();
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/users', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const cacheKey = `users_${accountId}_${targetAccountId || 'master'}`;

    const data = await getCachedData(accountId, roleArn, cacheKey, async () => {
      const costService = new CostService(accountId, roleArn, targetAccountId);
      return await costService.getUserCosts();
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/projects', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const cacheKey = `projects_${accountId}_${targetAccountId || 'master'}`;

    const data = await getCachedData(accountId, roleArn, cacheKey, async () => {
      const costService = new CostService(accountId, roleArn, targetAccountId);
      return await costService.getProjectCosts();
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/recommendations', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const cacheKey = `recommendations_${accountId}_${targetAccountId || 'master'}`;

    const data = await getCachedData(accountId, roleArn, cacheKey, async () => {
      const recommendationService = new RecommendationService(accountId, roleArn, targetAccountId);
      return await recommendationService.getRecommendations();
    });

    res.json({ success: true, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/resources', validateResourceRequest, async (req, res, next) => {
  try {
    const { accountId, roleArn, serviceName, targetAccountId } = req.body;
    const command = new InvokeCommand({
      FunctionName: process.env.HEAVY_LAMBDA_FUNCTION_NAME || 'resource-fetcher-lambda',
      Payload: JSON.stringify({ accountId, roleArn, serviceName, targetAccountId }),
      InvocationType: 'RequestResponse',
    });

    console.log(`Invoking heavy worker lambda: ${command.input.FunctionName}`);
    const { Payload } = await lambdaClient.send(command);
    const result = JSON.parse(Buffer.from(Payload).toString());

    if (result.errorMessage || result.success === false) {
      console.error("Error from heavy worker lambda:", result);
      throw new Error(result.details || result.error || 'The resource-fetcher Lambda failed.');
    }
    res.json(result);
  } catch (err) {
    console.error("Error invoking heavy worker lambda:", err);
    next(err);
  }
});

export default router;