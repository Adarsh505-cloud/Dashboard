// src/components/UserCostChart.tsx
import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Hash, 
  Server,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  X,
  Braces,
  Grid,
  List,
  Download,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface UserCost {
  user: string;
  cost: number;
  resources: number;
  resourcesList: string[] | null | string;
  resources_csv?: string;
}

interface UserCostChartProps {
  data: UserCost[];
  isExporting: boolean;
}

const UserCostChart: React.FC<UserCostChartProps> = ({ data, isExporting }) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewingResourcesFor, setViewingResourcesFor] = useState<string | null>(null);
  const [copiedResource, setCopiedResource] = useState<string | null>(null);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');

  // ADDED: Filter data to only include users with an "@" symbol in their name.
  const filteredData = data.filter(item => item.user && item.user.includes('@'));

  useEffect(() => {
    // CHANGED: Use filteredData for logging
    if (filteredData.length > 0) {
      const firstUser = filteredData[0];
      console.log('First user resourcesList:', firstUser.resourcesList);
      console.log('Type of resourcesList:', typeof firstUser.resourcesList);
    }
  }, [filteredData]);

  const createGradient = (ctx: any, chartArea: any) => {
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.7)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.9)');
    return gradient;
  };

  const chartData = {
    // CHANGED: Use filteredData and show full user names
    labels: filteredData.map(item => item.user),
    datasets: [
      {
        label: 'Cost ($)',
        data: filteredData.map(item => item.cost),
        backgroundColor: (context: any) => {
          const chart = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return 'rgba(79, 70, 229, 0.8)';
          return createGradient(ctx, chartArea);
        },
        borderColor: 'rgb(79, 70, 229)',
        borderWidth: 1,
        borderRadius: 8,
        hoverBackgroundColor: 'rgba(79, 70, 229, 0.9)',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: isExporting ? false : {},
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(243, 244, 246)',
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold' as const,
        },
        bodyFont: {
          size: 13,
        },
        displayColors: false,
        callbacks: {
          title: (tooltipItems: any) => {
            const index = tooltipItems[0].dataIndex;
            return filteredData[index].user;
          },
          label: (context: any) => {
            const userIndex = context.dataIndex;
            const userData = filteredData[userIndex];
            return [
              `Cost: $${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `Resources: ${userData.resources}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(229, 231, 235, 0.5)',
          drawBorder: false,
        },
        ticks: {
          callback: (value: any) => `$${value.toLocaleString()}`,
          color: 'rgb(107, 114, 128)',
          font: {
            size: 12,
          },
          padding: 10,
        },
      },
      x: {
        grid: {
          display: false,
        },
        // CHANGED: Added rotation to make long usernames readable
        ticks: {
          color: 'rgb(107, 114, 128)',
          font: {
            size: 12,
          },
          padding: 5,
          maxRotation: 45,
          minRotation: 45,
          autoSkip: false,
        },
      },
    },
  };

  const totalCost = filteredData.reduce((sum, user) => sum + user.cost, 0);

  const copyToClipboard = (resourceId: string) => {
    navigator.clipboard.writeText(resourceId);
    setCopiedResource(resourceId);
    setTimeout(() => setCopiedResource(null), 2000);
  };

  const getResourceType = (resourceId: string) => {
    if (resourceId.includes('ec2') || resourceId.includes('i-')) return 'EC2';
    if (resourceId.includes('rds')) return 'RDS';
    if (resourceId.includes('s3')) return 'S3';
    if (resourceId.includes('lambda')) return 'Lambda';
    if (resourceId.includes('natgateway')) return 'NAT Gateway';
    if (resourceId.includes('route53')) return 'Route 53';
    return 'Other';
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType.toLowerCase()) {
      case 'ec2': return '🖥️';
      case 'rds': return '🗄️';
      case 's3': return '📦';
      case 'lambda': return '⚡';
      case 'nat gateway': return '🌐';
      case 'route 53': return '🌍';
      default: return '🔧';
    }
  };

  const parseResourcesList = (resourcesList: any, resourcesCount: number): string[] => {
    if (Array.isArray(resourcesList)) {
      return resourcesList;
    }
    if (resourcesList === null || resourcesList === undefined) {
      return [];
    }
    if (typeof resourcesList === 'string' && resourcesList.trim() === '') {
      return [];
    }
    if (typeof resourcesList === 'string') {
      try {
        let cleanJson = resourcesList.trim();
        if (cleanJson.startsWith('[') && cleanJson.endsWith(']')) {
          const content = cleanJson.substring(1, cleanJson.length - 1);
          const items = content.split(',').map(item => item.trim());
          const processedItems = items.map(item => {
            if (item.length > 0 && !item.startsWith('"') && !item.endsWith('"')) {
              return `"${item}"`;
            }
            return item;
          });
          const fixedJson = `[${processedItems.join(',')}]`;
          const parsed = JSON.parse(fixedJson);
          if (Array.isArray(parsed)) return parsed;
          return [parsed];
        }
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) return parsed;
        return [parsed];
      } catch (e) {
        if (resourcesList.includes(',')) {
          if (resourcesList.startsWith('[') && resourcesList.endsWith(']')) {
            const content = resourcesList.substring(1, resourcesList.length - 1);
            return content.split(',').map(item => item.trim());
          }
          return resourcesList.split(',').map(item => item.trim()).filter(item => item.length > 0);
        }
        if (resourcesList.length > 0) return [resourcesList];
      }
    }
    if (resourcesCount > 0) {
      return Array.from({ length: resourcesCount }, (_, i) => `Resource ${i + 1}`);
    }
    return [];
  };

  const getCurrentUser = () => {
    const user = filteredData.find(user => user.user === viewingResourcesFor);
    if (!user) return null;
    
    let resourcesList: string[] = [];
    if (user.resourcesList !== null && user.resourcesList !== undefined) {
      resourcesList = parseResourcesList(user.resourcesList, user.resources);
    }
    if (resourcesList.length === 0 && user.resources_csv) {
      resourcesList = user.resources_csv.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    if (resourcesList.length === 0 && user.resources > 0) {
      resourcesList = Array.from({ length: user.resources }, (_, i) => `Resource ${i + 1}`);
    }
    return { ...user, resourcesList };
  };

  const filteredResources = getCurrentUser()?.resourcesList.filter(resource => 
    resource.toLowerCase().includes(resourceSearchTerm.toLowerCase())
  ) || [];

  const totalResources = filteredData.reduce((sum, user) => sum + user.resources, 0);
  const avgCostPerUser = filteredData.length > 0 ? totalCost / filteredData.length : 0;

  const sortedData = [...filteredData].sort((a, b) => {
    if (sortOrder === 'high-to-low') {
      return b.cost - a.cost;
    }
    return a.cost - b.cost;
  });

  const exportResources = () => {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.resourcesList) return;
    const csvRows = [['Resource ID', 'Resource Type'].join(',')];
    currentUser.resourcesList.forEach(resource => {
      csvRows.push([`"${resource}"`, `"${getResourceType(resource)}"`].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentUser.user.replace(/\s+/g, '_')}_resources.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">User Cost Analysis</h2>
              <p className="text-indigo-200 text-sm">Cost distribution and resource ownership</p>
            </div>
          </div>
          {/* The buttons have been removed from here */}
        </div>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200">
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Users className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-indigo-600 font-medium">Total Users</div>
              <div className="text-xl font-bold text-gray-900">{filteredData.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-indigo-600 font-medium">Total Cost</div>
              <div className="text-xl font-bold text-gray-900">
                ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Server className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-indigo-600 font-medium">Total Resources</div>
              <div className="text-xl font-bold text-gray-900">{totalResources}</div>
            </div>
          </div>
        </div>
        <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm text-indigo-600 font-medium">Avg Cost/User</div>
              <div className="text-xl font-bold text-gray-900">
                ${avgCostPerUser.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="p-6 space-y-6">
        {/* Chart Section - Full Width */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Cost Distribution by User</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
              <TrendingUp className="w-4 h-4" />
              <span>Last 30 days</span>
            </div>
          </div>
          <div className="h-96">
            <Bar data={chartData} options={options} />
          </div>
        </div>
        
        {/* User Details Section - Full Width */}
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">User Details</h3>
            <div className="flex items-center gap-3">
              {/* Sort Controls */}
              <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                <button
                  onClick={() => setSortOrder('high-to-low')}
                  className={`px-3 py-1.5 flex items-center gap-1 text-sm rounded-l-lg ${
                    sortOrder === 'high-to-low' 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>High to Low</span>
                  <ArrowDown className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSortOrder('low-to-high')}
                  className={`px-3 py-1.5 flex items-center gap-1 text-sm rounded-r-lg ${
                    sortOrder === 'low-to-high' 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <span>Low to High</span>
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
              
              {/* View Mode Controls */}
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-l-lg ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-r-lg ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          
          {/* User List Container - One by One Format */}
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {sortedData.map((user, index) => {
              let safeResourcesList: string[] = [];
              if (user.resourcesList !== null && user.resourcesList !== undefined) {
                safeResourcesList = parseResourcesList(user.resourcesList, user.resources);
              }
              if (safeResourcesList.length === 0 && user.resources_csv) {
                safeResourcesList = user.resources_csv.split(',').map(id => id.trim()).filter(id => id.length > 0);
              }
              if (safeResourcesList.length === 0 && user.resources > 0) {
                safeResourcesList = Array.from({ length: user.resources }, (_, i) => `Resource ${i + 1}`);
              }
              const totalPercentage = totalCost > 0 ? Math.round((user.cost / totalCost) * 100) : 0;
              const rankBadge = sortOrder === 'high-to-low' 
                ? `#${index + 1}` 
                : `#${sortedData.length - index}`;
              
              return (
                <div 
                  key={user.user} 
                  className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${
                    viewingResourcesFor === user.user 
                      ? 'border-indigo-300 ring-2 ring-indigo-100' 
                      : 'border-gray-200 hover:border-indigo-200'
                  }`}
                >
                  {/* User Header */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white font-medium text-lg">
                            {user.user.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                            {rankBadge}
                          </div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{user.user}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            <span>{user.resources} resources</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-indigo-600">
                          ${user.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-xs text-gray-500">{totalPercentage}% of total</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Cost Progress */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Cost Distribution</span>
                      <span>{totalPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${totalPercentage}%` }}
                      />
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="p-3 flex justify-between items-center bg-gray-50">
                    <button
                      onClick={() => setViewingResourcesFor(viewingResourcesFor === user.user ? null : user.user)}
                      className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
                      disabled={user.resources === 0}
                    >
                      {viewingResourcesFor === user.user ? (
                        <><EyeOff className="w-4 h-4" /><span>Hide Resources</span></>
                      ) : (
                        <><Eye className="w-4 h-4" /><span>View Resources</span></>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setExpandedUser(expandedUser === user.user ? null : user.user)}
                      className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {expandedUser === user.user ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  
                  {/* Quick Resource Preview */}
                  {expandedUser === user.user && (
                    <div className="border-t border-gray-200 p-4 bg-white">
                      <div className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        <span>Resource Preview</span>
                      </div>
                      {safeResourcesList.length > 0 ? (
                        <div className="space-y-2">
                          {safeResourcesList.slice(0, 3).map((resource, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm flex-shrink-0">{getResourceIcon(getResourceType(resource))}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-x-auto py-1" title={resource}>
                                    {resource}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                  {getResourceType(resource)}
                                </span>
                                <button
                                  onClick={() => copyToClipboard(resource)}
                                  className="text-indigo-600 hover:text-indigo-800 p-1 rounded"
                                  title="Copy ARN"
                                >
                                  <Copy className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                          {safeResourcesList.length > 3 && (
                            <div className="text-center pt-2">
                              <button className="text-xs text-indigo-600 hover:text-indigo-800">
                                +{safeResourcesList.length - 3} more resources
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <div className="flex flex-col items-center gap-2">
                            <Braces className="w-8 h-8 text-gray-400 mx-auto" />
                            <span className="text-sm">Resource details not available</span>
                            <span className="text-xs">Expected: {user.resources} resources</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Resources Modal/Panel */}
      {viewingResourcesFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Server className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Resources for {viewingResourcesFor}</h3>
                    <p className="text-indigo-200 text-sm">
                      {getCurrentUser()?.resources} resources • ${getCurrentUser()?.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total cost
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingResourcesFor(null)}
                  className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search and Filter Bar */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search resources..."
                      value={resourceSearchTerm}
                      onChange={(e) => setResourceSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={exportResources}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Resources Table */}
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Resource ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResources.length > 0 ? (
                      filteredResources.map((resource, index) => {
                        const resourceType = getResourceType(resource);
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="mr-3 text-lg">{getResourceIcon(resourceType)}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-x-auto py-1" title={resource}>
                                    {resource}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                                {resourceType}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => copyToClipboard(resource)}
                                  className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50"
                                >
                                  {copiedResource === resource ? (
                                    <>
                                      <Check className="w-4 h-4 text-green-500" />
                                      <span className="text-green-500">Copied!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-4 h-4" />
                                      <span>Copy ID</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={3} className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                              <Search className="w-6 h-6 text-gray-400" />
                            </div>
                            <div className="text-gray-500">
                              {resourceSearchTerm ? 'No resources match your search' : 
                                getCurrentUser()?.resources === 0 ? 'This user has no resources' : 
                                'No resources found'
                              }
                            </div>
                            {resourceSearchTerm && (
                              <button 
                                onClick={() => setResourceSearchTerm('')}
                                className="text-indigo-600 hover:text-indigo-800 text-sm"
                              >
                                Clear search
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Footer */}
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>
                    Showing {filteredResources.length} of {getCurrentUser()?.resourcesList.length || 0} resources
                  </div>
                  <div className="flex items-center gap-4">
                    <button className="text-indigo-600 hover:text-indigo-800">
                      View on AWS Console
                    </button>
                    <button className="text-indigo-600 hover:text-indigo-800">
                      Generate Cost Report
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCostChart;