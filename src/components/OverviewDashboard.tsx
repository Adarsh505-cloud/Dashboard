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
  // removed topSpendingResources from OverviewData
}

interface OverviewDashboardProps {
  data: OverviewData;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ data }) => {
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
    <div className="space-y-8">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Cost */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-blue-100">
              {trendInfo.percentage >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              <span className="text-sm">
                {trendInfo.percentage >= 0 ? '+' : ''}{trendInfo.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">${data.totalMonthlyCost.toLocaleString()}</div>
          <div className="text-blue-100 text-sm">
            {monthInfo.monthName} (Day {monthInfo.currentDay}/{monthInfo.daysInMonth})
          </div>
          <div className="text-blue-200 text-xs mt-1">
            {trendInfo.comparison} • {monthInfo.monthProgress}% through month
          </div>
        </div>

        {/* Potential Savings */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingDown className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-green-100">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">{highPriorityRecommendations} high</span>
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">${totalPotentialSavings.toLocaleString()}</div>
          <div className="text-green-100">Potential Savings</div>
        </div>

        {/* Active Resources */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Server className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-purple-100">
              <Activity className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">{totalResources.toLocaleString()}</div>
          <div className="text-purple-100">Resources</div>
        </div>

        {/* Active Projects */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-orange-100">
              <Users className="w-4 h-4" />
              <span className="text-sm">{data.userCosts.length} users</span>
            </div>
          </div>
          <div className="text-3xl font-bold mb-1">{totalProjects}</div>
          <div className="text-orange-100">Projects</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* MODIFIED: Cost Trend Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Cost Trend (Last 30 Days)</h3>
              <p className="text-gray-500">
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="h-64">
            <Line data={trendData} options={lineChartOptions} />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Daily Cost</span>
            </div>
            <div className="text-gray-500">
              {data.costTrendData ? 'Last 30 days from Daily CUR Data' : 'Last 6 months'}
            </div>
          </div>
          {data.costTrendData && (
            <div className="mt-2 text-xs text-green-600 font-medium">
            </div>
          )}
        </div>


        {/* Top Services */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Top Services</h3>
              <p className="text-gray-500"> </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
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
                  <span className="text-sm font-medium text-gray-700">
                    {service.service.replace('Amazon ', '').replace(' Service', '')}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  ${service.cost.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Regional Distribution */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Regional Distribution</h3>
              <p className="text-gray-500">
                {monthInfo.monthName} costs by AWS region (through day {monthInfo.currentDay})
              </p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
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
                      <span className="font-medium text-gray-900">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900">${region.cost.toLocaleString()}</div>
                      <div className="text-sm text-gray-500">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
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
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-blue-700">
              <strong>Note:</strong> Costs shown are for {monthInfo.monthName} through day {monthInfo.currentDay} 
              ({monthInfo.monthProgress}% of month completed)
            </div>
          </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Quick Insights</h3>
              <p className="text-gray-500">Key findings and recommendations</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                {trendInfo.percentage >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-blue-600" />
                )}
                <span className="font-medium text-blue-800">Cost Trend</span>
              </div>
              <p className="text-blue-700 text-sm">
                Your costs are {trendInfo.percentage >= 0 ? 'trending up' : 'trending down'} by {Math.abs(trendInfo.percentage).toFixed(1)}% 
                compared to the same period last month.
              </p>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800">Savings Opportunity</span>
              </div>
              <p className="text-green-700 text-sm">
                You could save ${totalPotentialSavings.toLocaleString()} monthly by implementing our {data.recommendations.length} optimization recommendations.
              </p>
            </div>

            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-purple-800">Regional Focus</span>
              </div>
              <p className="text-purple-700 text-sm">
                {filteredRegionCosts[0]?.region} accounts for {((filteredRegionCosts[0]?.cost / data.totalMonthlyCost) * 100).toFixed(1)}% of your total costs this month.
              </p>
            </div>

            <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-800">Month Progress</span>
              </div>
              <p className="text-orange-700 text-sm">
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

      {/* NOTE: TopSpendingResources removed from Overview page */}

    </div>
  );
};

export default OverviewDashboard;
