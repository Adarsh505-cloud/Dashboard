import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Server,
  User,
  Calendar,
  Tag,
  MapPin,
  DollarSign,
  Activity,
  Search,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  Loader,
  XCircle,
  Filter,
  TrendingUp,
  Shield,
  Globe,
  Zap,
  Info
} from 'lucide-react';
import { apiService } from '../services/api';

// Helper function to extract username from ARN
const extractUserNameFromArn = (arn: string | null): string | null => {
  if (!arn) return null;
  
  // Handle assumed role ARN format: arn:aws:sts::account-id:assumed-role/role-name/username
  if (arn.startsWith('arn:aws:sts::') && arn.includes('assumed-role')) {
    const parts = arn.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : arn;
  }
  
  // Handle IAM user ARN format: arn:aws:iam::account-id:user/username
  if (arn.startsWith('arn:aws:iam::') && arn.includes('user/')) {
    const parts = arn.split('/');
    return parts.length > 1 ? parts[parts.length - 1] : arn;
  }
  
  // If it's not a recognized ARN format, return as is
  return arn;
};

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

const ServiceResourceDetails: React.FC<ServiceResourceDetailsProps> = ({
  serviceName,
  serviceCost,
  credentials,
  onBack
}) => {
  const [resources, setResources] = useState<ResourceDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'date' | 'created'>('cost');

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log(`🔍 Fetching ENHANCED resources for service: ${serviceName}`);
        const realResources = await apiService.getResourcesForService(credentials, serviceName);
        console.log(`📊 Received ${realResources.length} enhanced resources from backend for ${serviceName}`);
        
        // Normalize + dedupe by canonical short id
        const byCanonical = new Map<string, any>();
        realResources.forEach((r: any) => {
          const rawId = String(r.id || r.resource_id || '').trim();
          const shortId = rawId.includes('/') ? rawId.split('/').pop()! : rawId;
          const canonical = shortId || rawId;
          if (!canonical) return;
          
          if (!byCanonical.has(canonical)) {
            // Normalize status strings to our expected enum
            const statusVal = (r.status || r.Status || '').toString().toLowerCase();
            const normalizedStatus =
              statusVal === 'terminated' ? 'terminated' :
              (statusVal === 'active' || statusVal === 'running') ? 'Active' :
              statusVal === 'stopped' ? 'stopped' :
              statusVal === 'pending' ? 'pending' : 'unknown';
            
            // Format dates properly - keep null as null
            const formatDate = (dateStr: string | null) => {
              if (!dateStr) return null;
              try {
                const date = new Date(dateStr);
                if (isNaN(date.getTime())) return dateStr;
                return date.toISOString();
              } catch {
                return dateStr;
              }
            };
            
            byCanonical.set(canonical, {
              id: canonical,
              shortId: canonical,
              rawId: rawId,
              name: r.name || canonical,
              type: r.resource_type || r.type || serviceName,
              region: r.product_location || r.region || (r.raw_resource_id && r.raw_resource_id.includes(':') ? r.raw_resource_id.split(':')[3] : 'unknown'),
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
            // merge tags if present
            if (Array.isArray(r.tags) && r.tags.length > 0) {
              existing.tags = Array.from(new Map([...existing.tags, ...r.tags].map((t: any) => [t.key, t])).values());
            }
            // prefer terminated status if any record says terminated
            const s = (r.status || '').toString().toLowerCase();
            if (s === 'terminated') existing.status = 'terminated';
          }
        });
        
        const normalized = Array.from(byCanonical.values()) as ResourceDetail[];
        console.log(`📊 Normalized and deduped enhanced resources: ${normalized.length} unique ids`);
        setResources(normalized);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
        console.error('❌ Error loading enhanced service resources:', errorMessage);
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    loadResources();
  }, [serviceName, credentials]);

  // Filter and sort resources
  const filteredResources = resources
    .filter(resource => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (resource.name ?? '').toString().toLowerCase().includes(term) ||
        (resource.id ?? '').toString().toLowerCase().includes(term) ||
        (resource.owner ?? '').toString().toLowerCase().includes(term) ||
        ((resource.deletedBy ?? '')).toString().toLowerCase().includes(term) ||
        ((resource.createdBy ?? '')).toString().toLowerCase().includes(term);
      const matchesStatus = filterStatus === 'all' || resource.status === filterStatus;
      const matchesRegion = filterRegion === 'all' || resource.region === filterRegion;
      return matchesSearch && matchesStatus && matchesRegion;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'cost':
          return b.cost - a.cost;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'date':
          // handle nulls defensively
          const ta = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const tb = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return tb - ta;
        case 'created':
          // sort by creation date
          const ca = a.createdDate ? new Date(a.createdDate).getTime() : 0;
          const cb = b.createdDate ? new Date(b.createdDate).getTime() : 0;
          return cb - ca;
        default:
          return 0;
      }
    });

  const getStatusIcon = (status: string) => {
    const s = status?.toString().toLowerCase();
    switch (s) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'running':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'stopped':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'terminated':
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    const s = status?.toString().toLowerCase();
    switch (s) {
      case 'active':
      case 'running':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'stopped':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'terminated':
        return 'bg-gray-50 text-gray-500 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getServiceIcon = (service: string) => {
    if (!service) return <Server className="w-5 h-5 text-slate-600" />;
    const serviceLower = service.toLowerCase();
    if (serviceLower.includes('ec2') || serviceLower.includes('compute')) return <Server className="w-5 h-5 text-blue-600" />;
    if (serviceLower.includes('rds') || serviceLower.includes('database')) return <Database className="w-5 h-5 text-orange-600" />;
    if (serviceLower.includes('s3') || serviceLower.includes('storage')) return <HardDrive className="w-5 h-5 text-green-600" />;
    if (serviceLower.includes('lambda') || serviceLower.includes('function')) return <Zap className="w-5 h-5 text-yellow-600" />;
    if (serviceLower.includes('vpc') || serviceLower.includes('network')) return <Globe className="w-5 h-5 text-purple-600" />;
    return <Server className="w-5 h-5 text-slate-600" />;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const uniqueRegions = [...new Set(resources.map(r => r.region || 'unknown'))];
  const activeResources = resources.filter(r => r.status === 'Active' || r.status === 'running').length;
  const terminatedResources = resources.filter(r => r.status === 'terminated').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Services
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{serviceName} Resources</h1>
              <p className="text-slate-600">Loading enhanced resource data from your AWS account...</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Loader className="w-10 h-10 text-blue-600 animate-spin" />
              <h2 className="text-2xl font-semibold text-slate-800">Analyzing Resources</h2>
            </div>
            <p className="text-slate-600 mb-8 text-lg">
              Analyzing your {serviceName} resources with detailed CloudTrail data...
            </p>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 text-left max-w-2xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-700">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Connecting to AWS Cost and Usage Reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span>Querying CloudTrail for creation events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  <span>Querying CloudTrail for deletion events</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>Extracting resource metadata and tags</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Services
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{serviceName} Resources</h1>
              <p className="text-red-600">Error loading resource data</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-red-200 p-12 text-center">
            <div className="flex items-center justify-center gap-4 mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
              <h2 className="text-2xl font-semibold text-red-800">Failed to Load Resources</h2>
            </div>
            <p className="text-red-700 mb-8 text-lg">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all duration-200 mx-auto shadow-lg"
            >
              <RefreshCw className="w-5 h-5" />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Services
            </button>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
                {getServiceIcon(serviceName)}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{serviceName} Resources</h1>
                <p className="text-slate-600">No resources found for this service</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-12 text-center">
            <Server className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">No Resources Found</h2>
            <p className="text-slate-600 mb-8 text-lg">
              No resources found for {serviceName} in your AWS account.
            </p>
            <div className="bg-slate-50 rounded-xl p-6 text-left max-w-md mx-auto">
              <p className="text-slate-700 font-medium mb-3">This could be because:</p>
              <ul className="list-disc list-inside text-slate-600 space-y-2">
                <li>No resources of this type are currently active</li>
                <li>Resources exist but don't have cost data yet</li>
                <li>Resources are in different regions</li>
                <li>Service has no billable resources</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl transition-all duration-200 shadow-sm border border-slate-200"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Services
          </button>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm border border-slate-200">
              {getServiceIcon(serviceName)}
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{serviceName} Resources</h1>
              <p className="text-slate-600">Enhanced resource data with CloudTrail insights</p>
            </div>
          </div>
        </div>
        
        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 rounded-xl">
                <Server className="w-6 h-6 text-blue-600" />
              </div>
              <span className="font-semibold text-slate-700">Total Resources</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{filteredResources.length}</div>
            <div className="text-sm text-slate-500">
              {resources.length !== filteredResources.length ? `${resources.length} total` : 'resources found'}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-emerald-100 rounded-xl">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="font-semibold text-slate-700">Active</span>
            </div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">{activeResources}</div>
            <div className="text-sm text-slate-500">
              {resources.length > 0 ? `${Math.round((activeResources / resources.length) * 100)}% active` : '—'}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <MapPin className="w-6 h-6 text-purple-600" />
              </div>
              <span className="font-semibold text-slate-700">Regions</span>
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{uniqueRegions.length}</div>
            <div className="text-sm text-slate-500">
              {uniqueRegions.slice(0, 2).join(', ')}
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-orange-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
              <span className="font-semibold text-slate-700">Total Cost</span>
            </div>
            <div className="text-3xl font-bold text-orange-600 mb-1">
              ${serviceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-slate-500">
              ${(filteredResources.length > 0 ? serviceCost / filteredResources.length : 0).toFixed(2)} avg
            </div>
          </div>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64 transition-all duration-200"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="terminated">Terminated</option>
              </select>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="all">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'cost' | 'name' | 'date' | 'created')}
                className="px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              >
                <option value="cost">Sort by Cost</option>
                <option value="name">Sort by Name</option>
                <option value="created">Sort by Created Date</option>
              </select>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const csvRows = [];
                  const headers = ['id','name','type','region','owner','project','status','createdDate','createdBy','deletionDate','deletedBy','cost'];
                  csvRows.push(headers.join(','));
                  filteredResources.forEach(r => {
                    const row = [
                      `"${r.id}"`,
                      `"${(r.name || '').replace(/"/g,'""')}"`,
                      `"${(r.type || '').replace(/"/g,'""')}"`,
                      `"${(r.region || '').replace(/"/g,'""')}"`,
                      `"${(r.owner || '').replace(/"/g,'""')}"`,
                      `"${(r.project || '').replace(/"/g,'""')}"`,
                      `"${(r.status || '')}"`,
                      `"${(r.createdDate || '')}"`,
                      `"${(r.createdBy || '')}"`,
                      `"${(r.deletionDate || '')}"`,
                      `"${(r.deletedBy || '')}"`,
                      `${r.cost}`,
                    ];
                    csvRows.push(row.join(','));
                  });
                  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${serviceName.replace(/\s+/g,'_')}_resources_enhanced.csv`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 shadow-md"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
        
        {/* Resources Grid */}
        <div className="space-y-4">
          {filteredResources.map((resource) => (
            <div key={resource.id} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:border-slate-300">
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      {getServiceIcon(resource.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-xl font-semibold text-slate-900 truncate pr-4">{resource.name || resource.id}</h3>
                        {resource.cost > 0 && (
                          <div className="text-right flex-shrink-0">
                            <div className="text-2xl font-bold text-slate-900">
                              ${Number(resource.cost).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                            </div>
                            <div className="text-sm text-slate-500">monthly</div>
                          </div>
                        )}
                      </div>
                      
                      <div className="bg-slate-50 rounded-lg px-3 py-2 mb-4 inline-block">
                        <code className="text-sm text-slate-600 font-mono">{resource.id}</code>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600 text-sm">{resource.region || 'unknown'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-400" />
                          <div className="relative group">
                            <span className="text-slate-600 text-sm truncate cursor-help">
                              {resource.owner}
                            </span>
                            {resource.ownerTooltip && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-black text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                {resource.ownerTooltip}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-black"></div>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600 text-sm">{formatDate(resource.createdDate)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(resource.status)}
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(resource.status)}`}>
                            {(resource.status || 'unknown').toString().toUpperCase()}
                          </span>
                        </div>
                      </div>
                      
                      {/* Creation and Deletion Info */}
                      <div className="space-y-2">
                        {resource.createdBy && resource.createdDate && (
                          <div className="flex items-center gap-2 text-sm bg-blue-50 text-blue-700 px-3 py-2 rounded-lg">
                            <CheckCircle className="w-4 h-4" />
                            <span>
                              Created on {formatDateTime(resource.createdDate)} by{' '}
                              <span className="font-medium">{resource.createdBy}</span>
                            </span>
                          </div>
                        )}
                        {(resource.status === 'terminated' || resource.deletionDate) && resource.deletionDate && (
                          <div className="flex items-center gap-2 text-sm bg-red-50 text-red-700 px-3 py-2 rounded-lg">
                            <XCircle className="w-4 h-4" />
                            <span>
                              Deleted on {formatDateTime(resource.deletionDate)}
                              {resource.deletedBy && (
                                <>
                                  {' '}by{' '}
                                  <span className="font-medium">{resource.deletedBy}</span>
                                </>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Specifications */}
                      {resource.specifications && Object.keys(resource.specifications).length > 0 && (
                        <div className="mt-4 p-4 bg-slate-50 rounded-xl">
                          <h4 className="text-sm font-medium text-slate-700 mb-3">Specifications</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {resource.specifications.instanceType && (
                              <div className="flex items-center gap-2">
                                <Cpu className="w-4 h-4 text-slate-500" />
                                <div>
                                  <div className="text-xs text-slate-500">Instance Type</div>
                                  <div className="font-medium text-slate-700">{resource.specifications.instanceType}</div>
                                </div>
                              </div>
                            )}
                            {resource.specifications.memory && (
                              <div className="flex items-center gap-2">
                                <MemoryStick className="w-4 h-4 text-slate-500" />
                                <div>
                                  <div className="text-xs text-slate-500">Memory</div>
                                  <div className="font-medium text-slate-700">{resource.specifications.memory}</div>
                                </div>
                              </div>
                            )}
                            {resource.specifications.storage && (
                              <div className="flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-slate-500" />
                                <div>
                                  <div className="text-xs text-slate-500">Storage</div>
                                  <div className="font-medium text-slate-700">{resource.specifications.storage}</div>
                                </div>
                              </div>
                            )}
                            {resource.specifications.cpu && (
                              <div className="flex items-center gap-2">
                                <Activity className="w-4 h-4 text-slate-500" />
                                <div>
                                  <div className="text-xs text-slate-500">CPU</div>
                                  <div className="font-medium text-slate-700">{resource.specifications.cpu}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Tags - Only show if tags exist */}
                      {resource.tags && resource.tags.length > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Tag className="w-4 h-4 text-slate-500" />
                            <span className="text-sm font-medium text-slate-700">Tags</span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {resource.tags.map((tag, index) => (
                              <span
                                key={index}
                                className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium border border-blue-200"
                              >
                                {tag.key}: {tag.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {filteredResources.length === 0 && resources.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-12 text-center">
            <Filter className="w-16 h-16 text-slate-300 mx-auto mb-6" />
            <h3 className="text-2xl font-semibold text-slate-900 mb-4">No matching resources</h3>
            <p className="text-slate-600 text-lg">
              Try adjusting your search and filter criteria to find the resources you're looking for.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceResourceDetails;