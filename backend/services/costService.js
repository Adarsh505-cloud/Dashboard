import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from '@aws-sdk/client-cost-explorer';
import {
  ResourceGroupsTaggingAPIClient,
  GetResourcesCommand,
} from '@aws-sdk/client-resource-groups-tagging-api';
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers';
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
    }

    async getCredentials() {
        return fromTemporaryCredentials({
            params: {
                RoleArn: this.roleArn,
                RoleSessionName: `cost-analysis-${Date.now()}`,
                DurationSeconds: 3600,
            },
        });
    }

    async getCostExplorerClient() {
        const credentials = await this.getCredentials();
        return new CostExplorerClient({ region: this.region, credentials });
    }

    async getResourceGroupsClient() {
        const credentials = await this.getCredentials();
        return new ResourceGroupsTaggingAPIClient({ region: this.region, credentials });
    }
    
    async getEc2Client() {
        const credentials = await this.getCredentials();
        return new EC2Client({ region: this.region, credentials });
    }

    getDateRange(months = 1) {
        const endDate = new Date();
        const startDate = new Date();
        if (months === 1) {
            startDate.setDate(1);
        } else {
            startDate.setMonth(startDate.getMonth() - months);
            startDate.setDate(1);
        }
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            return `${year}-${month}-${day}`;
        };
        const start = formatDate(startDate);
        const end = formatDate(endDate);
        console.log(`📅 Date range (Corrected): ${start} to ${end}`);
        return { Start: start, End: end };
    }
    
    // --- START: COST ANALYSIS FUNCTIONS ---
    
    async getDailyCostData() {
        try {
            const client = await this.getCostExplorerClient();
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            const formatDate = (date) => date.toISOString().split('T')[0];
            const timePeriod = { Start: formatDate(startDate), End: formatDate(endDate) };

            console.log(`📊 Fetching daily cost data from ${timePeriod.Start} to ${timePeriod.End}`);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'DAILY',
                Metrics: ['BlendedCost'],
                GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
            });
            const response = await client.send(command);
            const dailyData = response.ResultsByTime || [];
            console.log(`✅ Retrieved ${dailyData.length} days of cost data`);
            return dailyData;
        } catch (error) {
            console.error('❌ Error fetching daily cost data:', error.message);
            throw new Error(`Failed to fetch daily cost data: ${error.message}`);
        }
    }

    async getWeeklyCostData() {
        try {
            const client = await this.getCostExplorerClient();
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (12 * 7));
            const formatDate = (date) => date.toISOString().split('T')[0];
            const timePeriod = { Start: formatDate(startDate), End: formatDate(endDate) };

            console.log(`📊 Fetching weekly cost data from ${timePeriod.Start} to ${timePeriod.End}`);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'DAILY',
                Metrics: ['BlendedCost'],
                GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
            });
            const response = await client.send(command);
            const dailyData = response.ResultsByTime || [];
            const weeklyData = [];
            for (let i = 0; i < dailyData.length; i += 7) {
                const weekData = dailyData.slice(i, i + 7);
                if (weekData.length === 0) continue;
                const weekStart = new Date(weekData[0].TimePeriod.Start);
                const weekEnd = new Date(weekData[weekData.length - 1].TimePeriod.End);
                const weekServices = {};
                weekData.forEach(day => {
                    day.Groups?.forEach(group => {
                        const service = group.Keys?.[0] || 'Unknown';
                        const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
                        weekServices[service] = (weekServices[service] || 0) + cost;
                    });
                });
                const weekGroups = Object.entries(weekServices).map(([service, cost]) => ({
                    Keys: [service],
                    Metrics: { BlendedCost: { Amount: cost.toString() } }
                }));
                weeklyData.push({
                    TimePeriod: { Start: weekStart.toISOString().split('T')[0], End: weekEnd.toISOString().split('T')[0] },
                    Groups: weekGroups
                });
            }
            console.log(`✅ Processed ${weeklyData.length} weeks of cost data`);
            return weeklyData;
        } catch (error) {
            console.error('❌ Error fetching weekly cost data:', error.message);
            throw new Error(`Failed to fetch weekly cost data: ${error.message}`);
        }
    }

    async getCostTrendData() {
        try {
            const client = await this.getCostExplorerClient();
            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 6);
            startDate.setDate(1);
            const formatDate = (date) => date.toISOString().split('T')[0];
            const timePeriod = { Start: formatDate(startDate), End: formatDate(endDate) };

            console.log(`📊 Fetching cost trend data from ${timePeriod.Start} to ${timePeriod.End}`);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'MONTHLY',
                Metrics: ['BlendedCost'],
            });
            const response = await client.send(command);
            const monthlyData = response.ResultsByTime || [];
            const trendData = monthlyData.map(month => {
                const cost = parseFloat(month.Total?.BlendedCost?.Amount || '0');
                const startDate = new Date(month.TimePeriod.Start);
                const monthName = startDate.toLocaleDateString('en-US', { month: 'short' });
                return { month: monthName, cost: cost, period: month.TimePeriod };
            });
            console.log('✅ Cost trend data:', trendData.map(d => `${d.month}: $${d.cost.toFixed(2)}`));
            return trendData;
        } catch (error) {
            console.error('❌ Error fetching cost trend data:', error);
            throw new Error(`Failed to fetch cost trend data: ${error.message}`);
        }
    }
    
    async getTotalMonthlyCost() {
        try {
            const client = await this.getCostExplorerClient();
            const timePeriod = this.getDateRange(1);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'MONTHLY',
                Metrics: ['BlendedCost'],
            });
            const response = await client.send(command);
            const totalCost = response.ResultsByTime?.[0]?.Total?.BlendedCost?.Amount || '0';
            const roundedCost = parseFloat(totalCost).toFixed(2);
            console.log('✅ Total monthly cost fetched:', roundedCost);
            return parseFloat(roundedCost);
        } catch (error) {
            console.error('❌ Error fetching total monthly cost:', error);
            throw new Error(`Failed to fetch total monthly cost: ${error.message}`);
        }
    }

    async getServiceCosts() {
        try {
            const client = await this.getCostExplorerClient();
            const timePeriod = this.getDateRange(1);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'MONTHLY',
                Metrics: ['BlendedCost'],
                GroupBy: [
                    { Type: 'DIMENSION', Key: 'SERVICE' },
                    { Type: 'DIMENSION', Key: 'REGION' },
                ],
            });
            const response = await client.send(command);
            const groups = response.ResultsByTime?.[0]?.Groups || [];
            const serviceCosts = groups
                .map(group => ({
                    service: group.Keys?.[0] || 'Unknown',
                    region: group.Keys?.[1] || 'NoRegion',
                    cost: parseFloat(group.Metrics?.BlendedCost?.Amount || '0'),
                }))
                .filter(item => item.cost > 0)
                .sort((a, b) => b.cost - a.cost);
            console.log('✅ Service costs fetched:', serviceCosts.length, 'line items');
            return serviceCosts;
        } catch (error) {
            console.error('❌ Error fetching service costs:', error);
            throw new Error(`Failed to fetch service costs: ${error.message}`);
        }
    }

    async getRegionCosts() {
        try {
            const client = await this.getCostExplorerClient();
            const timePeriod = this.getDateRange(1);
            const command = new GetCostAndUsageCommand({
                TimePeriod: timePeriod,
                Granularity: 'MONTHLY',
                Metrics: ['BlendedCost'],
                GroupBy: [{ Type: 'DIMENSION', Key: 'REGION' }],
            });
            const response = await client.send(command);
            const groups = response.ResultsByTime?.[0]?.Groups || [];
            const regionCosts = groups
                .map(group => ({
                    region: group.Keys?.[0] || 'Unknown',
                    cost: parseFloat(group.Metrics?.BlendedCost?.Amount || '0'),
                }))
                .filter(item => item.cost > 0 && item.region !== 'NoRegion')
                .sort((a, b) => b.cost - a.cost);
            console.log('✅ Region costs fetched:', regionCosts.length, 'regions');
            return regionCosts;
        } catch (error) {
            console.error('❌ Error fetching region costs:', error);
            throw new Error(`Failed to fetch region costs: ${error.message}`);
        }
    }
    
    async getUserCosts() {
      try {
        console.log('🔍 Fetching user costs using Resource Groups API...');
        const resourceClient = await this.getResourceGroupsClient();
        const userTags = ['Owner', 'User', 'CreatedBy', 'Team', 'Department'];
        let userCosts = [];
        for (const tagKey of userTags) {
          try {
            const command = new GetResourcesCommand({ TagFilters: [{ Key: tagKey }] });
            const response = await resourceClient.send(command);
            const resources = response.ResourceTagMappingList || [];
            if (resources.length > 0) {
              console.log(`✅ Found ${resources.length} resources with ${tagKey} tag`);
              const userResourceMap = {};
              resources.forEach(resource => {
                const userTag = resource.Tags?.find(tag => tag.Key === tagKey);
                if (userTag && userTag.Value) {
                  const user = userTag.Value;
                  if (!userResourceMap[user]) userResourceMap[user] = [];
                  userResourceMap[user].push(resource);
                }
              });
              userCosts = Object.entries(userResourceMap).map(([user, userResources]) => ({
                user,
                cost: this.estimateResourcesCost(userResources),
                resources: userResources.length,
              }));
              break; 
            }
          } catch (tagError) {
            console.log(`⚠️ No resources found for tag ${tagKey}:`, tagError.message);
            continue;
          }
        }
        const sortedUserCosts = userCosts.filter(item => item.cost > 0).sort((a, b) => b.cost - a.cost);
        console.log('✅ User costs processed:', sortedUserCosts.length, 'users');
        return sortedUserCosts;
      } catch (error) {
        console.error('❌ Error fetching user costs:', error);
        return [];
      }
    }
  
    async getResourceCosts() {
      try {
        console.log('🔍 Fetching resource costs with real daily trends...');
        const dailyCostData = await this.getDailyCostData();
        const serviceData = {};
        dailyCostData.forEach((dayData, dayIndex) => {
          dayData.Groups?.forEach(group => {
            const service = group.Keys?.[0] || 'Unknown';
            const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');
            if (!serviceData[service]) {
              serviceData[service] = { type: service, dailyTrend: new Array(30).fill(0), cost: 0, count: 0 };
            }
            serviceData[service].dailyTrend[dayIndex] = cost;
            serviceData[service].cost += cost;
          });
        });
        const resourceClient = await this.getResourceGroupsClient();
        const resourceCosts = [];
        for (const [serviceName, data] of Object.entries(serviceData)) {
          if (data.cost > 0) {
            try {
              const resourceType = this.getResourceTypeForService(serviceName);
              if (resourceType) {
                const resourceCommand = new GetResourcesCommand({ ResourceTypeFilters: [resourceType] });
                const resourceResponse = await resourceClient.send(resourceCommand);
                data.count = resourceResponse.ResourceTagMappingList?.length || 0;
              }
            } catch (resourceError) {
              console.log(`⚠️ Could not get resource count for ${serviceName}`);
              data.count = 0;
            }
            resourceCosts.push({ ...data, trend: data.dailyTrend });
          }
        }
        const sortedResourceCosts = resourceCosts.sort((a, b) => b.cost - a.cost).slice(0, 10);
        console.log('✅ Resource costs processed with real daily data:', sortedResourceCosts.length, 'resource types');
        return sortedResourceCosts;
      } catch (error) {
        console.error('❌ Error fetching resource costs:', error);
        throw new Error(`Failed to fetch resource costs: ${error.message}`);
      }
    }
  
    async getProjectCosts() {
      try {
        console.log('🔍 Fetching project costs using Resource Groups API...');
        const resourceClient = await this.getResourceGroupsClient();
        const projectTags = ['Project', 'Application', 'Environment', 'Workload'];
        let projectCosts = [];
        for (const tagKey of projectTags) {
          try {
            const command = new GetResourcesCommand({ TagFilters: [{ Key: tagKey }] });
            const response = await resourceClient.send(command);
            const resources = response.ResourceTagMappingList || [];
            if (resources.length > 0) {
              console.log(`✅ Found ${resources.length} resources with ${tagKey} tag`);
              const projectResourceMap = {};
              resources.forEach(resource => {
                const projectTag = resource.Tags?.find(tag => tag.Key === tagKey);
                if (projectTag && projectTag.Value) {
                  const project = projectTag.Value;
                  if (!projectResourceMap[project]) projectResourceMap[project] = [];
                  projectResourceMap[project].push(resource);
                }
              });
              projectCosts = Object.entries(projectResourceMap).map(([project, projectResources]) => {
                const owners = {};
                projectResources.forEach(resource => {
                  const ownerTag = resource.Tags?.find(tag => tag.Key === 'Owner');
                  if (ownerTag && ownerTag.Value) owners[ownerTag.Value] = (owners[ownerTag.Value] || 0) + 1;
                });
                const owner = Object.keys(owners).length > 0 ? Object.keys(owners).reduce((a, b) => owners[a] > owners[b] ? a : b) : 'Unknown';
                return { project, cost: this.estimateResourcesCost(projectResources), resources: projectResources.length, owner };
              });
              break;
            }
          } catch (tagError) {
            console.log(`⚠️ No resources found for tag ${tagKey}:`, tagError.message);
            continue;
          }
        }
        const sortedProjectCosts = projectCosts.filter(item => item.cost > 0).sort((a, b) => b.cost - a.cost);
        console.log('✅ Project costs processed:', sortedProjectCosts.length, 'projects');
        return sortedProjectCosts;
      } catch (error) {
        console.error('❌ Error fetching project costs:', error);
        return [];
      }
    }
  
    estimateResourcesCost(resources) {
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
    
    // --- END: COST ANALYSIS FUNCTIONS ---
    
    // --- START: RESOURCE FETCHING FUNCTIONS ---
    async getResourcesForService(serviceName) {
        console.log(`🔍 Fetching real resources for: ${serviceName}`);
        const credentials = await this.getCredentials();
        let resources = [];
    
        const ec2BaseClient = new EC2Client({ region: 'us-east-1', credentials });
        const regionsResponse = await ec2BaseClient.send(new DescribeRegionsCommand({}));
        const allRegions = regionsResponse.Regions.map(r => r.RegionName);
        console.log(`🌍 Discovered ${allRegions.length} available AWS regions.`);
    
        const processInAllRegions = async (serviceCall) => {
            await Promise.all(allRegions.map(async (region) => {
                try {
                    await serviceCall(region);
                } catch (e) {
                    if (e.name !== 'AuthFailure' && e.name !== 'UnrecognizedClientException' && e.name !== 'AccessDeniedException' && !e.message.includes("is not supported in this region")) {
                        console.log(`⚠️  Could not scan region ${region} for ${serviceName}: ${e.name}`);
                    }
                }
            }));
        };

        const paginate = async (client, command, outputKey, inputTokenKey = 'NextToken', outputTokenKey = 'NextToken') => {
            let results = [];
            let token;
            do {
                const response = await client.send(new command.constructor({ ...command.input, [inputTokenKey]: token }));
                results = results.concat(response[outputKey] || []);
                token = response[outputTokenKey];
            } while (token);
            return results;
        };
    
        switch (serviceName) {
            case 'Amazon Elastic Compute Cloud - Compute':
            case 'EC2 - Other':
                await processInAllRegions(async (region) => {
                    const ec2 = new EC2Client({ region, credentials });
                    const data = await ec2.send(new DescribeInstancesCommand({}));
                    data.Reservations.forEach(r => r.Instances.forEach(i => resources.push({ id: i.InstanceId, name: (i.Tags.find(t => t.Key === 'Name') || {}).Value || i.InstanceId, region, status: i.State.Name, specifications: { type: i.InstanceType }, tags: i.Tags || [] })));
                });
                break;
            case 'Amazon Relational Database Service':
                 await processInAllRegions(async (region) => {
                    const rds = new RDSClient({ region, credentials });
                    const data = await rds.send(new DescribeDBInstancesCommand({}));
                    data.DBInstances.forEach(db => resources.push({ id: db.DBInstanceIdentifier, name: db.DBInstanceIdentifier, region, status: db.DBInstanceStatus, specifications: { type: db.DBInstanceClass }, tags: db.TagList || [] }));
                });
                break;
            case 'Amazon Simple Storage Service': {
                const s3 = new S3Client({ region: 'us-east-1', credentials });
                const data = await s3.send(new ListBucketsCommand({}));
                data.Buckets.forEach(b => resources.push({ id: b.Name, name: b.Name, region: 'Global', status: 'Active', specifications: { created: b.CreationDate.toISOString() }, tags: [] }));
                break;
            }
            case 'Amazon Elastic Kubernetes Service':
                await processInAllRegions(async (region) => {
                    const eks = new EKSClient({ region, credentials });
                    const data = await eks.send(new ListClustersCommand({}));
                    data.clusters.forEach(c => resources.push({ id: c, name: c, region, status: 'Active', specifications: {}, tags: [] }));
                });
                break;
            case 'Amazon WorkSpaces':
                 await processInAllRegions(async (region) => {
                    const client = new WorkSpacesClient({ region, credentials });
                    
                    // 1. Fetch Individual Workspaces
                    const workspacesData = await client.send(new DescribeWorkspacesCommand({}));
                    workspacesData.Workspaces.forEach(ws => resources.push({ 
                        id: ws.WorkspaceId, 
                        name: ws.UserName || ws.WorkspaceId, 
                        region, 
                        status: ws.State, 
                        specifications: { subType: 'Workspace', bundleId: ws.BundleId, ipAddress: ws.IpAddress }, 
                        tags: ws.Tags || [] 
                    }));

                    // 2. Fetch Workspace Bundles (Templates/Pools)
                    const bundlesData = await client.send(new DescribeWorkspaceBundlesCommand({}));
                    bundlesData.Bundles.forEach(b => resources.push({
                        id: b.BundleId,
                        name: b.Name,
                        region,
                        status: 'Available',
                        specifications: { subType: 'Bundle', owner: b.Owner, compute: b.ComputeType.Name, storage: b.UserStorage.Capacity },
                        tags: b.Tags || []
                    }));

                    // 3. Fetch Workspace Directories
                    const directoriesData = await client.send(new DescribeWorkspaceDirectoriesCommand({}));
                    directoriesData.Directories.forEach(d => resources.push({
                        id: d.DirectoryId,
                        name: d.DirectoryName,
                        region,
                        status: d.State,
                        specifications: { subType: 'Directory', type: d.DirectoryType, dns: d.DnsIpAddresses.join(', ') },
                        tags: d.Tags || []
                    }));
                });
                break;
            case 'AmazonCloudWatch':
            case 'Amazon CloudWatch':
                 await processInAllRegions(async (region) => {
                     const cw = new CloudWatchClient({ region, credentials });
                     const data = await cw.send(new ListDashboardsCommand({}));
                     data.DashboardEntries.forEach(d => resources.push({ id: d.DashboardName, name: d.DashboardName, region, status: 'Active', specifications: { size: d.Size }, tags: [] }));
                 });
                 break;
            case 'AWS Secrets Manager':
                await processInAllRegions(async (region) => {
                    const client = new SecretsManagerClient({ region, credentials });
                    const command = new ListSecretsCommand({});
                    const secrets = await paginate(client, command, 'SecretList');
                    secrets.forEach(s => resources.push({ id: s.ARN, name: s.Name, region, status: 'Active', specifications: { lastChanged: s.LastChangedDate }, tags: s.Tags || [] }));
                });
                break;
            case 'AWS Key Management Service':
                await processInAllRegions(async (region) => {
                    const client = new KMSClient({ region, credentials });
                    const command = new ListKeysCommand({});
                    const keys = await paginate(client, command, 'Keys');
                    keys.forEach(k => resources.push({ id: k.KeyId, name: k.KeyArn, region, status: 'Enabled', specifications: { keyId: k.KeyId }, tags: [] }));
                });
                break;
            case 'AWS Config':
                await processInAllRegions(async (region) => {
                    const client = new ConfigServiceClient({ region, credentials });
                    const data = await client.send(new DescribeConfigRulesCommand({}));
                    data.ConfigRules.forEach(r => resources.push({ id: r.ConfigRuleId, name: r.ConfigRuleName, region, status: r.ConfigRuleState, specifications: {}, tags: [] }));
                });
                break;
            case 'Amazon Route 53': { // Global service
                const client = new Route53Client({ region: 'us-east-1', credentials });
                const command = new ListHostedZonesCommand({});
                const zones = await paginate(client, command, 'HostedZones', 'Marker', 'NextMarker');
                zones.forEach(z => resources.push({ id: z.Id, name: z.Name, region: 'Global', status: 'Active', specifications: { isPrivate: z.Config.PrivateZone, resourceCount: z.ResourceRecordSetCount }, tags: [] }));
                break;
            }
            case 'Amazon Elastic Container Registry':
                await processInAllRegions(async (region) => {
                    const client = new ECRClient({ region, credentials });
                    const command = new DescribeRepositoriesCommand({});
                    const repos = await paginate(client, command, 'repositories');
                    repos.forEach(r => resources.push({ id: r.repositoryArn, name: r.repositoryName, region, status: 'Active', specifications: { uri: r.repositoryUri }, tags: [] }));
                });
                break;
            case 'Amazon API Gateway':
                await processInAllRegions(async (region) => {
                    const client = new ApiGatewayV2Client({ region, credentials });
                    const data = await client.send(new GetApisCommand({}));
                    data.Items.forEach(api => resources.push({ id: api.ApiId, name: api.Name, region, status: 'Active', specifications: { protocol: api.ProtocolType }, tags: api.Tags ? Object.entries(api.Tags).map(([k, v]) => ({ Key: k, Value: v })) : [] }));
                });
                break;
            case 'AWS Systems Manager':
                await processInAllRegions(async (region) => {
                    const client = new SSMClient({ region, credentials });
                    const command = new DescribeInstanceInformationCommand({});
                    const instances = await paginate(client, command, 'InstanceInformationList');
                    instances.forEach(i => resources.push({ id: i.InstanceId, name: i.ComputerName || i.InstanceId, region, status: i.PingStatus, specifications: { platform: i.PlatformName }, tags: [] }));
                });
                break;
            case 'Amazon DynamoDB':
                await processInAllRegions(async (region) => {
                    const client = new DynamoDBClient({ region, credentials });
                    const command = new ListTablesCommand({});
                    const tables = await paginate(client, command, 'TableNames', 'ExclusiveStartTableName', 'LastEvaluatedTableName');
                    tables.forEach(t => resources.push({ id: t, name: t, region, status: 'Active', specifications: {}, tags: [] }));
                });
                break;
            case 'Amazon Location Service':
                await processInAllRegions(async (region) => {
                    const client = new LocationClient({ region, credentials });
                    const data = await client.send(new ListGeofenceCollectionsCommand({}));
                    data.Entries.forEach(gc => resources.push({ id: gc.CollectionName, name: gc.CollectionName, region, status: 'Active', specifications: { description: gc.Description }, tags: [] }));
                });
                break;
            case 'Amazon Elastic File System':
                await processInAllRegions(async (region) => {
                    const client = new EFSClient({ region, credentials });
                    const command = new DescribeFileSystemsCommand({});
                    const filesystems = await paginate(client, command, 'FileSystems', 'Marker', 'NextMarker');
                    filesystems.forEach(fs => resources.push({ id: fs.FileSystemId, name: fs.Name || fs.FileSystemId, region, status: fs.LifeCycleState, specifications: { performanceMode: fs.PerformanceMode }, tags: fs.Tags || [] }));
                });
                break;
            case 'AWS Backup':
                await processInAllRegions(async (region) => {
                    const client = new BackupClient({ region, credentials });
                    const command = new ListBackupVaultsCommand({});
                    const vaults = await paginate(client, command, 'BackupVaultList');
                    vaults.forEach(v => resources.push({ id: v.BackupVaultArn, name: v.BackupVaultName, region, status: 'Active', specifications: { encryptionKey: v.EncryptionKeyArn }, tags: [] }));
                });
                break;
            case 'Amazon Simple Queue Service':
                await processInAllRegions(async (region) => {
                    const client = new SQSClient({ region, credentials });
                    const command = new ListQueuesCommand({});
                    const queues = await paginate(client, command, 'QueueUrls');
                    queues.forEach(qUrl => resources.push({ id: qUrl, name: qUrl.split('/').pop(), region, status: 'Active', specifications: {}, tags: [] }));
                });
                break;
            case 'AWS Lambda':
                await processInAllRegions(async (region) => {
                    const client = new LambdaClient({ region, credentials });
                    const command = new ListFunctionsCommand({});
                    const functions = await paginate(client, command, 'Functions', 'Marker', 'NextMarker');
                    functions.forEach(f => resources.push({ id: f.FunctionArn, name: f.FunctionName, region, status: 'Active', specifications: { runtime: f.Runtime, memory: f.MemorySize }, tags: [] }));
                });
                break;
            case 'AWS Storage Gateway':
                await processInAllRegions(async (region) => {
                    const client = new StorageGatewayClient({ region, credentials });
                    const command = new ListGatewaysCommand({});
                    const gateways = await paginate(client, command, 'Gateways', 'Marker', 'NextMarker');
                    gateways.forEach(g => resources.push({ id: g.GatewayARN, name: g.GatewayName, region, status: g.GatewayOperationalState, specifications: { type: g.GatewayType }, tags: [] }));
                });
                break;
            default:
                console.log(`⚠️ No specific resource handler for "${serviceName}".`);
                break;
        }
    
        const formattedResources = resources.map(res => ({
            id: res.id,
            name: res.name,
            type: serviceName,
            region: res.region || 'unknown',
            owner: (res.tags.find(t => t.Key.toLowerCase() === 'owner') || {}).Value || 'Unknown',
            project: (res.tags.find(t => t.Key.toLowerCase() === 'project') || {}).Value || 'Unassigned',
            createdDate: 'N/A',
            status: res.status,
            cost: 0,
            tags: res.tags.map(t => ({ key: t.Key, value: t.Value })),
            specifications: res.specifications,
        }));
    
        console.log(`✅ Formatted and enriched ${formattedResources.length} real resources for ${serviceName}.`);
        return formattedResources;
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