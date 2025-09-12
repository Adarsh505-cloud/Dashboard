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
  User, 
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
  AlertCircle,
  Database,
  Code,
  Braces,
  Filter,
  Grid,
  List,
  MoreVertical,
  Download,
  RefreshCw,
  Settings,
  Info,
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
}

const UserCostChart: React.FC<UserCostChartProps> = ({ data }) => {
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [viewingResourcesFor, setViewingResourcesFor] = useState<string | null>(null);
  const [copiedResource, setCopiedResource] = useState<string | null>(null);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');

  // Debug logging
  useEffect(() => {
    console.log('UserCostChart received data:', data);
    if (data.length > 0) {
      const firstUser = data[0];
      console.log('First user resourcesList:', firstUser.resourcesList);
      console.log('First user resources_csv:', firstUser.resources_csv);
      console.log('Type of resourcesList:', typeof firstUser.resourcesList);
      
      setDebugInfo({
        totalUsers: data.length,
        firstUser: firstUser.user,
        firstUserResources: firstUser.resourcesList,
        firstUserResourcesCount: firstUser.resources,
        firstUserResourcesCsv: firstUser.resources_csv,
        firstUserResourcesType: typeof firstUser.resourcesList
      });
    }
  }, [data]);

  const createGradient = (ctx: any, chartArea: any) => {
    const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
    gradient.addColorStop(0, 'rgba(79, 70, 229, 0.7)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.9)');
    return gradient;
  };

  const chartData = {
    labels: data.map(item => {
      const maxLength = 12;
      return item.user.length > maxLength 
        ? `${item.user.substring(0, maxLength)}...` 
        : item.user;
    }),
    datasets: [
      {
        label: 'Cost ($)',
        data: data.map(item => item.cost),
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
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        displayColors: false,
        callbacks: {
          title: (tooltipItems: any) => {
            const index = tooltipItems[0].dataIndex;
            return data[index].user;
          },
          label: (context: any) => {
            const userIndex = context.dataIndex;
            const userData = data[userIndex];
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
        ticks: {
          color: 'rgb(107, 114, 128)',
          font: {
            size: 12,
          },
          padding: 10,
        },
      },
    },
  };

  const maxCost = Math.max(...data.map(u => u.cost), 1);
  const totalCost = data.reduce((sum, user) => sum + user.cost, 0);

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

  // Enhanced parsing function to handle various formats
  const parseResourcesList = (resourcesList: any, resourcesCount: number): string[] => {
    console.log('Parsing resourcesList:', resourcesList);
    console.log('Resources count:', resourcesCount);
    
    // Case 1: Already an array
    if (Array.isArray(resourcesList)) {
      console.log('ResourcesList is already an array');
      return resourcesList;
    }
    
    // Case 2: Null or undefined
    if (resourcesList === null || resourcesList === undefined) {
      console.log('ResourcesList is null or undefined');
      return [];
    }
    
    // Case 3: Empty string
    if (typeof resourcesList === 'string' && resourcesList.trim() === '') {
      console.log('ResourcesList is an empty string');
      return [];
    }
    
    // Case 4: Try to parse as JSON or fix malformed JSON
    if (typeof resourcesList === 'string') {
      try {
        // Try to clean up malformed JSON - the specific issue we're seeing
        let cleanJson = resourcesList.trim();
        
        // Check if it looks like an array but missing quotes
        if (cleanJson.startsWith('[') && cleanJson.endsWith(']')) {
          // Extract content between brackets
          const content = cleanJson.substring(1, cleanJson.length - 1);
          
          // Split by commas and clean up each item
          const items = content.split(',').map(item => item.trim());
          
          // Process each item - add quotes if needed
          const processedItems = items.map(item => {
            // If item doesn't have quotes and isn't empty, add them
            if (item.length > 0 && !item.startsWith('"') && !item.endsWith('"')) {
              return `"${item}"`;
            }
            return item;
          });
          
          // Reconstruct the JSON string
          const fixedJson = `[${processedItems.join(',')}]`;
          console.log('Attempting to parse fixed JSON:', fixedJson);
          
          const parsed = JSON.parse(fixedJson);
          if (Array.isArray(parsed)) {
            console.log('Successfully parsed fixed JSON array');
            return parsed;
          } else {
            console.log('Parsed JSON is not an array, wrapping in array');
            return [parsed];
          }
        }
        
        // Try normal JSON parsing
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) {
          console.log('Successfully parsed as JSON array');
          return parsed;
        } else {
          console.log('Parsed JSON is not an array, wrapping in array');
          return [parsed];
        }
      } catch (e) {
        console.log('JSON parsing failed, trying other methods');
        
        // Case 5: Try to split by commas (CSV format)
        if (resourcesList.includes(',')) {
          // Handle the case where it looks like [item1, item2] but isn't valid JSON
          if (resourcesList.startsWith('[') && resourcesList.endsWith(']')) {
            // Extract content between brackets and split
            const content = resourcesList.substring(1, resourcesList.length - 1);
            const items = content.split(',').map(item => item.trim());
            console.log('Extracted items from bracket notation:', items);
            return items;
          }
          
          // Regular CSV split
          const csvArray = resourcesList.split(',').map(item => item.trim()).filter(item => item.length > 0);
          console.log('Split by commas, got:', csvArray);
          return csvArray;
        }
        
        // Case 6: Single resource (not an array)
        if (resourcesList.length > 0) {
          console.log('Treating as single resource');
          return [resourcesList];
        }
      }
    }
    
    // Case 7: Create placeholder resources based on count
    if (resourcesCount > 0) {
      console.log('Creating placeholder resources based on count:', resourcesCount);
      return Array.from({ length: resourcesCount }, (_, i) => `Resource ${i + 1}`);
    }
    
    console.log('No resources found, returning empty array');
    return [];
  };

  const getCurrentUser = () => {
    const user = data.find(user => user.user === viewingResourcesFor);
    if (!user) return null;
    
    console.log('Getting resources for user:', user.user);
    console.log('Raw resourcesList:', user.resourcesList);
    console.log('Type of resourcesList:', typeof user.resourcesList);
    
    let resourcesList: string[] = [];
    
    // Try to parse resourcesList
    if (user.resourcesList !== null && user.resourcesList !== undefined) {
      resourcesList = parseResourcesList(user.resourcesList, user.resources);
    }
    
    // If we still don't have resources but have a CSV, try that
    if (resourcesList.length === 0 && user.resources_csv) {
      console.log('Trying resources_csv');
      resourcesList = user.resources_csv.split(',').map(id => id.trim()).filter(id => id.length > 0);
    }
    
    // If we still don't have resources but have a count, create placeholders
    if (resourcesList.length === 0 && user.resources > 0) {
      console.log('Creating placeholder resources');
      resourcesList = Array.from({ length: user.resources }, (_, i) => `Resource ${i + 1}`);
    }
    
    console.log('Final resourcesList:', resourcesList);
    
    return {
      ...user,
      resourcesList
    };
  };

  const filteredResources = getCurrentUser()?.resourcesList.filter(resource => 
    resource.toLowerCase().includes(resourceSearchTerm.toLowerCase())
  ) || [];

  // Calculate statistics
  const totalResources = data.reduce((sum, user) => sum + user.resources, 0);
  const avgCostPerUser = data.length > 0 ? totalCost / data.length : 0;

  // Sort users based on the selected sort order
  const sortedData = [...data].sort((a, b) => {
    if (sortOrder === 'high-to-low') {
      return b.cost - a.cost;
    } else {
      return a.cost - b.cost;
    }
  });

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
          <div className="flex items-center gap-2">
            <button className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500/20 rounded-lg transition-colors">
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500/20 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 text-indigo-200 hover:text-white hover:bg-indigo-500/20 rounded-lg transition-colors">
              <Download className="w-5 h-5" />
            </button>
          </div>
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
              <div className="text-xl font-bold text-gray-900">{data.length}</div>
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
              // Get resources list for this user
              let safeResourcesList: string[] = [];
              
              if (user.resourcesList !== null && user.resourcesList !== undefined) {
                safeResourcesList = parseResourcesList(user.resourcesList, user.resources);
              }
              
              // If we still don't have resources but have a CSV, try that
              if (safeResourcesList.length === 0 && user.resources_csv) {
                safeResourcesList = user.resources_csv.split(',').map(id => id.trim()).filter(id => id.length > 0);
              }
              
              // If we still don't have resources but have a count, create placeholders
              if (safeResourcesList.length === 0 && user.resources > 0) {
                safeResourcesList = Array.from({ length: user.resources }, (_, i) => `Resource ${i + 1}`);
              }
              
              // FIXED: Use total percentage for progress bar instead of max cost percentage
              const totalPercentage = Math.round((user.cost / totalCost) * 100);
              
              // Add rank badge for sorted order
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
                        style={{ width: `${totalPercentage}%` }} // FIXED: Use totalPercentage here
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
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span>Hide Resources</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>View Resources</span>
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => setExpandedUser(expandedUser === user.user ? null : user.user)}
                      className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      {expandedUser === user.user ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
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
                                  {/* FIXED: Show full resource ARN with horizontal scroll */}
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
                    <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
                      <Filter className="w-4 h-4" />
                      <span>Filter</span>
                    </button>
                    <button className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">
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
                                <span className="mr-3 text-lg flex-shrink-0">{getResourceIcon(resourceType)}</span>
                                <div className="min-w-0 flex-1">
                                  {/* FIXED: Show full resource ARN with horizontal scroll */}
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
                                <button className="text-gray-600 hover:text-gray-900 p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                                  <MoreVertical className="w-4 h-4" />
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