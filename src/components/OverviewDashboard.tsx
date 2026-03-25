// src/components/OwerviewDasboard.tsx
import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Globe,
  Server,
  Users,
  FolderOpen,
  AlertTriangle,
  Activity,
  Zap,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
// NEW: Import the CarbonFootprintMap component
import CarbonFootprintMap from './CarbonFootprintMap';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

// MODIFIED: This interface now expects daily data for costTrendData
interface CostTrendData {
  date: string;
  cost: number;
}

// NOTE: removed TopSpendingResource interface (we no longer render the table here)

interface OverviewData {
  totalMonthlyCost: number;
  serviceCosts: Array<{ service: string; cost: number; region: string }>;
  regionCosts: Array<{ region: string; cost: number }>;
  userCosts: Array<{ user: string; cost: number; resources: number }>;
  resourceCosts: Array<{ type: string; cost: number; trend: number[]; count: number }>;
  projectCosts: Array<{ project: string; cost: number; resources: number; owner: string }>;
  recommendations: Array<{
    id: string;
    type: 'idle' | 'oversized' | 'unused' | 'optimization';
    severity: 'high' | 'medium' | 'low';
    potentialSavings: number;
  }>;
  costTrendData?: CostTrendData[];
  carbonFootprint?: Array<{ region: string; emissions: number; count: number }>;
  // removed topSpendingResources from OverviewData
}

