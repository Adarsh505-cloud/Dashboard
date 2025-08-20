# AWS Cost Analysis Backend

A secure Node.js backend service that integrates with real AWS APIs to provide comprehensive cost analysis and optimization recommendations.

## Features

- **Real AWS Integration**: Connects to AWS Cost Explorer, CloudWatch, and Resource Groups APIs
- **Secure Role Assumption**: Uses IAM roles for secure AWS access
- **Comprehensive Cost Analysis**: 
  - Total monthly costs from actual billing data
  - Service-wise breakdown with real usage
  - Region-wise costs from actual deployments
  - User-based tracking via resource tags
  - Project-based costs via tagging
  - Resource type analysis with real counts
- **Real Cost Optimization Recommendations**:
  - Idle resource detection using CloudWatch metrics
  - Oversized resource identification with actual utilization data
  - Unused resource cleanup based on real resource states
  - Storage optimization opportunities from actual usage patterns
- **Enhanced Error Handling**:
  - Detailed AWS-specific error messages
  - Troubleshooting suggestions
  - Permission validation feedback

## Prerequisites

1. **AWS Account** with Cost Explorer enabled
2. **IAM Role** with comprehensive permissions (see below)
3. **Node.js** 18+ installed
4. **Cost and Billing data** available in your AWS account

## Required IAM Permissions

Create an IAM role with these permissions for comprehensive cost analysis:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ce:GetCostAndUsage",
        "ce:GetDimensionValues",
        "ce:GetReservationCoverage",
        "ce:GetReservationPurchaseRecommendation",
        "ce:GetReservationUtilization",
        "ce:GetUsageReport",
        "ce:ListCostCategoryDefinitions",
        "ce:GetCostCategories"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricStatistics",
        "cloudwatch:ListMetrics",
        "cloudwatch:GetMetricData"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "resource-groups:GetResources",
        "resource-groups:ListGroups",
        "tag:GetResources",
        "tag:GetTagKeys",
        "tag:GetTagValues"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeInstances",
        "ec2:DescribeVolumes",
        "rds:DescribeDBInstances",
        "s3:ListAllMyBuckets"
      ],
      "Resource": "*"
    }
  ]
}
```

**Trust Policy** (replace YOUR_ACCOUNT_ID):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:root"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

## Installation

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   AWS_REGION=us-east-1
   PORT=3001
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

3. **Start the server**:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status and environment information.

### Comprehensive Cost Analysis
```
POST /api/cost/analysis
Content-Type: application/json

{
  "accountId": "123456789012",
  "roleArn": "arn:aws:iam::123456789012:role/CostAnalysisRole"
}
```
Returns complete cost analysis including all metrics and recommendations.

### Individual Endpoints
- `POST /api/cost/services` - Service-wise cost breakdown
- `POST /api/cost/users` - User-based costs via tags
- `POST /api/cost/projects` - Project-based costs via tags
- `POST /api/cost/recommendations` - Cost optimization recommendations

## Data Sources

### Real AWS Data Integration

1. **Cost Explorer API**:
   - Monthly cost totals from actual billing
   - Service-wise cost breakdown
   - Regional cost distribution
   - Tag-based cost allocation

2. **CloudWatch Metrics**:
   - EC2 CPU utilization for idle detection
   - RDS performance metrics for rightsizing
   - Real resource utilization data

3. **Resource Groups Tagging API**:
   - Actual resource counts by type
   - Tag-based user and project mapping
   - Resource metadata and specifications

4. **Cost Optimization**:
   - Real idle resource detection using metrics
   - Actual oversized resource identification
   - Genuine unused resource discovery
   - Storage optimization based on usage patterns

## Error Handling

The API provides detailed error responses with troubleshooting guidance:

```json
{
  "success": false,
  "error": "Access denied. Your IAM role lacks the necessary permissions.",
  "code": "ACCESS_DENIED",
  "suggestion": "Ensure your IAM role has the following policies attached: CostExplorerServiceRolePolicy, CloudWatchReadOnlyAccess, ResourceGroupsandTagEditorReadOnlyAccess",
  "details": "The role exists but does not have sufficient permissions to access Cost Explorer, CloudWatch, or Resource Groups APIs."
}
```

### Common Error Codes:
- `INVALID_CREDENTIALS`: Invalid AWS credentials or expired tokens
- `ACCESS_DENIED`: Insufficient IAM permissions
- `UNAUTHORIZED_OPERATION`: Missing specific service permissions
- `RATE_LIMITED`: AWS API rate limits exceeded
- `DATA_UNAVAILABLE`: Cost data not yet available
- `NETWORK_ERROR`: Connection issues to AWS services

## Data Accuracy

### Cost Data
- **Source**: AWS Cost Explorer API (official billing data)
- **Accuracy**: 100% accurate to your actual AWS bill
- **Latency**: Cost data typically available within 24 hours
- **Granularity**: Monthly, daily, and hourly breakdowns available

### Resource Data
- **Source**: AWS Resource Groups Tagging API
- **Accuracy**: Real-time resource inventory
- **Metadata**: Actual resource specifications and tags
- **Coverage**: All tagged resources across supported services

### Metrics Data
- **Source**: AWS CloudWatch API
- **Accuracy**: Real performance metrics from your resources
- **Resolution**: Up to 1-minute granularity for detailed analysis
- **Retention**: Historical data for trend analysis

## Troubleshooting

### Common Issues

1. **"Invalid AWS credentials"**
   - Verify Account ID is exactly 12 digits
   - Check Role ARN format: `arn:aws:iam::ACCOUNT:role/ROLE_NAME`
   - Ensure role exists and is assumable

2. **"Access denied"**
   - Attach required IAM policies to your role
   - Verify trust policy allows assume role action
   - Check if Cost Explorer is enabled in your account

3. **"Data unavailable"**
   - Cost data may take 24 hours to appear
   - Ensure you have actual AWS usage to analyze
   - Check if the requested time period has data

4. **"No resources found"**
   - Verify resources exist in the specified regions
   - Check if resources are properly tagged
   - Ensure Resource Groups API permissions

### Validation Steps

1. **Test IAM Role**:
   ```bash
   aws sts assume-role --role-arn YOUR_ROLE_ARN --role-session-name test
   ```

2. **Verify Cost Explorer Access**:
   ```bash
   aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost
   ```

3. **Check Resource Access**:
   ```bash
   aws resourcegroupstaggingapi get-resources --resource-type-filters ec2:instance
   ```

## Performance Considerations

- **API Limits**: AWS APIs have rate limits; the backend implements appropriate throttling
- **Data Volume**: Large accounts may take longer to analyze; consider pagination for UI
- **Caching**: Consider implementing caching for frequently accessed data
- **Parallel Processing**: Multiple API calls are made in parallel where possible

## Security Best Practices

- **Never expose AWS credentials** in frontend code
- **Use IAM roles** with minimal required permissions
- **Enable CloudTrail** to audit API access
- **Monitor API usage** and set up billing alerts
- **Use HTTPS** in production environments
- **Implement request validation** and rate limiting

## Deployment

For production deployment:

1. **Environment Configuration**
   - Set production environment variables
   - Configure proper logging
   - Set up monitoring and alerting

2. **Infrastructure**
   - Use process manager (PM2, systemd)
   - Set up reverse proxy (nginx)
   - Enable HTTPS with valid certificates

3. **Monitoring**
   - Monitor API response times
   - Track error rates and types
   - Set up AWS cost alerts
   - Monitor IAM role usage

4. **Scaling**
   - Consider load balancing for high traffic
   - Implement caching strategies
   - Use connection pooling for database connections

## Contributing

When contributing to this project:

1. **Test with real AWS data** to ensure accuracy
2. **Follow AWS best practices** for API usage
3. **Add comprehensive error handling** for new features
4. **Update documentation** for any API changes
5. **Consider cost implications** of new API calls