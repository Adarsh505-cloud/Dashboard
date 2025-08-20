export const errorHandler = (error, req, res, next) => {
  console.error('❌ Error:', error);

  // AWS SDK errors
  if (error.name === 'InvalidClientTokenId' || error.message?.includes('InvalidClientTokenId')) {
    return res.status(401).json({
      success: false,
      error: 'Invalid AWS credentials. The security token is invalid or expired.',
      code: 'INVALID_CREDENTIALS',
      suggestion: 'Please verify your AWS Account ID and IAM Role ARN are correct and that the role has the necessary permissions.',
      details: 'The provided credentials could not be validated by AWS. Check that your Account ID is exactly 12 digits and your Role ARN follows the format: arn:aws:iam::ACCOUNT:role/ROLE_NAME'
    });
  }

  if (error.name === 'AccessDenied' || error.message?.includes('AccessDenied')) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Your IAM role lacks the necessary permissions.',
      code: 'ACCESS_DENIED',
      suggestion: 'Ensure your IAM role has the following policies attached: CostExplorerServiceRolePolicy, CloudWatchReadOnlyAccess, ResourceGroupsandTagEditorReadOnlyAccess',
      details: 'The role exists but does not have sufficient permissions to access Cost Explorer, CloudWatch, or Resource Groups APIs.'
    });
  }

  if (error.name === 'UnauthorizedOperation' || error.message?.includes('UnauthorizedOperation')) {
    return res.status(403).json({
      success: false,
      error: 'Unauthorized operation. Missing required permissions.',
      code: 'UNAUTHORIZED_OPERATION',
      suggestion: 'Add the required permissions to your IAM role for the specific AWS service being accessed.',
      details: error.message
    });
  }

  if (error.name === 'InvalidParameterException' || error.message?.includes('InvalidParameterException')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid parameters provided to AWS service.',
      code: 'INVALID_PARAMETERS',
      details: error.message
    });
  }

  if (error.name === 'ThrottlingException' || error.message?.includes('ThrottlingException')) {
    return res.status(429).json({
      success: false,
      error: 'AWS API rate limit exceeded. Please try again later.',
      code: 'RATE_LIMITED',
      suggestion: 'Wait a few minutes before retrying. Consider implementing exponential backoff in your requests.'
    });
  }

  if (error.name === 'DataUnavailableException' || error.message?.includes('DataUnavailableException')) {
    return res.status(404).json({
      success: false,
      error: 'Cost data is not available for the requested time period.',
      code: 'DATA_UNAVAILABLE',
      suggestion: 'Cost data may not be available immediately. Try requesting data for a different time period or wait for AWS to process recent usage.'
    });
  }

  // Network/timeout errors
  if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      error: 'Unable to connect to AWS services. Please check your network connection.',
      code: 'NETWORK_ERROR',
      suggestion: 'Verify your internet connection and that AWS services are accessible from your network.'
    });
  }

  // Credential provider errors
  if (error.message?.includes('Could not load credentials') || error.message?.includes('credential')) {
    return res.status(401).json({
      success: false,
      error: 'Failed to assume the specified IAM role.',
      code: 'CREDENTIAL_ERROR',
      suggestion: 'Verify that the IAM role exists, is assumable, and has a trust policy that allows the assume role action.',
      details: error.message
    });
  }

  // Cost Explorer specific errors
  if (error.message?.includes('Cost Explorer')) {
    return res.status(400).json({
      success: false,
      error: 'Cost Explorer API error.',
      code: 'COST_EXPLORER_ERROR',
      suggestion: 'Ensure Cost Explorer is enabled in your AWS account and you have the necessary permissions.',
      details: error.message
    });
  }

  // Resource Groups API errors
  if (error.message?.includes('Resource Groups')) {
    return res.status(400).json({
      success: false,
      error: 'Resource Groups API error.',
      code: 'RESOURCE_GROUPS_ERROR',
      suggestion: 'Verify that you have permissions to access the Resource Groups Tagging API.',
      details: error.message
    });
  }

  // CloudWatch API errors
  if (error.message?.includes('CloudWatch')) {
    return res.status(400).json({
      success: false,
      error: 'CloudWatch API error.',
      code: 'CLOUDWATCH_ERROR',
      suggestion: 'Ensure you have CloudWatch read permissions and the metrics exist for the specified resources.',
      details: error.message
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    code: 'INTERNAL_ERROR',
    suggestion: 'If this error persists, please check the server logs for more details.',
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
};