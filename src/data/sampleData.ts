export const sampleData = {
  totalMonthlyCost: 12580,
  
  serviceCosts: [
    { service: 'EC2', cost: 4200, region: 'us-east-1' },
    { service: 'RDS', cost: 2800, region: 'us-west-2' },
    { service: 'S3', cost: 1800, region: 'us-east-1' },
    { service: 'Lambda', cost: 1200, region: 'eu-west-1' },
    { service: 'CloudFront', cost: 980, region: 'Global' },
    { service: 'ELB', cost: 780, region: 'us-east-1' },
    { service: 'VPC', cost: 520, region: 'us-east-1' },
    { service: 'Route53', cost: 300, region: 'Global' },
  ],
  
  regionCosts: [
    { region: 'us-east-1', cost: 6800 },
    { region: 'us-west-2', cost: 3200 },
    { region: 'eu-west-1', cost: 1800 },
    { region: 'ap-south-1', cost: 780 },
  ],
  
  userCosts: [
    { user: 'adarsh', cost: 4200, resources: 23 },
    { user: 'admin', cost: 3800, resources: 18 },
    { user: 'dev-team', cost: 2100, resources: 15 },
    { user: 'prod-ops', cost: 1680, resources: 12 },
    { user: 'test-env', cost: 800, resources: 8 },
  ],
  
  resourceCosts: [
    { 
      type: 'EC2 Instances', 
      cost: 4200, 
      count: 23,
      trend: [3800, 3900, 4100, 4000, 4150, 4200] 
    },
    { 
      type: 'RDS Databases', 
      cost: 2800, 
      count: 8,
      trend: [2600, 2700, 2750, 2800, 2850, 2800] 
    },
    { 
      type: 'S3 Buckets', 
      cost: 1800, 
      count: 45,
      trend: [1600, 1650, 1700, 1750, 1780, 1800] 
    },
    { 
      type: 'Lambda Functions', 
      cost: 1200, 
      count: 78,
      trend: [1000, 1100, 1150, 1180, 1190, 1200] 
    },
    { 
      type: 'Load Balancers', 
      cost: 780, 
      count: 6,
      trend: [720, 740, 760, 770, 775, 780] 
    },
  ],
  
  projectCosts: [
    { project: 'E-commerce Platform', cost: 3200, resources: 28, owner: 'adarsh' },
    { project: 'Analytics Dashboard', cost: 2800, resources: 22, owner: 'admin' },
    { project: 'Mobile API', cost: 2100, resources: 18, owner: 'dev-team' },
    { project: 'Data Pipeline', cost: 1900, resources: 15, owner: 'prod-ops' },
    { project: 'ML Training', cost: 1580, resources: 12, owner: 'adarsh' },
    { project: 'Testing Environment', cost: 1000, resources: 10, owner: 'test-env' },
  ],
  
  recommendations: [
    {
      id: '1',
      type: 'idle' as const,
      severity: 'high' as const,
      resource: 'EC2 Instance (i-0abc123def456789)',
      description: 'This t3.large instance has been idle for 12 days with <1% CPU utilization. Consider stopping or downsizing.',
      potentialSavings: 120,
      lastActivity: '12 days ago',
      action: 'Stop Instance'
    },
    {
      id: '2',
      type: 'oversized' as const,
      severity: 'medium' as const,
      resource: 'RDS Instance (mysql-prod-db)',
      description: 'Database is consistently using <30% of allocated resources. Consider downsizing from db.r5.xlarge to db.r5.large.',
      potentialSavings: 280,
      lastActivity: '2 hours ago',
      action: 'Downsize Instance'
    },
    {
      id: '3',
      type: 'unused' as const,
      severity: 'high' as const,
      resource: 'EBS Volume (vol-0def456ghi789abc)',
      description: 'Unattached 500GB EBS volume has been unused for 8 days. Consider deletion if not needed.',
      potentialSavings: 50,
      lastActivity: '8 days ago',
      action: 'Delete Volume'
    },
    {
      id: '4',
      type: 'idle' as const,
      severity: 'medium' as const,
      resource: 'Lambda Function (image-processor)',
      description: 'Function has not been invoked for 15 days. Review if still needed or consider archiving.',
      potentialSavings: 25,
      lastActivity: '15 days ago',
      action: 'Archive Function'
    },
    {
      id: '5',
      type: 'optimization' as const,
      severity: 'low' as const,
      resource: 'S3 Bucket (legacy-backups)',
      description: 'Consider moving old objects to Glacier or Deep Archive storage class for cost savings.',
      potentialSavings: 180,
      lastActivity: '1 day ago',
      action: 'Update Storage Class'
    },
  ],
};