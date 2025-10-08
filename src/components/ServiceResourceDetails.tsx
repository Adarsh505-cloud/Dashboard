import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Server, User, Calendar, Tag, MapPin, DollarSign, Activity, Search, Download,
  RefreshCw, AlertCircle, CheckCircle, Clock, Database, HardDrive, Cpu, MemoryStick,
  Loader, XCircle, Filter, Shield, Globe, Zap, Info
} from 'lucide-react';
import { apiService } from '../services/api';

// --- INTERFACES & TYPES ---

interface ResourceDetail {
  id: string;
  name: string;
  type: string;
  region: string;
  owner: string;
  project: string;
  createdDate: string | null;
  status: 'Active' | 'terminated' | 'unknown' | 'running' | 'stopped' | 'pending';
  cost: number;
  tags: Array<{ key: string; value: string }>;
  specifications?: {
    instanceType?: string;
    storage?: string;
    memory?: string;
    cpu?: string;
  };
  deletionDate?: string | null;
  deletedBy?: string | null;
  createdBy?: string | null;
  ownerTooltip?: string;
}

interface ServiceResourceDetailsProps {
  serviceName: string;
  serviceCost: number;
  credentials: {
    accountId: string;
    roleArn: string;
  };
  onBack: () => void;
}

// --- HELPER FUNCTIONS ---

const extractUserNameFromArn = (arn: string | null): string | null => {
  if (!arn) return null;
  if (arn.startsWith('arn:aws:sts::') && arn.includes('assumed-role')) {
    const parts = arn.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : arn;
  }
  if (arn.startsWith('arn:aws:iam::') && arn.includes('user/')) {
    const parts = arn.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : arn;
  }
  return arn;
};

const RESOURCE_PREFIX_MAP = new Map([
  ['i-', 'EC2 Instance'], ['vol-', 'Volume'], ['snap-', 'Snapshot'], ['sg-', 'Security Group'],
  ['vpc-', 'VPC'], ['subnet-', 'Subnet'], ['rtb-', 'Route Table'], ['igw-', 'Internet Gateway'],
  ['nat-', 'NAT Gateway'], ['eni-', 'Network Interface'], ['eipalloc-', 'Elastic IP'],
  ['db-', 'RDS Instance'], ['og-', 'Option Group'], ['pg-', 'Parameter Group'],
  ['secgrp-', 'DB Security Group'], ['ss-', 'DB Snapshot'], ['lsn-', 'Listener'],
  ['tgw-', 'Transit Gateway'], ['vpce-', 'VPC Endpoint'], ['dir-', 'Directory'],
  ['lambda-', 'Lambda Function'],
  ['cf-', 'CloudFront Distribution'], ['waf-', 'WAF WebACL'],
  ['alb-', 'Load Balancer'], ['elb-', 'Load Balancer'], ['tg-', 'Target Group'],
  ['asg-', 'Auto Scaling Group'], ['lc-', 'Launch Configuration'], ['lt-', 'Launch Template'],
  ['eks-', 'EKS Cluster'], ['ngw-', 'NAT Gateway'], ['cgw-', 'Customer Gateway'],
  ['vgw-', 'VPN Gateway'], ['vpn-', 'VPN Connection'], ['dxcon-', 'Direct Connect'],
  ['fs-', 'EFS File System'], ['cache-', 'ElastiCache Cluster'], ['kms-', 'KMS Key'],
  ['secret-', 'Secrets Manager Secret'], ['role/', 'IAM Role'], ['policy/', 'IAM Policy'],
  ['user/', 'IAM User'], ['group/', 'IAM Group'], ['cert-', 'ACM Certificate'],
  ['cloudtrail-', 'CloudTrail Trail'], ['alarm-', 'CloudWatch Alarm'], ['log-', 'CloudWatch Log Group'],
  ['stack-', 'CloudFormation Stack'], ['topic-', 'SNS Topic'], ['queue-', 'SQS Queue'],
  ['zone-', 'Route53 Hosted Zone'], ['workspaces-', 'WorkSpace'], ['api-', 'API Gateway API'],
  ['step-', 'Step Functions State Machine'], ['cluster-', 'ECS Cluster'],
  ['repository-', 'ECR Repository'], ['elasticbeanstalk-', 'Elastic Beanstalk Environment']
]);

const getResourceTypeFromId = (id: string): string => {
  if (!id) return '';
  for (const [prefix, type] of RESOURCE_PREFIX_MAP.entries()) {
    if (id.startsWith(prefix)) return type;
  }
  return '';
};

