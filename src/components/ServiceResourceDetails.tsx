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
  Loader
} from 'lucide-react';
import { apiService } from '../services/api';

interface ResourceDetail {
  id: string;
  name: string;
  type: string;
  region: string;
  owner: string;
  project: string;
  createdDate: string;
  status: 'running' | 'stopped' | 'pending' | 'terminated';
  cost: number;
  tags: Array<{ key: string; value: string }>;
  specifications?: {
    instanceType?: string;
    storage?: string;
    memory?: string;
    cpu?: string;
  };
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
  const [sortBy, setSortBy] = useState<'cost' | 'name' | 'date'>('cost');

  useEffect(() => {
    const loadResources = async () => {
      setLoading(true);
      setError(null);
  
      try {
        console.log(`🔍 Fetching REAL resources for service: ${serviceName}`);
  
        const realResources = await apiService.getResourcesForService(credentials, serviceName);
  
        console.log(`📊 Found ${realResources.length} REAL resources for ${serviceName}`);
        setResources(realResources as ResourceDetail[]); // Cast the response
  
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load resources';
        console.error('❌ Error loading service resources:', errorMessage);
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
      const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           resource.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           resource.owner.toLowerCase().includes(searchTerm.toLowerCase());
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
          return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
        default:
          return 0;
      }
    });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'stopped':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'stopped':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getServiceIcon = (service: string) => {
    if (service.includes('EC2') || service.includes('Compute')) return <Server className="w-6 h-6" />;
    if (service.includes('RDS') || service.includes('Database')) return <Database className="w-6 h-6" />;
    if (service.includes('S3') || service.includes('Storage')) return <HardDrive className="w-6 h-6" />;
    if (service.includes('Lambda') || service.includes('Function')) return <Activity className="w-6 h-6" />;
    return <Server className="w-6 h-6" />;
  };

  const uniqueRegions = [...new Set(resources.map(r => r.region))];
  const runningResources = resources.filter(r => r.status === 'running').length;

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Services
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{serviceName} Resources</h2>
            <p className="text-gray-600">Loading resource data from your AWS account...</p>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
            <h3 className="text-xl font-semibold text-blue-800">Loading Resources</h3>
          </div>
          <p className="text-blue-700 mb-4">
            Analyzing your {serviceName} resources and extracting detailed information...
          </p>
          <div className="bg-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p>• Connecting to AWS Resource Groups API</p>
            <p>• Retrieving resource metadata and tags</p>
            <p>• Calculating individual resource costs</p>
            <p>• Mapping resources to users and projects</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Services
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{serviceName} Resources</h2>
            <p className="text-gray-600">Error loading resource data</p>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <h3 className="text-xl font-semibold text-red-800">Failed to Load Resources</h3>
          </div>
          <p className="text-red-700 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (resources.length === 0) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Services
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              {getServiceIcon(serviceName)}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{serviceName} Resources</h2>
              <p className="text-gray-600">No resources found for this service</p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-12 text-center">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Resources Found</h3>
          <p className="text-gray-500 mb-4">
            No resources found for {serviceName} in your AWS account. This could be because:
          </p>
          <div className="text-left max-w-md mx-auto">
            <ul className="list-disc list-inside text-gray-500 space-y-1">
              <li>No resources of this type are currently active</li>
              <li>Resources exist but don't have cost data yet</li>
              <li>Resources are in different regions</li>
              <li>Service has no billable resources</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Services
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            {getServiceIcon(serviceName)}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{serviceName} Resources</h2>
            <p className="text-gray-600">Real resource data from your AWS account</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Server className="w-6 h-6" />
            <span className="font-medium">Total Resources</span>
          </div>
          <div className="text-3xl font-bold">{filteredResources.length}</div>
          <div className="text-blue-100 text-sm">
            {resources.length !== filteredResources.length && `${resources.length} total`}
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-6 h-6" />
            <span className="font-medium">Running</span>
          </div>
          <div className="text-3xl font-bold">{runningResources}</div>
          <div className="text-green-100 text-sm">
            {Math.round((runningResources / resources.length) * 100)}% active
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-6 h-6" />
            <span className="font-medium">Regions</span>
          </div>
          <div className="text-3xl font-bold">{uniqueRegions.length}</div>
          <div className="text-purple-100 text-sm">
            {uniqueRegions.slice(0, 2).join(', ')}
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <DollarSign className="w-6 h-6" />
            <span className="font-medium">Total Cost</span>
          </div>
          {/* Use the new serviceCost prop and format it */}
          <div className="text-3xl font-bold">
            ${serviceCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-orange-100 text-sm">
            {/* Fix the average calculation */}
            ${(filteredResources.length > 0 ? serviceCost / filteredResources.length : 0).toFixed(2)} avg
          </div>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="stopped">Stopped</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Regions</option>
              {uniqueRegions.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'cost' | 'name' | 'date')}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="cost">Sort by Cost</option>
              <option value="name">Sort by Name</option>
              <option value="date">Sort by Date</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Resources List */}
      <div className="space-y-4">
        {filteredResources.map((resource) => (
          <div key={resource.id} className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-200">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gray-100 rounded-xl">
                    {getServiceIcon(resource.type)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-1">{resource.name}</h3>
                    <p className="text-gray-600 mb-2 font-mono text-sm">{resource.id}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        {resource.region}
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {resource.owner}
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(resource.createdDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {/* Conditionally render cost only if it's greater than 0 */}
                  {resource.cost > 0 && (
                    <div className="text-2xl font-bold text-gray-900 mb-1">
                      ${resource.cost.toLocaleString()}
                      <span className="text-sm text-gray-500 font-normal ml-1">/ monthly</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-2 mt-2">
                    {getStatusIcon(resource.status)}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(resource.status)}`}>
                      {resource.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                
              </div>

              {/* Specifications */}
              {resource.specifications && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  {resource.specifications.instanceType && (
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Instance Type</div>
                        <div className="font-medium">{resource.specifications.instanceType}</div>
                      </div>
                    </div>
                  )}
                  {resource.specifications.memory && (
                    <div className="flex items-center gap-2">
                      <MemoryStick className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Memory</div>
                        <div className="font-medium">{resource.specifications.memory}</div>
                      </div>
                    </div>
                  )}
                  {resource.specifications.storage && (
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">Storage</div>
                        <div className="font-medium">{resource.specifications.storage}</div>
                      </div>
                    </div>
                  )}
                  {resource.specifications.cpu && (
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-gray-500" />
                      <div>
                        <div className="text-xs text-gray-500">CPU</div>
                        <div className="font-medium">{resource.specifications.cpu}</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tags */}
              <div className="flex items-start gap-2">
                <Tag className="w-4 h-4 text-gray-500 mt-1" />
                <div className="flex flex-wrap gap-2">
                  {resource.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                    >
                      {tag.key}: {tag.value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredResources.length === 0 && resources.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <Server className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No resources found</h3>
          <p className="text-gray-500">
            Try adjusting your search and filter criteria
          </p>
        </div>
      )}
    </div>
  );
};

export default ServiceResourceDetails;