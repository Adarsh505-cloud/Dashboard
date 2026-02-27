import boto3
import csv
import os
from datetime import datetime

# --- Safe environment variable reader ---
def get_env_str(name, default=None, required=False):
    """
    Safely read an environment variable and coerce lists/tuples to strings.
    Raises RuntimeError if required and missing.
    """
    val = os.environ.get(name, default)
    if isinstance(val, (list, tuple)):
        val = ",".join(map(str, val))
    if val is None and required:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return str(val) if val is not None else val

# --- Configuration ---
client_name = 'Titans-Sandbox'
# ✅ FIXED: remove tuple, use plain string
local_root = '/Users/adarsh/Carbon-test/'  # where to store files locally

# Initialize Cost Optimization Hub client
client = boto3.client('cost-optimization-hub', region_name='us-east-1')

# Date folder (YYYYMM)
current_date = datetime.now().strftime('%Y%m')

# Ensure all parts are strings
client_name = str(client_name)
local_root = str(local_root)
current_date = str(current_date)

# Build folder path safely
folder_path = os.path.join(local_root, client_name, current_date)
print("DEBUG: folder_path =", folder_path)

# Ensure directory exists
os.makedirs(folder_path, exist_ok=True)

# Local CSV path
csv_filename = os.path.join(folder_path, f'{client_name}_recommendations.csv')

# Open CSV and write rows
with open(csv_filename, 'w', newline='') as csvfile:
    csv_writer = csv.writer(csvfile)

    header = [
        'Account ID', 'Action Type', 'Currency Code', 'Current Resource Summary',
        'Current Resource Type', 'Estimated Monthly Cost', 'Estimated Monthly Savings',
        'Estimated Savings Percentage', 'Implementation Effort', 'Last Refresh Timestamp',
        'Recommendation ID', 'Recommendation Lookback Period In Days',
        'Recommended Resource Summary', 'Recommended Resource Type', 'Region',
        'Resource ARN', 'Resource ID', 'Restart Needed', 'Rollback Possible',
        'Source', 'Tags'
    ]
    csv_writer.writerow(header)

    recommendations_filter = {
        'actionTypes': ['Rightsize', 'Stop', 'Upgrade', 'PurchaseSavingsPlans',
                        'PurchaseReservedInstances', 'MigrateToGraviton'],
        'implementationEfforts': ['VeryLow', 'Low', 'Medium', 'High', 'VeryHigh'],
        'resourceTypes': ['Ec2Instance', 'LambdaFunction', 'EbsVolume', 'EcsService',
                          'Ec2AutoScalingGroup', 'Ec2InstanceSavingsPlans', 'ComputeSavingsPlans',
                          'SageMakerSavingsPlans', 'Ec2ReservedInstances', 'RdsReservedInstances',
                          'OpenSearchReservedInstances', 'RedshiftReservedInstances', 'ElastiCacheReservedInstances'],
    }

    paginator = client.get_paginator('list_recommendations')
    page_iterator = paginator.paginate(
        filter=recommendations_filter,
        includeAllRecommendations=True
    )

    for page in page_iterator:
        if page.get('ResponseMetadata', {}).get('HTTPStatusCode') != 200:
            continue
        for item in page.get('items', []):
            row = [
                item.get('accountId'), item.get('actionType'), item.get('currencyCode'),
                item.get('currentResourceSummary'), item.get('currentResourceType'),
                item.get('estimatedMonthlyCost'), item.get('estimatedMonthlySavings'),
                item.get('estimatedSavingsPercentage'), item.get('implementationEffort'),
                item.get('lastRefreshTimestamp'), item.get('recommendationId'),
                item.get('recommendationLookbackPeriodInDays'),
                item.get('recommendedResourceSummary'), item.get('recommendedResourceType'),
                item.get('region'), item.get('resourceArn'), item.get('resourceId'),
                item.get('restartNeeded'), item.get('rollbackPossible'),
                item.get('source'), item.get('tags')
            ]
            csv_writer.writerow(row)

# Log the local path for reference
print(f'Results exported to local file: {csv_filename}')
