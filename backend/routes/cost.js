import express from 'express';
import { validateCredentials, validateResourceRequest } from '../middleware/validation.js';
import { CostService } from '../services/costService.js';
import { RecommendationService } from '../services/recommendationService.js';

const router = express.Router();

// Get comprehensive cost analysis
// Get comprehensive cost analysis
router.post('/analysis', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    
    const costService = new CostService(accountId, roleArn);
    const recommendationService = new RecommendationService(accountId, roleArn);
    
    // Fetch all cost data in parallel (we collect results array to be robust)
    const results = await Promise.all([
      costService.getTotalMonthlyCost(),   // 0
      costService.getServiceCosts(),       // 1
      costService.getRegionCosts(),        // 2
      costService.getUserCosts(),          // 3
      costService.getResourceCosts(),      // 4
      costService.getProjectCosts(),       // 5
      recommendationService.getRecommendations(), // 6
      costService.getCostTrendData(),      // 7
      costService.getDailyCostData(),      // 8
      costService.getWeeklyCostData(),     // 9
      costService.getTopSpendingResources()// 10  <-- ensure we capture this
    ]);

    // Destructure and provide safe defaults where useful
    const [
      totalCost,
      serviceCosts,
      regionCosts,
      userCosts,
      resourceCosts,
      projectCosts,
      recommendations,
      costTrendData,
      dailyCostData,
      weeklyCostData,
      topSpendingResourcesRaw
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
        topSpendingResources
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get specific cost breakdown
router.post('/services', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const serviceCosts = await costService.getServiceCosts();
    
    res.json({
      success: true,
      data: serviceCosts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get user-based costs
router.post('/users', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const userCosts = await costService.getUserCosts();
    
    res.json({
      success: true,
      data: userCosts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get project-based costs
router.post('/projects', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const projectCosts = await costService.getProjectCosts();
    
    res.json({
      success: true,
      data: projectCosts,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get cost optimization recommendations
router.post('/recommendations', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const recommendationService = new RecommendationService(accountId, roleArn);
    
    const recommendations = await recommendationService.getRecommendations();
    
    res.json({
      success: true,
      data: recommendations,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get cost trend data
router.post('/trend', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const costTrendData = await costService.getCostTrendData();
    
    res.json({
      success: true,
      data: costTrendData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get daily cost data
router.post('/daily', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const dailyCostData = await costService.getDailyCostData();
    
    res.json({
      success: true,
      data: dailyCostData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get weekly cost data
router.post('/weekly', validateCredentials, async (req, res, next) => {
  try {
    const { accountId, roleArn } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const weeklyCostData = await costService.getWeeklyCostData();
    
    res.json({
      success: true,
      data: weeklyCostData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Get detailed resources for a specific service
router.post('/resources', validateResourceRequest, async (req, res, next) => {
  try {
    const { accountId, roleArn, serviceName } = req.body;
    const costService = new CostService(accountId, roleArn);
    
    const resources = await costService.getResourcesForService(serviceName);
    
    res.json({
      success: true,
      data: resources,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});


export default router;