// src/components/Dashboard.tsx
import React, { useState, useRef } from 'react';
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
  CheckCircle,
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
import { exportToPDF } from '../utils/pdfExport';
import { useApiData } from '../hooks/useApiData';

interface DashboardProps {
  credentials: {
    accountId: string;
    roleArn: string;
  };
  onBack: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ credentials, onBack }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const { data, loading, error, retry } = useApiData(credentials);

  const handleExportPDF = async () => {
    if (!dashboardRef.current || !data) return;
    
    setIsExporting(true);
    try {
      await exportToPDF(dashboardRef.current, credentials.accountId);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
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

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'services', label: 'Services', icon: Activity },
    { key: 'resources', label: 'Resources', icon: Server },
    { key: 'users', label: 'Users', icon: Users },
    { key: 'projects', label: 'Projects', icon: FolderOpen },
    { key: 'recommendations', label: 'Recommendations', icon: AlertTriangle },
  ];

  // Debugging: inspect incoming data shape (remove in prod)
  if (process.env.NODE_ENV !== 'production' && data) {
    // eslint-disable-next-line no-console
    console.log('Dashboard: incoming data shape:', {
      keys: Object.keys(data || {}),
      topSpendingResources: data?.topSpendingResources || data?.top_spending_resources || data?.topResources || data?.top_resources
    });
  }

  // Helper: normalize and map top spending resources to expected shape
  const mapTopSpendingResources = (rawAny: any): any[] | undefined => {
    if (!rawAny) return undefined;
    if (!Array.isArray(rawAny)) return undefined;

    return rawAny.map((r: any, idx: number) => {
      // Common nestings/field names to normalize:
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

      // cost fields might be named differently:
      const totalCost =
        r.total_cost ||
        r.cost ||
        r.amount ||
        r.totalCost ||
        Number(r.total_cost_usd) ||
        0;

      return {
        service: r.service || r.resource || r.serviceName || r.name || 'unknown',
        resource_type: r.resource_type || r.type || r.resourceType || 'unknown',
        resource_id: resourceId,
        raw_resource_id: r.raw_resource_id || r.rawId || null,
        total_cost: Number(totalCost || 0),
        // keep original for debugging if needed
        __raw: r,
        __index: idx,
      };
    });
  };

  // Prepare mappedTop from any likely api field names
  const mappedTop =
    mapTopSpendingResources(data?.topSpendingResources) ||
    mapTopSpendingResources(data?.top_spending_resources) ||
    mapTopSpendingResources(data?.topResources) ||
    mapTopSpendingResources(data?.top_resources) ||
    undefined;

  // Loading / Error / No-data UI (unchanged from your original code)
  if (loading) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
              <p className="text-gray-600">Account: {credentials.accountId}</p>
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
              <p>• Connecting to AWS Cost Explorer API</p>
              <p>• Retrieving daily and weekly cost data</p>
              <p>• Analyzing resource utilization patterns</p>
              <p>• Generating optimization recommendations</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isCredentialsError = error.includes('Invalid AWS credentials') || 
                              error.includes('InvalidClientTokenId') ||
                              error.includes('security token');
    
    const isConnectionError = error.includes('Backend server not available') ||
                             error.includes('connection refused');

    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
              <p className="text-gray-600">Account: {credentials.accountId}</p>
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
                {isCredentialsError ? 'Invalid AWS Credentials' : 'Connection Failed'}
              </h2>
            </div>
            
            <p className={`mb-6 ${
              isCredentialsError ? 'text-amber-700' : 'text-red-700'
            }`}>
              {isCredentialsError 
                ? 'The provided AWS credentials are invalid or expired. Please check your Account ID and IAM Role ARN.'
                : isConnectionError
                ? 'Unable to connect to the backend server. Please ensure the backend is running.'
                : error
              }
            </p>

            <div className={`rounded-lg p-4 mb-6 text-sm ${
              isCredentialsError ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
            }`}>
              {isCredentialsError ? (
                <div className="text-left">
                  <p className="font-medium mb-2">Common issues:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Account ID must be exactly 12 digits</li>
                    <li>IAM Role ARN format: arn:aws:iam::ACCOUNT:role/ROLE_NAME</li>
                    <li>Role must have Cost Explorer and billing permissions</li>
                    <li>Role must allow the assume role action</li>
                  </ul>
                </div>
              ) : (
                <div className="text-left">
                  <p className="font-medium mb-2">Troubleshooting:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure the backend server is running on port 3001</li>
                    <li>Check network connectivity</li>
                    <li>Verify CORS settings</li>
                  </ul>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                Back to Inputs
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

  if (!data) {
    return (
      <div className="min-h-screen p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
              <p className="text-gray-600">Account: {credentials.accountId}</p>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">No Data Available</h2>
            <p className="text-gray-600 mb-6">
              No cost data could be retrieved from your AWS account.
            </p>
            <button
              onClick={retry}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors mx-auto"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state with data
  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-all duration-200"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Cost Dashboard</h1>
              <p className="text-gray-600">Account: {credentials.accountId}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Calendar className="w-4 h-4" />
                Last updated
              </div>
              <div className="text-sm font-medium text-gray-900">
                {getCurrentDateTime()} IST
              </div>
            </div>
            
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50"
            >
              {isExporting ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
              {isExporting ? 'Generating...' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Total Cost Card */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 mb-8 text-white shadow-2xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl">
              <DollarSign className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Total Monthly Cost</h2>
              <p className="text-blue-100">Current billing period</p>
            </div>
          </div>
          <div className="text-5xl font-bold mb-2">
            ${data.totalMonthlyCost?.toLocaleString?.() ?? 0}
          </div>
          <div className="flex items-center gap-2 text-blue-100">
            <TrendingUp className="w-5 h-5" />
            <span>Real-time data from AWS CUR Data</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8 overflow-hidden">
          <div className="flex overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-3 px-6 py-4 whitespace-nowrap transition-all duration-200 border-b-2 ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Dashboard Content */}
        <div ref={dashboardRef} className="space-y-8">
          {activeTab === 'overview' && <OverviewDashboard data={data} />}
          {activeTab === 'services' && <CostChart data={data.serviceCosts} credentials={credentials} />}
          {activeTab === 'users' && <UserCostChart data={data.userCosts} />}
          {activeTab === 'resources' && (
            <ResourceChart 
              data={data.resourceCosts} 
              dailyCostData={data.dailyCostData}
              weeklyCostData={data.weeklyCostData}
              topSpendingResources={mappedTop}
            />
          )}
          {activeTab === 'projects' && <ProjectChart data={data.projectCosts} />}
          {activeTab === 'recommendations' && <RecommendationsPanel data={data.recommendations} />}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
