// src/components/Dashboard.tsx
import React, { useState, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Server,
  FolderOpen,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  XCircle,
  Loader,
  Activity,
  BarChart3
} from 'lucide-react';
import CostChart from './CostChart';
import UserCostChart from './UserCostChart';
import ResourceChart from './ResourceChart';
import ProjectChart from './ProjectChart';
import RecommendationsPanel from './RecommendationsPanel';
import OverviewDashboard from './OverviewDashboard';
import MasterOverviewDashboard from './MasterOverviewDashboard';
import { exportToPDF } from '../utils/pdfExport';
import { useApiData } from '../hooks/useApiData';
import ChatbotWidget from './ChatbotWidget';
import DateRangeSelector, { DateRange, getDefaultDateRange } from './DateRangeSelector';

interface DashboardProps {
  credentials: {
    accountId: string;
    roleArn: string;
    accountType?: 'standalone' | 'master';
  };
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ credentials, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const [targetAccountId, setTargetAccountId] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<DateRange>(getDefaultDateRange);
  
  const dashboardRef = useRef<HTMLDivElement>(null);

  // Combine parent credentials with local drill-down target
  const activeCredentials = useMemo(() => ({
    ...credentials,
    targetAccountId,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  }), [credentials.accountId, credentials.roleArn, credentials.accountType, targetAccountId, dateRange.startDate, dateRange.endDate]);

  const { data, loading, error, retry } = useApiData(activeCredentials);

  const handleExportPDF = async () => {
    if (!dashboardRef.current || !data) return;
    
    setIsExporting(true);
    setTimeout(async () => {
        if (dashboardRef.current) {
            try {
                await exportToPDF(dashboardRef.current, credentials.accountId);
            } catch (error) {
                console.error('Export failed:', error);
            } finally {
                setIsExporting(false);
            }
        } else {
            setIsExporting(false);
        }
    }, 100);
  };

