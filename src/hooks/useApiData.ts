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

interface CostTrendData {
  date: string;
  cost: number;
}

interface DailyCostData {
  TimePeriod: { Start: string; End: string; };
  Groups?: Array<{ Keys?: string[]; Metrics?: { BlendedCost?: { Amount?: string; }; }; }>;
}

interface WeeklyCostData {
  TimePeriod: { Start: string; End: string; };
  Groups?: Array<{ Keys?: string[]; Metrics?: { BlendedCost?: { Amount?: string; }; }; }>;
}

// NEW: Interface for the 7 dashboard cards
export interface DashboardMetrics {
  totalSpend: number;
  activeAccounts: number;
  supportCost: number;
  marketplaceCost: number;
  topService: { label: string; cost: number };
  topRegion: { label: string; cost: number };
  topAccount: { label: string; cost: number };
}

export interface OuMetrics {
  ouSummary: Array<{ ou_name: string; account_count: number; total_cost: number }>;
  topServicePerOu: Array<{ ou_name: string; top_service: string; service_cost: number }>;
  dailyOuTrend: Array<{ usage_date: string; ou_name: string; daily_cost: number }>;
  accountsByOu: Array<{ ou_name: string; account_id: string; account_name: string; account_cost: number }>;
}

export interface ProductCategoryMetrics {
  categorySummary: Array<{ category_name: string; service_count: number; total_cost: number }>;
  topServicePerCategory: Array<{ category_name: string; top_service: string; service_cost: number }>;
  dailyCategoryTrend: Array<{ usage_date: string; category_name: string; daily_cost: number }>;
  servicesByCategory: Array<{ category_name: string; service_name: string; service_cost: number }>;
}

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
  dashboardMetrics?: DashboardMetrics;
  ouMetrics?: OuMetrics;
  productCategoryMetrics?: ProductCategoryMetrics;
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
  dashboardMetrics: {
    totalSpend: 0,
    activeAccounts: 0,
    supportCost: 0,
    marketplaceCost: 0,
    topService: { label: 'N/A', cost: 0 },
    topRegion: { label: 'N/A', cost: 0 },
    topAccount: { label: 'N/A', cost: 0 }
  }
};

export const useApiData = (credentials: ApiCredentials | null): UseApiDataResult => {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!credentials) {
      setData(emptyData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setData(null);

    try {
      await apiService.checkHealth();
      const analysisData = await apiService.getComprehensiveAnalysis(credentials);
      
      const typedAnalysisData = analysisData as ApiData;
      
      // Safety mapping in case backend hasn't updated the cache yet
      const safeData: ApiData = {
        ...typedAnalysisData,
        dashboardMetrics: typedAnalysisData.dashboardMetrics || emptyData.dashboardMetrics
      };

      setData(safeData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

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