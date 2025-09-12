// src/components/ResourceChart.tsx
import React, { useState } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Activity,
  Download,
  RefreshCw,
  Zap,
  Server,
  Database,
  HardDrive,
  Globe,
  DollarSign,
  CheckCircle,
  MapPin
} from 'lucide-react';
import TopSpendingResources from './TopSpendingResources';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// ------- Interfaces -------
interface ResourceCost {
  type: string;
  cost: number;
  trend: number[];
  count: number;
  dailyTrend?: number[];
}

interface DailyCostGroup {
  Keys?: string[];
  Metrics?: {
    BlendedCost?: {
      Amount?: string;
    };
  };
}

interface DailyCostData {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Groups?: DailyCostGroup[];
}

interface WeeklyCostData {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Groups?: DailyCostGroup[];
}

interface TopSpendingResource {
  service: string;
  resource_type: string;
  resource_id?: string;
  raw_resource_id?: string;
  total_cost: number;
}

interface ResourceChartProps {
  data: ResourceCost[];
  dailyCostData?: DailyCostData[];
  weeklyCostData?: WeeklyCostData[];
  topSpendingResources?: TopSpendingResource[];
}

interface ProcessedCostData {
  serviceData: Record<string, number[]>;
  labels: string[];
}

// ------- Component -------
const ResourceChart: React.FC<ResourceChartProps> = ({ data, dailyCostData, weeklyCostData, topSpendingResources }) => {
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [chartType, setChartType] = useState<'line' | 'bar' | 'doughnut'>('line');
  const [selectedResource, setSelectedResource] = useState<string | null>(null);

  // Process real cost data
  const processRealCostData = (range: 'daily' | 'weekly' | 'monthly'): ProcessedCostData => {
    if (range === 'daily' && dailyCostData) {
      const serviceData: Record<string, number[]> = {};
      const labels: string[] = [];

      dailyCostData.forEach((dayData, index) => {
        const date = new Date(dayData.TimePeriod.Start);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

        dayData.Groups?.forEach((group: DailyCostGroup) => {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');

          if (!serviceData[service]) {
            serviceData[service] = new Array(dailyCostData.length).fill(0);
          }
          serviceData[service][index] = cost;
        });
      });

      return { serviceData, labels };
    }

    if (range === 'weekly' && weeklyCostData) {
      const serviceData: Record<string, number[]> = {};
      const labels: string[] = [];

      weeklyCostData.forEach((weekData, index) => {
        const startDate = new Date(weekData.TimePeriod.Start);
        labels.push(`Week ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`);

        weekData.Groups?.forEach((group: DailyCostGroup) => {
          const service = group.Keys?.[0] || 'Unknown';
          const cost = parseFloat(group.Metrics?.BlendedCost?.Amount || '0');

          if (!serviceData[service]) {
            serviceData[service] = new Array(weeklyCostData.length).fill(0);
          }
          serviceData[service][index] = cost;
        });
      });

      return { serviceData, labels };
    }

    // Fallback monthly data
    const serviceData: Record<string, number[]> = {};
    const labels = ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    data.forEach(resource => {
      serviceData[resource.type] = resource.trend || new Array(6).fill(0);
    });

    return { serviceData, labels };
  };

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  // Filter out resources with zero cost or count
  const validResources = (data || []).filter(resource => resource.cost > 0 && resource.count > 0);

  // Processed cost & labels
  const { serviceData, labels } = processRealCostData(timeRange);

  // Top10 from resource-level summary (fallback)
  const top10ResourcesFallback = [...validResources]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)
    .map(r => ({
      service: r.type,
      resource_type: r.type,
      resource_id: r.type,
      total_cost: r.cost
    })) as TopSpendingResource[];

  // Use provided topSpendingResources if present, otherwise fallback
  const top10 = Array.isArray(topSpendingResources) && topSpendingResources.length > 0
    ? topSpendingResources.slice(0, 10)
    : top10ResourcesFallback;

  // Chart data
  const getChartData = () => {
    if (chartType === 'doughnut') {
      return {
        labels: validResources.map(resource => resource.type.replace('Amazon ', '').replace(' Service', '')),
        datasets: [
          {
            data: validResources.map(resource => resource.cost),
            backgroundColor: colors.slice(0, validResources.length),
            borderColor: '#ffffff',
            borderWidth: 3,
            hoverBorderWidth: 4,
          },
        ],
      };
    }

    const datasets = Object.entries(serviceData)
      .filter(([, costs]) => {
        const totalCost = Array.isArray(costs) ? costs.reduce((sum: number, cost: number) => sum + cost, 0) : 0;
        return totalCost > 0;
      })
      .slice(0, 8)
      .map(([service, costs], index) => {
        const serviceName = service.replace('Amazon ', '').replace(' Service', '');
        if (chartType === 'bar') {
          return {
            label: serviceName,
            data: costs,
            backgroundColor: colors[index % colors.length] + '80',
            borderColor: colors[index % colors.length],
            borderWidth: 2,
            borderRadius: 6,
          };
        }

        return {
          label: serviceName,
          data: costs,
          borderColor: colors[index % colors.length],
          backgroundColor: colors[index % colors.length] + '20',
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 6,
          tension: 0.4,
          fill: false,
        };
      });

    return {
      labels,
      datasets,
    };
  };

  const getChartOptions = () => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
          labels: {
            padding: 20,
            font: {
              size: 12,
              weight: 500 as const,
            },
            usePointStyle: true,
            pointStyle: 'circle' as const,
            filter: (legendItem: any, chartData: any) => {
              return chartData.datasets.indexOf(chartData.datasets.find((d: any) => d.label === legendItem.text)) < 8;
            }
          },
        },
        tooltip: {
          mode: 'index' as const,
          intersect: false,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#ffffff',
          bodyColor: '#ffffff',
          borderColor: '#374151',
          borderWidth: 1,
          cornerRadius: 8,
          callbacks: {
            label: (context: any) => {
              if (chartType === 'doughnut') {
                const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                const percentage = ((context.parsed / total) * 100).toFixed(1);
                return `${context.label}: $${context.parsed.toLocaleString()} (${percentage}%)`;
              }
              return `${context.dataset.label}: $${Number(context.parsed.y).toFixed(2)}`;
            },
          },
        },
      },
    };

    if (chartType === 'doughnut') {
      return {
        ...baseOptions,
        plugins: {
          ...baseOptions.plugins,
          legend: {
            ...baseOptions.plugins.legend,
            position: 'right' as const,
          },
        },
      };
    }

    return {
      ...baseOptions,
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: 'rgba(0, 0, 0, 0.05)',
          },
          ticks: {
            callback: (value: any) => `$${Number(value).toFixed(0)}`,
            font: {
              size: 11,
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
            maxRotation: 45,
          },
        },
      },
      interaction: {
        mode: 'nearest' as const,
        axis: 'x' as const,
        intersect: false,
      },
    };
  };

  const chartData = getChartData();
  const chartOptions = getChartOptions();

  const totalCost = validResources.reduce((sum, resource) => sum + resource.cost, 0);
  const totalResources = validResources.reduce((sum, resource) => sum + resource.count, 0);

  const getResourceTrend = (trend: number[]) => {
    if (trend.length < 2) return 0;
    const recent = trend.slice(-2);
    if (recent[0] === 0) return 0;
    return ((recent[1] - recent[0]) / recent[0]) * 100;
  };

  const renderChart = () => {
    if (validResources.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Resource Data Available</h3>
            <p className="text-gray-500">No resource cost data found for your AWS account</p>
          </div>
        </div>
      );
    }

    switch (chartType) {
      case 'bar':
        return <Bar data={chartData} options={chartOptions} />;
      case 'doughnut':
        return <Doughnut data={chartData} options={chartOptions} />;
      case 'line':
      default:
        return <Line data={chartData} options={chartOptions} />;
    }
  };

  const getResourceIcon = (serviceOrType: string) => {
    const s = (serviceOrType || '').toLowerCase();
    if (s.includes('ec2') || s.includes('instance') || s.includes('compute')) return <Server className="w-5 h-5" />;
    if (s.includes('rds') || s.includes('database')) return <Database className="w-5 h-5" />;
    if (s.includes('s3') || s.includes('storage')) return <HardDrive className="w-5 h-5" />;
    if (s.includes('lambda') || s.includes('function')) return <Zap className="w-5 h-5" />;
    if (s.includes('vpc')) return <MapPin className="w-5 h-5" />;
    return <Activity className="w-5 h-5" />;
  };

  const getDailyCostRange = () => {
    if (timeRange === 'daily' && chartData.datasets.length > 0) {
      const allCosts = chartData.datasets.flatMap(dataset => dataset.data as number[]);
      const minCost = Math.min(...allCosts);
      const maxCost = Math.max(...allCosts);
      return { min: minCost, max: maxCost };
    }
    return { min: 0, max: 0 };
  };

  const costRange = getDailyCostRange();

  // No-resources UI
  if (validResources.length === 0) {
    return (
      <div className="space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <BarChart3 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-3xl font-bold">Resource Cost Trends</h2>
              <p className="text-purple-100">Real-time data from AWS Cost Explorer API</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">0</div>
              <div className="text-purple-100">Resource Types</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">0</div>
              <div className="text-purple-100">Total Resources</div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="text-2xl font-bold">$0</div>
              <div className="text-purple-100">Total Cost</div>
            </div>
          </div>
        </div>

        {/* No Data Message */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
          <Activity className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Resource Data Available</h3>
          <p className="text-gray-500 mb-4">
            No resource cost data found for your AWS account. This could be because:
          </p>
          <div className="text-left max-w-md mx-auto">
            <ul className="list-disc list-inside text-gray-500 space-y-1">
              <li>No resources are currently running</li>
              <li>Resources don't have cost data yet</li>
              <li>Cost data is still being processed by AWS</li>
              <li>Resources are in different regions not covered</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header (unchanged) */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <BarChart3 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Resource Cost Trends</h2>
            <p className="text-purple-100">Real-time data from AWS Cost Explorer API</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{validResources.length}</div>
            <div className="text-purple-100">Resource Types</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{totalResources.toLocaleString()}</div>
            <div className="text-purple-100">Total Resources</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <div className="text-purple-100">Total Cost</div>
          </div>
        </div>
      </div>

      {/* REFACTORED: Use the TopSpendingResources component */}
      <TopSpendingResources topSpendingResources={top10} />

      {/* Controls, main chart and details (unchanged) */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Cost Analysis Controls</h3>
            <p className="text-gray-500">View real AWS Cost Explorer data with different time ranges and chart types</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Time Range Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {(['daily', 'weekly', 'monthly'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    timeRange === range
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {range.charAt(0).toUpperCase() + range.slice(1)}
                  </div>
                </button>
              ))}
            </div>

            {/* Chart Type Selector */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              {([
                { type: 'line', icon: Activity, label: 'Line' },
                { type: 'bar', icon: BarChart3, label: 'Bar' },
                { type: 'doughnut', icon: PieChart, label: 'Pie' }
              ] as const).map(({ type, icon: Icon, label }) => (
                <button
                  key={type}
                  onClick={() => setChartType(type)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    chartType === type
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    {label}
                  </div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
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
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">
              Resource Cost Trends - {timeRange.charAt(0).toUpperCase() + timeRange.slice(1)} View
            </h3>
            <p className="text-gray-500">
              {chartType === 'doughnut' 
                ? 'Current cost distribution across resource types'
                : `Real AWS ${timeRange} cost data for all resource types`
              }
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Globe className="w-4 h-4" />
            <span>All Regions</span>
          </div>
        </div>
        
        <div className={`${chartType === 'doughnut' ? 'h-96' : 'h-80'}`}>
          {renderChart()}
        </div>

        {/* Chart Insights */}
        {chartType !== 'doughnut' && validResources.length > 0 && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-800">
                  {timeRange === 'daily' ? 'Daily Range' : 'Cost Range'}
                </span>
              </div>
              <div className="text-sm text-blue-700">
                {timeRange === 'daily' && costRange.max > 0 ? (
                  `$${costRange.min.toFixed(2)} - $${costRange.max.toFixed(2)} per day`
                ) : (
                  'Real AWS cost data'
                )}
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Highest Cost</span>
              </div>
              <div className="text-sm text-green-700">
                {(() => {
                  const highestCost = validResources.reduce((max, resource) => 
                    resource.cost > max.cost ? resource : max
                  );
                  return `${highestCost.type}: $${highestCost.cost.toLocaleString()}/month`;
                })()}
              </div>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-800">Most Resources</span>
              </div>
              <div className="text-sm text-purple-700">
                {(() => {
                  const mostResources = validResources.reduce((max, resource) => 
                    resource.count > max.count ? resource : max
                  );
                  return `${mostResources.type}: ${mostResources.count} resources`;
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Data Source Note */}
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-sm text-green-800">
            <strong>✅ Real AWS Data:</strong> 
            {timeRange === 'daily' && dailyCostData ? 
              ` Daily costs fetched directly from AWS Cost Explorer (${dailyCostData.length} days of actual billing data from ${dailyCostData.length > 0 ? new Date(dailyCostData[0].TimePeriod.Start).toLocaleDateString() : 'N/A'}).` :
              timeRange === 'weekly' && weeklyCostData ?
              ` Weekly costs aggregated from AWS Cost Explorer (${weeklyCostData.length} weeks of actual billing data from ${weeklyCostData.length > 0 ? new Date(weeklyCostData[0].TimePeriod.Start).toLocaleDateString() : 'N/A'}).` :
              ' Monthly cost trends from your AWS Cost Explorer data.'
            }
          </div>
        </div>
      </div>

      {/* Resource Details */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Resource Type Details</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {validResources.map((resource, index) => {
            const trend = getResourceTrend(resource.trend);
            const isPositive = trend > 0;
            
            return (
              <div 
                key={resource.type} 
                className={`p-6 rounded-xl border-2 transition-all duration-200 cursor-pointer ${
                  selectedResource === resource.type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                }`}
                onClick={() => setSelectedResource(
                  selectedResource === resource.type ? null : resource.type
                )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: colors[index % colors.length] + '20' }}
                    >
                      <div style={{ color: colors[index % colors.length] }}>
                        {getResourceIcon(resource.type)}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">
                        {resource.type.replace('Amazon ', '').replace(' Service', '')}
                      </h4>
                      <p className="text-sm text-gray-500">{resource.count} resources</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-xl font-bold text-gray-900">
                      ${resource.cost.toLocaleString()}
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${
                      isPositive ? 'text-red-600' : trend < 0 ? 'text-green-600' : 'text-gray-500'
                    }`}>
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : trend < 0 ? (
                        <TrendingDown className="w-4 h-4" />
                      ) : (
                        <div className="w-4 h-4" />
                      )}
                      <span>{trend !== 0 ? `${Math.abs(trend).toFixed(1)}%` : 'No change'}</span>
                    </div>
                  </div>
                </div>

                {/* Mini trend chart */}
                <div className="h-16 relative">
                  <svg className="w-full h-full" viewBox="0 0 200 60">
                    <defs>
                      <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity="0.1" />
                      </linearGradient>
                    </defs>
                    
                    {resource.trend.length > 1 ? (
                      <>
                        {/* Trend line */}
                        <polyline
                          fill="none"
                          stroke={colors[index % colors.length]}
                          strokeWidth="2"
                          points={resource.trend.map((value, i) => {
                            const x = (i / (resource.trend.length - 1)) * 200;
                            const maxValue = Math.max(...resource.trend);
                            const minValue = Math.min(...resource.trend);
                            const range = maxValue - minValue || 1;
                            const y = 50 - ((value - minValue) / range) * 40;
                            return `${x},${y}`;
                          }).join(' ')}
                        />
                        
                        {/* Fill area */}
                        <polygon
                          fill={`url(#gradient-${index})`}
                          points={`0,50 ${resource.trend.map((value, i) => {
                            const x = (i / (resource.trend.length - 1)) * 200;
                            const maxValue = Math.max(...resource.trend);
                            const minValue = Math.min(...resource.trend);
                            const range = maxValue - minValue || 1;
                            const y = 50 - ((value - minValue) / range) * 40;
                            return `${x},${y}`;
                          }).join(' ')} 200,50`}
                        />
                      </>
                    ) : (
                      <text x="100" y="30" textAnchor="middle" className="text-xs fill-gray-400">
                        No trend data
                      </text>
                    )}
                  </svg>
                </div>

                {/* Additional details when selected */}
                {selectedResource === resource.type && (
                  <div className="mt-4 pt-4 border-t border-blue-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Avg. Cost per Resource:</span>
                        <div className="font-medium">${(resource.cost / resource.count).toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Real Daily Avg:</span>
                        <div className="font-medium">
                          {timeRange === 'daily' && costRange.max > 0 ? 
                            `$${((costRange.min + costRange.max) / 2).toFixed(2)}` : 
                            'N/A'
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
};

export default ResourceChart;