const normalizeResourceData = (apiResponse: any[], serviceName: string): ResourceDetail[] => {
  const byCanonical = new Map<string, any>();
  
  apiResponse.forEach((r: any) => {
    const rawId = String(r.id || r.resource_id || r.Name || '').trim();
    const shortId = rawId.includes('/') ? rawId.split('/').pop()! : (rawId.includes(':') ? rawId.split(':').pop()! : rawId);
    const canonical = shortId || rawId;
    if (!canonical) return;
    
    if (!byCanonical.has(canonical)) {
      const statusVal = (r.status || r.Status || '').toString().toLowerCase();
      const normalizedStatus = statusVal === 'terminated' ? 'terminated' : (statusVal === 'active' || statusVal === 'running') ? 'Active' : statusVal === 'stopped' ? 'stopped' : statusVal === 'pending' ? 'pending' : 'unknown';
      const formatDate = (dateStr: string | null) => {
        if (!dateStr) return null;
        try { const date = new Date(dateStr); return isNaN(date.getTime()) ? dateStr : date.toISOString(); } catch { return dateStr; }
      };
      
      let resourceType;
      const apiType = r.resource_type || r.type || '';

      if (apiType.toUpperCase().includes('S3') || apiType.toUpperCase().includes('BUCKET')) {
          resourceType = 'S3 Bucket';
      } else {
          resourceType = getResourceTypeFromId(canonical) || apiType || serviceName;
      }
      
      byCanonical.set(canonical, {
        id: canonical,
        name: r.name || rawId,
        type: resourceType,
        region: r.product_location || r.region || (r.raw_resource_id?.split(':')[3]) || 'unknown',
        owner: r.owner || r.owner_tag || 'Unknown (from CUR)',
        project: r.project || r.project_tag || 'Unassigned (from CUR)',
        createdDate: formatDate(r.createdDate || r.creation_date),
        createdBy: extractUserNameFromArn(r.createdBy || r.created_user || r.created_by || null),
        deletionDate: formatDate(r.deletionDate || r.deletion_date),
        deletedBy: extractUserNameFromArn(r.deletedBy || r.deleted_user || r.deleted_by || null),
        status: normalizedStatus,
        cost: Number(r.total_cost || r.cost || 0),
        tags: Array.isArray(r.tags) ? r.tags : (r.resource_tags ? Object.entries(r.resource_tags).map(([k, v]) => ({ key: k, value: v })) : []),
        specifications: r.specifications || {},
        ownerTooltip: r.owner === 'Unknown (from CUR)' ? 'No user_owner cost allocation tag found' : 'From cost allocation tags'
      });
    } else {
      const existing = byCanonical.get(canonical);
      existing.cost = Number((Number(existing.cost || 0) + Number(r.total_cost || r.cost || 0)).toFixed(6));
      if (Array.isArray(r.tags) && r.tags.length > 0) { existing.tags = Array.from(new Map([...existing.tags, ...r.tags].map((t: any) => [t.key, t])).values()); }
      if ((r.status || '').toString().toLowerCase() === 'terminated') existing.status = 'terminated';
    }
  });
  
  return Array.from(byCanonical.values());
};

// --- UI HELPER FUNCTIONS ---

const formatResourceName = (name: string): string => {
    if (name.startsWith('arn:aws:')) {
        const parts = name.split(':');
        const resourceIdentifier = parts.length > 5 ? parts[5] : '';
        if (resourceIdentifier.includes('/')) {
            const [type, ...rest] = resourceIdentifier.split('/');
            const resourceName = rest.join('/');
            const formattedType = type.charAt(0).toUpperCase() + type.slice(1);
            return `${formattedType}: ${resourceName}`;
        }
        return resourceIdentifier;
    }
    return name;
};

const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': case 'running': return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'stopped': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />;
      case 'terminated': return <XCircle className="w-4 h-4 text-gray-400" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
};

const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': case 'running': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'stopped': return 'bg-red-50 text-red-700 border-red-200';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'terminated': return 'bg-gray-50 text-gray-500 border-gray-200';
      default: return 'bg-gray-50 text-gray-600 border-gray-200';
    }
};

const getServiceIcon = (service: string) => {
    const serviceLower = (service || '').toLowerCase();
    if (serviceLower.includes('ec2 instance')) return <Server className="w-5 h-5 text-orange-500" />;
    if (serviceLower.includes('volume')) return <HardDrive className="w-5 h-5 text-gray-500" />;
    if (serviceLower.includes('rds') || serviceLower.includes('database')) return <Database className="w-5 h-5 text-blue-600" />;
    if (serviceLower.includes('s3') || serviceLower.includes('storage') || serviceLower.includes('bucket')) return <HardDrive className="w-5 h-5 text-red-600" />;
    if (serviceLower.includes('lambda') || serviceLower.includes('function')) return <Zap className="w-5 h-5 text-yellow-600" />;
    if (serviceLower.includes('vpc') || serviceLower.includes('network')) return <Globe className="w-5 h-5 text-purple-600" />;
    if (serviceLower.includes('cloudfront')) return <Zap className="w-5 h-5 text-blue-500" />;
    if (serviceLower.includes('beanstalk') || serviceLower.includes('dynamodb')) return <Database className="w-5 h-5 text-indigo-500" />;
    return <Server className="w-5 h-5 text-slate-600" />;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  try { return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return dateStr; }
};

const formatDateTime = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  try { return new Date(dateStr).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return dateStr; }
};

// --- MEMOIZED CHILD COMPONENT ---

