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
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isMasterView ? 'Organization Dashboard' : 'Cost Dashboard'}
              </h1>
              <p className="text-gray-600">
                Account: {targetAccountId ? `${targetAccountId} (Linked)` : credentials.accountId}
                {isMasterView && ' (Master Payer)'}
              </p>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              <h2 className="text-2xl font-bold text-blue-800">Loading AWS Data</h2>
            </div>
            <p className="text-blue-700 mb-4">
              Fetching real-time cost analysis from your AWS account. This may take a few moments...
            </p>
            <div className="bg-blue-100 rounded-lg p-4 text-sm text-blue-800">
              <p>• Querying AWS CUR data via Athena</p>
              <p>• Retrieving daily and weekly cost trends</p>
              <p>• Analyzing resource ownership and utilization</p>
              <p>• Generating optimization recommendations</p>
            </div>
          </div>
        </div>
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
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {isMasterView ? 'Organization Dashboard' : 'Cost Dashboard'}
              </h1>
              <p className="text-gray-600">
                Account: {targetAccountId ? `${targetAccountId} (Linked)` : credentials.accountId}
              </p>
            </div>
          </div>
          <div className={`border rounded-xl p-8 text-center ${
            isCredentialsError ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-center gap-4 mb-4">
              {isCredentialsError ? (
                <AlertCircle className="w-8 h-8 text-amber-600" />
              ) : (
                <XCircle className="w-8 h-8 text-red-600" />
              )}
              <h2 className={`text-2xl font-bold ${
                isCredentialsError ? 'text-amber-800' : 'text-red-800'
              }`}>
                {isCredentialsError ? 'Invalid AWS Credentials' : 'Error Retrieving Data'}
              </h2>
            </div>
            
            <p className={`mb-6 ${
              isCredentialsError ? 'text-amber-700' : 'text-red-700'
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
    <div className="min-h-screen p-3 sm:p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-4 sm:mb-6 lg:mb-8 gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={handleBack}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200 shrink-0"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                {isMasterView ? 'Organization Dashboard' : 'Cost Dashboard'}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                Account: {targetAccountId ? `${targetAccountId} (Linked)` : credentials.accountId}
                {isMasterView && ' (Master Payer)'}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <DateRangeSelector dateRange={dateRange} onDateRangeChange={setDateRange} />

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 text-sm sm:text-base"
            >
              {isExporting ? (
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Download className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
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
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 mb-4 sm:mb-6 lg:mb-8 overflow-hidden">
              <div className="flex overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`flex items-center gap-1.5 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 whitespace-nowrap transition-all duration-200 border-b-2 ${
                        activeTab === tab.key
                          ? 'border-blue-500 text-blue-600 bg-blue-50'
                          : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
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

      <ChatbotWidget accountId={credentials.accountId} accountType={credentials.accountType} />
    </div>
  );
};

export default Dashboard;