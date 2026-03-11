// backend/routes/cost.js
import express from 'express';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { validateCredentials, validateResourceRequest } from '../middleware/validation.js';
import { CostService } from '../services/costService.js';
import { RecommendationService } from '../services/recommendationService.js';

const router = express.Router();
const lambdaClient = new LambdaClient({});

router.post('/analysis', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId, accountType } = req.body;
    
    const costService = new CostService(accountId, roleArn, targetAccountId);
    const recommendationService = new RecommendationService(accountId, roleArn, targetAccountId);

    const results = await Promise.all([
      costService.getTotalMonthlyCost(), costService.getServiceCosts(),
      costService.getRegionCosts(), costService.getUserCosts(),
      costService.getResourceCosts(), costService.getProjectCosts(),
      recommendationService.getRecommendations(), costService.getCostTrendData(),
      costService.getDailyCostData(), costService.getWeeklyCostData(),
      costService.getTopSpendingResources(),
      (accountType === 'master' && !targetAccountId) ? costService.getLinkedAccountsSummary() : Promise.resolve([]),
      costService.getCarbonFootprint() // FIXED: Call the new Carbon Footprint method
    ]);

    const [
      totalCost, serviceCosts, regionCosts, userCosts, resourceCosts,
      projectCosts, recommendations, costTrendData, dailyCostData,
      weeklyCostData, topSpendingResourcesRaw, linkedAccountsSummary,
      carbonFootprint // FIXED: Capture the results
    ] = results;

    const topSpendingResources = Array.isArray(topSpendingResourcesRaw) ? topSpendingResourcesRaw : [];

    res.json({
      success: true,
      data: {
        totalMonthlyCost: totalCost != null ? totalCost : 0, 
        serviceCosts: serviceCosts || [],
        regionCosts: regionCosts || [], 
        userCosts: userCosts || [],
        resourceCosts: resourceCosts || [], 
        projectCosts: projectCosts || [],
        recommendations: recommendations || [], 
        costTrendData: costTrendData || [],
        dailyCostData: dailyCostData || [], 
        weeklyCostData: weeklyCostData || [],
        topSpendingResources,
        linkedAccountsSummary: linkedAccountsSummary || [],
        carbonFootprint: carbonFootprint || [] // FIXED: Return it to the frontend
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) { next(error); }
});

router.post('/services', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const costService = new CostService(accountId, roleArn, targetAccountId);
    res.json({ success: true, data: await costService.getServiceCosts(), timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/users', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const costService = new CostService(accountId, roleArn, targetAccountId);
    res.json({ success: true, data: await costService.getUserCosts(), timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/projects', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const costService = new CostService(accountId, roleArn, targetAccountId);
    res.json({ success: true, data: await costService.getProjectCosts(), timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
});

router.post('/recommendations', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn, targetAccountId } = req.body;
    const recommendationService = new RecommendationService(accountId, roleArn, targetAccountId);
    res.json({ success: true, data: await recommendationService.getRecommendations(), timestamp: new Date().toISOString() });
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