const ResourceCard: React.FC<{ resource: ResourceDetail }> = React.memo(({ resource }) => {
  return (
    <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-slate-300">
      <div className="p-6">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex-shrink-0">
              {getServiceIcon(resource.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-semibold text-slate-900 truncate pr-4" title={resource.name}>
                {formatResourceName(resource.name)}
              </h3>
              
              <div className="bg-slate-50 rounded-lg px-3 py-2 my-2 flex items-center gap-2">
                <span className="text-sm text-slate-500 font-medium">Resource ID:</span>
                <code className="text-sm text-slate-600 font-mono break-all">{resource.id}</code>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 my-4">
                <div className="flex items-center gap-2" title="Region"><MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="text-slate-600 text-sm truncate">{resource.region || 'unknown'}</span></div>
                <div className="flex items-center gap-2" title="Owner">
                  <User className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <div className="relative group"><span className="text-slate-600 text-sm truncate cursor-help">{resource.owner}</span>{resource.ownerTooltip && ( <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">{resource.ownerTooltip}<div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black"></div></div>)}</div>
                </div>
                <div className="flex items-center gap-2" title="Creation Date"><Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" /><span className="text-slate-600 text-sm">{formatDate(resource.createdDate)}</span></div>
                <div className="flex items-center gap-2" title="Status">{getStatusIcon(resource.status)}<span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(resource.status)}`}>{(resource.status || 'unknown').toUpperCase()}</span></div>
              </div>

              <div className="space-y-2">{resource.createdBy && resource.createdDate && (<div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg"><CheckCircle className="w-4 h-4" /><span>Created on {formatDateTime(resource.createdDate)} by <span className="font-medium">{resource.createdBy}</span></span></div>)}{(resource.status === 'terminated' || resource.deletionDate) && resource.deletionDate && (<div className="flex items-center gap-2 text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg"><XCircle className="w-4 h-4" /><span>Deleted on {formatDateTime(resource.deletionDate)}{resource.deletedBy && <> by <span className="font-medium">{resource.deletedBy}</span></>}</span></div>)}</div>
              
              {resource.specifications && Object.keys(resource.specifications).length > 0 && ( <div className="mt-4 p-4 bg-slate-50 rounded-xl"><h4 className="text-sm font-medium text-slate-700 mb-3">Specifications</h4><div className="grid grid-cols-2 md:grid-cols-4 gap-4">{resource.specifications.instanceType && <div className="flex items-center gap-2"><Cpu className="w-4 h-4 text-slate-500" /><div><div className="text-xs text-slate-500">Instance Type</div><div className="font-medium text-slate-700">{resource.specifications.instanceType}</div></div></div>}{resource.specifications.memory && <div className="flex items-center gap-2"><MemoryStick className="w-4 h-4 text-slate-500" /><div><div className="text-xs text-slate-500">Memory</div><div className="font-medium text-slate-700">{resource.specifications.memory}</div></div></div>}{resource.specifications.storage && <div className="flex items-center gap-2"><HardDrive className="w-4 h-4 text-slate-500" /><div><div className="text-xs text-slate-500">Storage</div><div className="font-medium text-slate-700">{resource.specifications.storage}</div></div></div>}{resource.specifications.cpu && <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-slate-500" /><div><div className="text-xs text-slate-500">CPU</div><div className="font-medium text-slate-700">{resource.specifications.cpu}</div></div></div>}</div></div>)}
              
              {resource.tags && resource.tags.length > 0 && (<div className="mt-4"><div className="flex items-center gap-2 mb-3"><Tag className="w-4 h-4 text-slate-500" /><span className="text-sm font-medium text-slate-700">Tags</span></div><div className="flex flex-wrap gap-2">{resource.tags.map((tag, index) => (<span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200">{tag.key}: {tag.value}</span>))}</div></div>)}
            </div>
          </div>
          {resource.cost > 0 && (<div className="text-right flex-shrink-0 w-full sm:w-auto mt-4 sm:mt-0"><div className="text-2xl font-bold text-slate-900">${Number(resource.cost).toLocaleString(undefined, { maximumFractionDigits: 6 })}</div><div className="text-sm text-slate-500">monthly</div></div>)}
        </div>
      </div>
    </div>
  );
});

// --- MAIN COMPONENT ---

const ServiceResourceDetails: React.FC<ServiceResourceDetailsProps> = ({ serviceName, serviceCost, credentials, onBack }) => {
  const [resources, setResources] = useState<ResourceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'created'>('cost');

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      setError(null);
      try {
        const apiResponse = await apiService.getResourcesForService(credentials, serviceName);
        const normalized = normalizeResourceData(apiResponse, serviceName);
        setResources(normalized);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load resources');
      } finally {
        setLoading(false);
      }
    };
    loadResources();
  }, [serviceName, credentials]);

  const filteredResources = useMemo(() => {
    return resources
      .filter(resource => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          (resource.name || resource.id).toLowerCase().includes(term) ||
          resource.owner.toLowerCase().includes(term) ||
          (resource.deletedBy || '').toLowerCase().includes(term) ||
          (resource.createdBy || '').toLowerCase().includes(term);
        const matchesStatus = filterStatus === 'all' || resource.status === filterStatus;
        const matchesRegion = filterRegion === 'all' || resource.region === filterRegion;
        return matchesSearch && matchesStatus && matchesRegion;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'cost': return b.cost - a.cost;
          case 'name': return a.name.localeCompare(b.name);
          case 'created':
            const dateA = a.createdDate ? new Date(a.createdDate).getTime() : 0;
            const dateB = b.createdDate ? new Date(b.createdDate).getTime() : 0;
            return dateB - dateA;
          default: return 0;
        }
      });
  }, [resources, searchTerm, filterStatus, filterRegion, sortBy]);

  const groupedResources = useMemo(() => {
    return filteredResources.reduce((groups, resource) => {
      const resourceType = resource.type;
      if (!groups[resourceType]) { groups[resourceType] = []; }
      groups[resourceType].push(resource);
      return groups;
    }, {} as Record<string, ResourceDetail[]>);
  }, [filteredResources]);

  const uniqueRegions = useMemo(() => [...new Set(resources.map(r => r.region || 'unknown'))], [resources]);
  const activeResources = useMemo(() => resources.filter(r => r.status === 'Active' || r.status === 'running').length, [resources]);
  
  const handleExport = useCallback(() => {
      const csvRows = [];
      const headers = ['id', 'name', 'type', 'region', 'owner', 'project', 'status', 'createdDate', 'createdBy', 'deletionDate', 'deletedBy', 'cost'];
      csvRows.push(headers.join(','));
      filteredResources.forEach(r => {
        const row = [
          `"${r.id}"`, `"${(r.name || '').replace(/"/g, '""')}"`, `"${(r.type || '').replace(/"/g, '""')}"`,
          `"${(r.region || '')}"`, `"${(r.owner || '').replace(/"/g, '""')}"`, `"${(r.project || '').replace(/"/g, '""')}"`,
          `"${r.status}"`, `"${r.createdDate || ''}"`, `"${r.createdBy || ''}"`, `"${r.deletionDate || ''}"`,
          `"${r.deletedBy || ''}"`, `${r.cost}`
        ];
        csvRows.push(row.join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${serviceName.replace(/\s+/g, '_')}_resources_enhanced.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  }, [filteredResources, serviceName]);

  // --- RENDER LOGIC ---

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-6 py-8 text-center">
            <Loader className="w-10 h-10 text-blue-600 animate-spin mx-auto my-12" />
            <h2 className="text-2xl font-semibold text-slate-800">Analyzing Resources...</h2>
        </div>
      </div>
    );
  }
  if (error) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-6 py-8 text-center">
                <AlertCircle className="w-10 h-10 text-red-600 mx-auto my-12" />
                <h2 className="text-2xl font-semibold text-red-800">Failed to Load Resources</h2>
                <p className="text-red-700 mt-2">{error}</p>
            </div>
        </div>
    );
  }
  if (resources.length === 0) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
            <div className="container mx-auto px-6 py-8 text-center">
                <Server className="w-16 h-16 text-slate-300 mx-auto my-12" />
                <h2 className="text-2xl font-semibold text-slate-900">No Resources Found</h2>
                <p className="text-slate-600 mt-2">No resources found for {serviceName} in your AWS account.</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-8">
            <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200"><ArrowLeft className="w-5 h-5" /> Back</button>
            <div className="flex items-center gap-4"><div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">{getServiceIcon(serviceName)}</div><div><h1 className="text-3xl font-bold text-slate-900">{serviceName} Resources</h1><p className="text-slate-600">Enhanced resource data with CloudTrail insights</p></div></div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"><div className="flex items-center gap-3 mb-3"><div className="p-2 bg-blue-100 rounded-xl"><Server className="w-6 h-6 text-blue-600" /></div><span className="font-semibold text-slate-700">Total Resources</span></div><div className="text-3xl font-bold text-slate-900 mb-1">{filteredResources.length}</div><div className="text-sm text-slate-500">{resources.length !== filteredResources.length ? `${resources.length} total` : 'resources found'}</div></div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"><div className="flex items-center gap-3 mb-3"><div className="p-2 bg-emerald-100 rounded-xl"><CheckCircle className="w-6 h-6 text-emerald-600" /></div><span className="font-semibold text-slate-700">Active</span></div><div className="text-3xl font-bold text-emerald-600 mb-1">{activeResources}</div><div className="text-sm text-slate-500">{resources.length > 0 ? `${Math.round((activeResources / resources.length) * 100)}% active` : '—'}</div></div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"><div className="flex items-center gap-3 mb-3"><div className="p-2 bg-purple-100 rounded-xl"><MapPin className="w-6 h-6 text-purple-600" /></div><span className="font-semibold text-slate-700">Resource Types</span></div><div className="text-3xl font-bold text-slate-900 mb-1">{Object.keys(groupedResources).length}</div><div className="text-sm text-slate-500 truncate">{Object.keys(groupedResources).slice(0, 2).join(', ')}</div></div>
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200"><div className="flex items-center gap-3 mb-3"><div className="p-2 bg-orange-100 rounded-xl"><DollarSign className="w-6 h-6 text-orange-600" /></div><span className="font-semibold text-slate-700">Total Cost</span></div><div className="text-3xl font-bold text-orange-600 mb-1">${serviceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div><div className="text-sm text-slate-500">${(filteredResources.length > 0 ? serviceCost / filteredResources.length : 0).toFixed(2)} avg</div></div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between"><div className="flex flex-col sm:flex-row gap-4 flex-1"><div className="relative"><Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" /><input type="text" placeholder="Search resources..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64 transition-all" /></div><select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"><option value="all">All Status</option><option value="Active">Active</option><option value="terminated">Terminated</option></select><select value={filterRegion} onChange={(e) => setFilterRegion(e.target.value)} className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"><option value="all">All Regions</option>{uniqueRegions.map(region => (<option key={region} value={region}>{region}</option>))}</select><select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'cost' | 'name' | 'created')} className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"><option value="cost">Sort by Cost</option><option value="name">Sort by Name</option><option value="created">Sort by Created Date</option></select></div><button onClick={handleExport} className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md"><Download className="w-4 h-4" /> Export</button></div>
        </div>
        
        <div className="space-y-8">{Object.entries(groupedResources).map(([resourceType, resourcesInGroup]) => (<div key={resourceType} className="space-y-4"><div className="flex items-center justify-between bg-slate-800 text-white px-6 py-4 rounded-t-2xl"><div className="flex items-center gap-3"><div className="p-2 bg-slate-700 rounded-lg">{getServiceIcon(resourceType)}</div><h2 className="text-xl font-bold">{resourceType}</h2><span className="bg-slate-700 px-3 py-1 rounded-full text-sm font-medium">{resourcesInGroup.length}</span></div><div className="text-slate-300 text-sm">Total Cost: ${resourcesInGroup.reduce((sum, r) => sum + r.cost, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div></div><div className="grid gap-4">{resourcesInGroup.map((resource) => ( <ResourceCard key={resource.id} resource={resource} /> ))}</div></div>))}</div>
        {filteredResources.length === 0 && resources.length > 0 && (<div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center"><Filter className="w-16 h-16 text-slate-300 mx-auto mb-6" /><h3 className="text-2xl font-semibold text-slate-900 mb-4">No matching resources</h3><p className="text-slate-600 text-lg">Try adjusting your search and filter criteria.</p></div>)}
      </div>
    </div>
  );
};

export default ServiceResourceDetails;