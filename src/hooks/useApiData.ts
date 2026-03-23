import { useState, useEffect } from 'react';
import { apiService, ApiCredentials } from '../services/api';

// Define the shape of TopSpendingResource once, correctly
interface TopSpendingResource {
  service: string;
  region: string;
  resource_type: string;
  resource_id?: string | null;
  raw_resource_id?: string | null;
  total_cost: number;
}

// Correct CostTrendData to match OverviewDashboard's expectation
interface CostTrendData {
  date: string;
  cost: number;
}

interface DailyCostData {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Groups?: Array<{
    Keys?: string[];
    Metrics?: {
      BlendedCost?: {
        Amount?: string;
      };
    };
  }>;
}

interface WeeklyCostData {
  TimePeriod: {
    Start: string;
    End: string;
  };
  Groups?: Array<{
    Keys?: string[];
    Metrics?: {
      BlendedCost?: {
        Amount?: string;
      };
    };
  }>;
}

// This is the main interface to fix.
// Add all missing properties here.
export interface ApiData {
  totalMonthlyCost: number;
  serviceCosts: Array<{ service: string; productCode?: string; cost: number; region: string }>;
  regionCosts: Array<{ region: string; cost: number }>;
  userCosts: Array<{ user: string; cost: number; resources: number; resourcesList: string[] | null | string; }>;
  resourceCosts: Array<{ type: string; cost: number; trend: number[]; count: number }>;
  projectCosts: Array<{ project: string; cost: number; resources: number; owner: string }>;
  recommendations: Array<{
    id: string;
    type: 'idle' | 'oversized' | 'unused' | 'optimization';
    severity: 'high' | 'medium' | 'low';
    resource: string;
    description: string;
    potentialSavings: number;
    lastActivity: string;
    action: string;
  }>;
  costTrendData?: CostTrendData[];
  dailyCostData?: DailyCostData[];
  weeklyCostData?: WeeklyCostData[];
  topSpendingResources?: TopSpendingResource[];
  top_spending_resources?: TopSpendingResource[];
  topResources?: TopSpendingResource[];
  top_resources?: TopSpendingResource[];
  linkedAccountsSummary?: Array<{ accountId: string; accountName?: string; cost: number }>;
  carbonFootprint?: Array<{ region: string; emissions: number; count: number }>;
}

interface UseApiDataResult {
  data: ApiData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const emptyData: ApiData = {
  totalMonthlyCost: 0,
  serviceCosts: [],
  regionCosts: [],
  userCosts: [],
  resourceCosts: [],
  projectCosts: [],
  recommendations: [],
};

export const useApiData = (credentials: ApiCredentials | null): UseApiDataResult => {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true); // start true to avoid error flash on first render
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!credentials) {
      console.log('📝 No credentials provided');
      setData(emptyData);
      setLoading(false);
      return;
    }

    console.log('🚀 Starting API data fetch...');
    setLoading(true);
    setError(null);
    setData(null);

    try {
      // First check if backend is healthy
      console.log('🏥 Checking backend health...');
      await apiService.checkHealth();
      console.log('✅ Backend is healthy');

      // Fetch comprehensive analysis with real daily/weekly data
      console.log('📊 Fetching comprehensive cost analysis with real AWS data...');
      const analysisData = await apiService.getComprehensiveAnalysis(credentials);
      
      // Type assertion to ensure we have the correct type
      const typedAnalysisData = analysisData as ApiData;
      
      console.log('📈 Analysis data received:', {
        totalCost: typedAnalysisData.totalMonthlyCost,
        servicesCount: typedAnalysisData.serviceCosts?.length,
        usersCount: typedAnalysisData.userCosts?.length,
        projectsCount: typedAnalysisData.projectCosts?.length,
        recommendationsCount: typedAnalysisData.recommendations?.length,
        hasDailyData: !!typedAnalysisData.dailyCostData,
        hasWeeklyData: !!typedAnalysisData.weeklyCostData,
        dailyDataPoints: typedAnalysisData.dailyCostData?.length,
        weeklyDataPoints: typedAnalysisData.weeklyCostData?.length
      });

      setData(typedAnalysisData);
      console.log('✅ Successfully loaded real AWS data with daily/weekly cost trends');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('❌ Failed to fetch API data:', errorMessage);
      
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Use a stable key to avoid refetching when the object reference changes but values are the same
  const credentialsKey = credentials
    ? `${credentials.accountId}|${credentials.roleArn}|${credentials.accountType || ''}|${credentials.targetAccountId || ''}|${credentials.startDate || ''}|${credentials.endDate || ''}`
    : '';

  useEffect(() => {
    fetchData();
  }, [credentialsKey]);

  return {
    data,
    loading,
    error,
    retry: fetchData,
  };
};