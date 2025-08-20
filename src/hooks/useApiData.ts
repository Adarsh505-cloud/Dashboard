import { useState, useEffect } from 'react';
import { apiService, ApiCredentials } from '../services/api';

interface CostTrendData {
  month: string;
  cost: number;
  period: {
    Start: string;
    End: string;
  };
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

interface ApiData {
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
    resource: string;
    description: string;
    potentialSavings: number;
    lastActivity: string;
    action: string;
  }>;
  costTrendData?: CostTrendData[];
  dailyCostData?: DailyCostData[];
  weeklyCostData?: WeeklyCostData[];
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!credentials) {
      console.log('📝 No credentials provided');
      setData(emptyData);
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
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [credentials]);

  return {
    data,
    loading,
    error,
    retry: fetchData,
  };
};