interface OverviewDashboardProps {
  data: OverviewData;
  isExporting: boolean;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ data, isExporting }) => {
  // ... (all existing code from your component remains the same up to the return statement)
  
  // Filter out regions with zero cost
  const filteredRegionCosts = data.regionCosts.filter(region => region.cost > 0);

  // Calculate metrics
  const totalPotentialSavings = data.recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);
  const highPriorityRecommendations = data.recommendations.filter(rec => rec.severity === 'high').length;
  const totalResources = data.resourceCosts.reduce((sum, resource) => sum + resource.count, 0);
  const totalProjects = data.projectCosts.length;

  // Colors for charts
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  // Service costs chart data
  const serviceChartData = {
    labels: data.serviceCosts.slice(0, 6).map(item => item.service.replace('Amazon ', '').replace(' Service', '')),
    datasets: [
      {
        data: data.serviceCosts.slice(0, 6).map(item => item.cost),
        backgroundColor: colors.slice(0, 6),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
      },
    ],
  };

  // Region costs chart data
  const regionChartData = {
    labels: filteredRegionCosts.slice(0, 5).map(item => item.region),
    datasets: [
      {
        data: filteredRegionCosts.slice(0, 5).map(item => item.cost),
        backgroundColor: colors.slice(0, 5),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
      },
    ],
  };

  // Calculate current month progress and trend
  const getCurrentMonthInfo = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthProgress = (currentDay / daysInMonth) * 100;

    return {
      currentDay,
      daysInMonth,
      monthProgress: Math.round(monthProgress),
      monthName: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  };

  const monthInfo = getCurrentMonthInfo();

  // Calculate actual trend percentage from real data
  const calculateActualTrend = () => {
    if (data.costTrendData && data.costTrendData.length >= 2) {
      const todayCost = data.costTrendData[data.costTrendData.length - 1]?.cost || 0;
      const yesterdayCost = data.costTrendData[data.costTrendData.length - 2]?.cost || 0;

      if (yesterdayCost > 0) {
        const trend = ((todayCost - yesterdayCost) / yesterdayCost) * 100;
        return {
          percentage: trend,
          isProjected: false,
          comparison: `vs yesterday`
        };
      }
    }

    // Fallback calculation
    const totalCurrentCost = data.totalMonthlyCost;
    const estimatedPreviousMonth = totalCurrentCost * 0.89; // Assume 11% growth
    const trend = ((totalCurrentCost - estimatedPreviousMonth) / estimatedPreviousMonth) * 100;

    return {
      percentage: trend,
      isProjected: false,
      comparison: 'estimated'
    };
  };

  const trendInfo = calculateActualTrend();

  // MODIFIED: Cost trend data now uses daily data
  const trendData = React.useMemo(() => {
    if (data.costTrendData && data.costTrendData.length > 0) {
      // Use real AWS Athena daily data
      return {
        labels: data.costTrendData.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [
          {
            label: 'Daily Cost',
            data: data.costTrendData.map(item => item.cost),
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            pointRadius: 2,
            pointHoverRadius: 6,
            tension: 0.4,
            fill: true,
          },
        ],
      };
    } else {
      // Fallback to estimated data if no data is available
      return {
        labels: ['No Data'],
        datasets: [
          {
            label: 'Daily Cost',
            data: [0],
          },
        ],
      };
    }
  }, [data.costTrendData]);


  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: isExporting ? false : {},
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed || context.parsed.y;
            return `$${value.toLocaleString()}`;
          },
        },
      },
    },
  };

  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: isExporting ? false : {},
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `$${value.toLocaleString()}`,
        },
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };


  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Total Cost */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-blue-100">
              {trendInfo.percentage >= 0 ? (
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
              ) : (
                <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
              )}
              <span className="text-xs sm:text-sm">
                {trendInfo.percentage >= 0 ? '+' : ''}{trendInfo.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">${data.totalMonthlyCost.toLocaleString()}</div>
          <div className="text-blue-100 text-xs sm:text-sm">
            {monthInfo.monthName} (Day {monthInfo.currentDay}/{monthInfo.daysInMonth})
          </div>
          <div className="text-blue-200 text-[10px] sm:text-xs mt-1 hidden sm:block">
            {trendInfo.comparison} • {monthInfo.monthProgress}% through month
          </div>
        </div>

        {/* Potential Savings */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <TrendingDown className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-green-100">
              <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">{highPriorityRecommendations} high</span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">${totalPotentialSavings.toLocaleString()}</div>
          <div className="text-green-100 text-xs sm:text-sm">Potential Savings</div>
        </div>

        {/* Active Resources */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <Server className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-purple-100">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">Active</span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">{totalResources.toLocaleString()}</div>
          <div className="text-purple-100 text-xs sm:text-sm">Resources</div>
        </div>

        {/* Active Projects */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <FolderOpen className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-orange-100">
              <Users className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="text-xs sm:text-sm">{data.userCosts.length} users</span>
            </div>
          </div>
          <div className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1">{totalProjects}</div>
          <div className="text-orange-100 text-xs sm:text-sm">Projects</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* MODIFIED: Cost Trend Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Cost Trend (Last 30 Days)</h3>
              <p className="text-gray-500 dark:text-gray-400">
              </p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="h-48 sm:h-56 lg:h-64">
            <Line data={trendData} options={lineChartOptions} />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">Daily Cost</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              {data.costTrendData ? 'Last 30 days from Daily CUR Data' : 'Last 6 months'}
            </div>
          </div>
          {data.costTrendData && (
            <div className="mt-2 text-xs text-green-600 font-medium">
            </div>
          )}
        </div>


        {/* Top Services */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Top Services</h3>
              <p className="text-gray-500 dark:text-gray-400"> </p>
            </div>
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <PieChart className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="h-48 mb-4">
            <Doughnut data={serviceChartData} options={chartOptions} />
          </div>
          <div className="space-y-2">
            {data.serviceCosts.slice(0, 3).map((service, index) => (
              <div key={service.service} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {service.service.replace('Amazon ', '').replace(' Service', '')}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  ${service.cost.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
        {/* Regional Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Regional Distribution</h3>
              <p className="text-gray-500 dark:text-gray-400">
                {monthInfo.monthName} costs by AWS region (through day {monthInfo.currentDay})
              </p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="space-y-4">
            {filteredRegionCosts.slice(0, 6).map((region, index) => {
              const percentage = (region.cost / data.totalMonthlyCost) * 100;
              return (
                <div key={region.region} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-gray-100">${region.cost.toLocaleString()}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        backgroundColor: colors[index % colors.length],
                        width: `${percentage}%` 
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <div className="text-sm text-blue-700 dark:text-blue-400">
              <strong>Note:</strong> Costs shown are for {monthInfo.monthName} through day {monthInfo.currentDay} 
              ({monthInfo.monthProgress}% of month completed)
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Quick Insights</h3>
              <p className="text-gray-500 dark:text-gray-400">Key findings and recommendations</p>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-2">
                {trendInfo.percentage >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                )}
                <span className="font-medium text-blue-800 dark:text-blue-300">Cost Trend</span>
              </div>
              <p className="text-blue-700 dark:text-blue-400 text-sm">
                Your costs are {trendInfo.percentage >= 0 ? 'trending up' : 'trending down'} by {Math.abs(trendInfo.percentage).toFixed(1)}% 
                compared to the same period last month.
              </p>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Savings Opportunity</span>
              </div>
              <p className="text-green-700 dark:text-green-300 text-sm">
                You could save ${totalPotentialSavings.toLocaleString()} monthly by implementing our {data.recommendations.length} optimization recommendations.
              </p>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-800 dark:text-purple-300">Regional Focus</span>
              </div>
              <p className="text-purple-700 dark:text-purple-300 text-sm">
                {filteredRegionCosts[0]?.region} accounts for {((filteredRegionCosts[0]?.cost / data.totalMonthlyCost) * 100).toFixed(1)}% of your total costs this month.
              </p>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-800 dark:text-orange-300">Month Progress</span>
              </div>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                You're {monthInfo.monthProgress}% through {monthInfo.monthName.split(' ')[0]}. 
                {monthInfo.monthProgress > 10 ? 
                  `At this rate, projected monthly cost: $${Math.round((data.totalMonthlyCost / monthInfo.monthProgress) * 100).toLocaleString()}` :
                  'Still early in the month - projections will be more accurate after day 10'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Carbon Footprint Map Widget */}
      <div className="col-span-1 lg:col-span-2">
        {/* FIXED: Pass the live data from Athena instead of letting it fetch the CSV */}
        <CarbonFootprintMap data={data.carbonFootprint} />
      </div>

    </div>
  );
};

export default OverviewDashboard;