  const getCurrentDateTime = () => {
    return new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleBack = () => {
    // If drilling down into a master account, go back to the master view
    if (credentials.accountType === 'master' && targetAccountId) {
      setTargetAccountId(undefined);
      setActiveTab('overview');
    } else {
      // Otherwise, go completely back to inputs
      onBack();
    }
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'services', label: 'Services', icon: Activity },
    { key: 'resources', label: 'Resources', icon: Server },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'projects', label: 'Projects', icon: FolderOpen },
    { key: 'recommendations', label: 'Recommendations', icon: AlertTriangle },
  ];

  // Helper: normalize and map top spending resources to expected shape
  const mapTopSpendingResources = (rawAny: any): any[] | undefined => {
    if (!rawAny) return undefined;
    if (!Array.isArray(rawAny)) return undefined;
    return rawAny.map((r: any, idx: number) => {
      const resourceId =
        r.resource_id ||
        r.raw_resource_id ||
        r.resourceId ||
        r.id ||
        r.instanceId ||
        r.metadata?.id ||
        r.meta?.resourceId ||
        r.attributes?.resource_id ||
        r.resource?.id ||
        null;
      const totalCost =
        r.total_cost ||
        r.cost ||
        r.amount ||
        r.totalCost ||
        Number(r.total_cost_usd) ||
        0;
      return {
        service: r.service || r.resource || r.serviceName || r.name || 'unknown',
        region: r.region || 'unknown',
        resource_type: r.resource_type || r.type || r.resourceType || 'unknown',
        resource_id: resourceId,
        raw_resource_id: r.raw_resource_id || r.rawId || null,
        total_cost: Number(totalCost || 0),
        __raw: r,
        __index: idx,
      };
    });
  };

  const isMasterView = credentials.accountType === 'master' && !targetAccountId;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 relative overflow-hidden">
        {/* Animated background grid */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(59,130,246,0.5) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-cyan-500/30 rounded-full animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-3 h-3 bg-blue-500/20 rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-indigo-500/25 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-1.5 h-1.5 bg-cyan-400/30 rounded-full animate-pulse" style={{ animationDelay: '1.5s' }}></div>

        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-5 left-5 flex items-center gap-2 px-3 py-2 text-cyan-400 hover:text-white hover:bg-white/10 rounded-lg transition-all text-sm z-10"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="w-full max-w-sm text-center relative z-10">
          {/* Animated ring + dollar icon */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            {/* Outer glow ring */}
            <div className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 opacity-20 blur-lg animate-pulse"></div>
            {/* Outer rotating ring */}
            <div className="absolute inset-0 rounded-full border-2 border-gray-700"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-cyan-400 border-r-blue-500 animate-spin" style={{ animationDuration: '2s' }}></div>
            {/* Inner rotating ring (opposite direction) */}
            <div className="absolute inset-3 rounded-full border-2 border-gray-800"></div>
            <div className="absolute inset-3 rounded-full border-2 border-transparent border-b-indigo-400 border-l-cyan-500 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }}></div>
            {/* Center icon */}
            <div className="absolute inset-5 rounded-full bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <DollarSign className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400">
              Analyzing Costs
            </span>
          </h2>
          <p className="text-sm text-gray-400 mb-10 font-mono">
            {targetAccountId ? `${targetAccountId}` : credentials.accountId}
            {isMasterView && ' (Organization)'}
          </p>

          {/* Progress steps */}
          <div className="space-y-4 text-left max-w-xs mx-auto mb-10">
            {[
              'Querying CUR data via Athena',
              'Retrieving cost trends',
              'Analyzing resources',
              'Generating recommendations',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm" style={{ animationDelay: `${i * 200}ms` }}>
                <div className="relative w-5 h-5 shrink-0">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/40"></div>
                  <div
                    className="absolute inset-[3px] rounded-full bg-cyan-400 animate-pulse"
                    style={{ animationDelay: `${i * 400}ms`, animationDuration: '1.5s' }}
                  ></div>
                </div>
                <span className="text-gray-300">{step}</span>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs mx-auto">
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 rounded-full"
                style={{
                  animation: 'progressBar 8s ease-in-out infinite',
                  width: '0%',
                }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-3 tracking-wide">Processing...</p>
          </div>
        </div>

        <style>{`
          @keyframes progressBar {
            0% { width: 5%; }
            20% { width: 25%; }
            40% { width: 45%; }
            60% { width: 65%; }
            80% { width: 85%; }
            100% { width: 95%; }
          }
        `}</style>
      </div>
    );
  }

  if (error || !data) {
    const errorText = error || 'No data could be retrieved.';
    const isCredentialsError = errorText.includes('Invalid AWS credentials') || 
                              errorText.includes('InvalidClientTokenId') ||
                              errorText.includes('security token');
    
    const isConnectionError = errorText.includes('Backend server not available') ||
                             errorText.includes('connection refused');
    return (
      <div className="min-h-screen p-4 lg:p-8 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {isMasterView ? 'Organization Dashboard' : 'Cost Dashboard'}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Account: {targetAccountId ? `${targetAccountId} (Linked)` : credentials.accountId}
              </p>
            </div>
          </div>
          <div className={`border rounded-xl p-8 text-center ${
            isCredentialsError ? 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800' : 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-center gap-4 mb-4">
              {isCredentialsError ? (
                <AlertCircle className="w-8 h-8 text-amber-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
              <h2 className={`text-2xl font-bold ${
                isCredentialsError ? 'text-amber-800 dark:text-amber-300' : 'text-red-800 dark:text-red-300'
              }`}>
                {isCredentialsError ? 'Invalid AWS Credentials' : 'Error Retrieving Data'}
              </h2>
            </div>

            <p className={`mb-6 ${
              isCredentialsError ? 'text-amber-700 dark:text-amber-300' : 'text-red-700 dark:text-red-300'
            }`}>
              {isCredentialsError 
                ? 'The provided AWS credentials are invalid or expired. Please check your Account ID and IAM Role ARN.'
                : isConnectionError
                ? 'Unable to connect to the backend server. Please ensure the backend is running.'
                : errorText
              }
            </p>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={retry}
                className={`flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors ${
                  isCredentialsError 
                    ? 'bg-amber-600 hover:bg-amber-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                <RefreshCw className="w-5 h-5" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mappedTop =
    mapTopSpendingResources(data?.topSpendingResources) ||
    mapTopSpendingResources(data?.top_spending_resources) ||
    mapTopSpendingResources(data?.topResources) ||
    mapTopSpendingResources(data?.top_resources) ||
    undefined;

  return (
    <div className="min-h-screen p-3 sm:p-4 lg:p-8 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6 lg:mb-8">
          {/* Row 1: Back + Title + Export */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-1 px-2 py-1.5 sm:px-3 sm:py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-all duration-200 shrink-0"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden sm:inline text-sm">Back</span>
              </button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {isMasterView ? 'Organization Dashboard' : 'Cost Dashboard'}
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate font-mono">
                  {targetAccountId ? `${targetAccountId} (Linked)` : credentials.accountId}
                  {isMasterView && ' (Master Payer)'}
                </p>
              </div>
            </div>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 sm:px-5 py-2 sm:py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg dark:shadow-gray-900/20 disabled:opacity-50 text-xs sm:text-sm shrink-0"
            >
              {isExporting ? (
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              )}
              <span className="hidden sm:inline">{isExporting ? 'Generating...' : 'Export PDF'}</span>
              <span className="sm:hidden">{isExporting ? '...' : 'PDF'}</span>
            </button>
          </div>

          {/* Row 2: Date selector */}
          <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        {isMasterView ? (
          /* Render Master Payer specific dashboard */
          <div ref={dashboardRef}>
            <MasterOverviewDashboard 
              data={data} 
              onDrillDown={(accId) => setTargetAccountId(accId)} 
            />
          </div>
        ) : (
          /* Render the standard Standalone / Drill-Down Dashboard */
          <>
            {/* Total Cost Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 lg:mb-8 text-white shadow-2xl">
              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="p-2 sm:p-3 bg-white/20 rounded-xl sm:rounded-2xl">
                  <DollarSign className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl lg:text-2xl font-bold">Total Monthly Cost</h2>
                  <p className="text-blue-100 text-xs sm:text-sm">
                    {dateRange.startDate === dateRange.endDate
                      ? new Date(dateRange.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                      : `${new Date(dateRange.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(dateRange.endDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </p>
                </div>
              </div>
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2">
                ${data.totalMonthlyCost?.toLocaleString?.() ?? 0}
              </div>
              <div className="flex items-center gap-2 text-blue-100 text-xs sm:text-sm">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Real-time data from AWS CUR Data</span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 mb-4 sm:mb-6 lg:mb-8 overflow-hidden">
              <div className="flex overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap transition-all duration-200 border-b-2 ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950'
                          : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span className="font-medium text-xs sm:text-sm md:text-base">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dashboard Content */}
            <div ref={dashboardRef} className="space-y-4 sm:space-y-6 lg:space-y-8">
              {activeTab === 'overview' && <OverviewDashboard data={data} isExporting={isExporting} />}
              {/* FIXED: Passing activeCredentials instead of credentials so the backend knows which account we are drilling down into */}
              {activeTab === 'services' && <CostChart data={data.serviceCosts} credentials={activeCredentials} isExporting={isExporting} />}
              {activeTab === 'users' && <UserCostChart data={data.userCosts} isExporting={isExporting} />}
              {activeTab === 'resources' && (
                <ResourceChart 
                  data={data.resourceCosts} 
                  dailyCostData={data.dailyCostData}
                  weeklyCostData={data.weeklyCostData}
                  topSpendingResources={mappedTop}
                  isExporting={isExporting}
                />
              )}
              {activeTab === 'projects' && <ProjectChart data={data.projectCosts} isExporting={isExporting} />}
              {activeTab === 'recommendations' && <RecommendationsPanel data={data.recommendations} />}
            </div>
          </>
        )}
      </div>

      <ChatbotWidget
        accountId={targetAccountId || credentials.accountId}
        accountType={targetAccountId ? 'standalone' : credentials.accountType}
      />
    </div>
  );
};

export default Dashboard;