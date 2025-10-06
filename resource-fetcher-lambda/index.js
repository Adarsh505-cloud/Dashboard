import { CostService } from './costService.js';

export const handler = async (event) => {
  try {
    const { accountId, roleArn, serviceName } = event;

    if (!accountId || !roleArn || !serviceName) {
      throw new Error('Missing required parameters: accountId, roleArn, or serviceName');
    }

    console.log(`Fetching resources for service: ${serviceName}`);

    const costService = new CostService(accountId, roleArn);
    const resources = await costService.getResourcesForService(serviceName);

    console.log(`Successfully fetched ${resources.length} resources.`);

    return {
      success: true,
      data: resources,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error in heavy worker Lambda:', error.toString());
    return {
      success: false,
      error: 'An error occurred while fetching resources.',
      details: error.message
    };
  }
};