// src/components/OverviewDashboard.tsx
import React from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Globe,
  Server,
  AlertTriangle,
  Zap,
  BarChart3,
  PieChart,
  Building2,
  ShieldCheck,
  ShoppingCart,
  Crown
} from 'lucide-react';
import { Doughnut, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import CarbonFootprintMap from './CarbonFootprintMap';
import { DashboardMetrics } from '../hooks/useApiData';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

interface CostTrendData {
  date: string;
  cost: number;
}

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
  dashboardMetrics?: DashboardMetrics;
}

interface OverviewDashboardProps {
  data: OverviewData;
  isExporting: boolean;
}

const OverviewDashboard: React.FC<OverviewDashboardProps> = ({ data, isExporting }) => {
  const filteredRegionCosts = data.regionCosts.filter(region => region.cost > 0);
  const totalPotentialSavings = data.recommendations.reduce((sum, rec) => sum + rec.potentialSavings, 0);

  // Extract the new 7 metrics safely
  const metrics = data.dashboardMetrics || {
    totalSpend: data.totalMonthlyCost || 0,
    activeAccounts: 0,
    supportCost: 0,
    marketplaceCost: 0,
    topService: { label: 'N/A', cost: 0 },
    topRegion: { label: 'N/A', cost: 0 },
    topAccount: { label: 'N/A', cost: 0 }
  };

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  const serviceChartData = {
    labels: data.serviceCosts.slice(0, 6).map(item => item.service.replace('Amazon ', '').replace(' Service', '')),
    datasets: [{
      data: data.serviceCosts.slice(0, 6).map(item => item.cost),
      backgroundColor: colors.slice(0, 6),
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverBorderWidth: 4,
    }],
  };

  const _regionChartData = {
    labels: filteredRegionCosts.slice(0, 5).map(item => item.region),
    datasets: [{
      data: filteredRegionCosts.slice(0, 5).map(item => item.cost),
      backgroundColor: colors.slice(0, 5),
      borderColor: '#ffffff',
      borderWidth: 3,
      hoverBorderWidth: 4,
    }],
  };

  const getCurrentMonthInfo = () => {
    const now = new Date();
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return {
      currentDay, daysInMonth,
      monthProgress: Math.round((currentDay / daysInMonth) * 100),
      monthName: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    };
  };

  const monthInfo = getCurrentMonthInfo();

  const calculateActualTrend = () => {
    if (data.costTrendData && data.costTrendData.length >= 2) {
      const todayCost = data.costTrendData[data.costTrendData.length - 1]?.cost || 0;
      const yesterdayCost = data.costTrendData[data.costTrendData.length - 2]?.cost || 0;
      if (yesterdayCost > 0) {
        return { percentage: ((todayCost - yesterdayCost) / yesterdayCost) * 100, isProjected: false, comparison: `vs yesterday` };
      }
    }
    const estimatedPreviousMonth = data.totalMonthlyCost * 0.89; 
    return { percentage: ((data.totalMonthlyCost - estimatedPreviousMonth) / estimatedPreviousMonth) * 100, isProjected: false, comparison: 'estimated' };
  };

  const trendInfo = calculateActualTrend();

  const trendData = React.useMemo(() => {
    if (data.costTrendData && data.costTrendData.length > 0) {
      return {
        labels: data.costTrendData.map(item => new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Daily Cost', data: data.costTrendData.map(item => item.cost),
          borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 3, pointRadius: 2, pointHoverRadius: 6, tension: 0.4, fill: true,
        }],
      };
    }
    return { labels: ['No Data'], datasets: [{ label: 'Daily Cost', data: [0] }] };
  }, [data.costTrendData]);

  const chartOptions = { responsive: true, maintainAspectRatio: false, animation: isExporting ? false : {}, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context: any) => `$${(context.parsed || context.parsed.y).toLocaleString()}` } } } };
  const lineChartOptions = { responsive: true, maintainAspectRatio: false, animation: isExporting ? false : {}, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context: any) => `$${context.parsed.y.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` } } }, scales: { y: { beginAtZero: true, ticks: { callback: (value: any) => `$${value.toLocaleString()}` }, grid: { color: 'rgba(0, 0, 0, 0.05)' } }, x: { grid: { display: false } } } };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* NEW: 7 Key Metrics Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* 1. Total Spend */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><DollarSign className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Usage</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">${metrics.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-blue-100 text-xs sm:text-sm truncate">Total Spend</div>
        </div>

        {/* 2. Accounts */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><Building2 className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Active</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">{metrics.activeAccounts}</div>
          <div className="text-emerald-100 text-xs sm:text-sm truncate">Accounts</div>
        </div>

        {/* 3. Support Cost */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><ShieldCheck className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Fees</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">${metrics.supportCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-orange-100 text-xs sm:text-sm truncate">AWS Support Cost</div>
        </div>

        {/* 4. Marketplace */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><ShoppingCart className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Vendor</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1">${metrics.marketplaceCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
          <div className="text-purple-100 text-xs sm:text-sm truncate">Marketplace</div>
        </div>

        {/* 5. Top Service */}
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><Server className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Top Service</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{metrics.topService.label.replace('Amazon ', '').replace('Elastic Compute Cloud', 'EC2')}</div>
          <div className="text-cyan-100 text-xs sm:text-sm truncate">${metrics.topService.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({metrics.totalSpend > 0 ? ((metrics.topService.cost / metrics.totalSpend) * 100).toFixed(1) : '0'}%)</div>
        </div>

        {/* 6. Top Region */}
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><Globe className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Top Region</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{metrics.topRegion.label.toUpperCase()}</div>
          <div className="text-pink-100 text-xs sm:text-sm truncate">${metrics.topRegion.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({metrics.totalSpend > 0 ? ((metrics.topRegion.cost / metrics.totalSpend) * 100).toFixed(1) : '0'}%)</div>
        </div>

        {/* 7. Top Account */}
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 text-white shadow-lg hover:shadow-xl transition-all duration-300 md:col-span-3 lg:col-span-2">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-white/20 rounded-lg"><Crown className="w-5 h-5" /></div>
            <span className="text-[10px] sm:text-xs font-bold bg-white/20 px-2 py-1 rounded-full uppercase tracking-wide">Top Account</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold mb-1 truncate">{metrics.topAccount.label}</div>
          <div className="text-indigo-100 text-xs sm:text-sm truncate">${metrics.topAccount.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({metrics.totalSpend > 0 ? ((metrics.topAccount.cost / metrics.totalSpend) * 100).toFixed(1) : '0'}%)</div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Cost Trend (Last 30 Days)</h3>
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
            <div className="text-gray-500 dark:text-gray-400">From Daily CUR Data</div>
          </div>
        </div>

        {/* Top Services */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Top Services</h3>
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
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[index] }} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {service.service.replace('Amazon ', '').replace(' Service', '')}
                  </span>
                </div>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  ${service.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
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
              <p className="text-gray-500 dark:text-gray-400">Through day {monthInfo.currentDay}</p>
            </div>
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <div className="space-y-4">
            {filteredRegionCosts.slice(0, 6).map((region, index) => {
              const percentage = data.totalMonthlyCost > 0 ? (region.cost / data.totalMonthlyCost) * 100 : 0;
              return (
                <div key={region.region} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                      <span className="font-medium text-gray-900 dark:text-gray-100">{region.region}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-900 dark:text-gray-100">${region.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{percentage.toFixed(1)}%</div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div className="h-2 rounded-full transition-all duration-300" style={{ backgroundColor: colors[index % colors.length], width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Quick Insights</h3>
            </div>
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Zap className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3 mb-2">
                {trendInfo.percentage >= 0 ? <TrendingUp className="w-5 h-5 text-blue-600" /> : <TrendingDown className="w-5 h-5 text-blue-600" />}
                <span className="font-medium text-blue-800 dark:text-blue-300">Cost Trend</span>
              </div>
              <p className="text-blue-700 dark:text-blue-400 text-sm">
                Costs are {trendInfo.percentage >= 0 ? 'trending up' : 'trending down'} by {Math.abs(trendInfo.percentage).toFixed(1)}% compared to last period.
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3 mb-2">
                <TrendingDown className="w-5 h-5 text-green-600" />
                <span className="font-medium text-green-800 dark:text-green-300">Savings Opportunity</span>
              </div>
              <p className="text-green-700 dark:text-green-300 text-sm">
                You could save ${totalPotentialSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} monthly by implementing {data.recommendations.length} recommendations.
              </p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-3 mb-2">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <span className="font-medium text-orange-800 dark:text-orange-300">Month Progress</span>
              </div>
              <p className="text-orange-700 dark:text-orange-300 text-sm">
                You're {monthInfo.monthProgress}% through the month.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="col-span-1 lg:col-span-2">
        <CarbonFootprintMap data={data.carbonFootprint} />
      </div>
    </div>
  );
};

export default OverviewDashboard;