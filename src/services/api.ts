// api.ts

// -------------------- Interfaces --------------------
export interface ResourceDetail {
  id: string;
  name: string;
  type: string;
  region: string;
  owner: string;
  project: string;
  createdDate: string;
  status: 'running' | 'stopped' | 'pending' | 'terminated' | 'unknown';
  cost: number;
  tags: Array<{ key: string; value: string }>;
  specifications?: {
    instanceType?: string;
    storage?: string;
    memory?: string;
    cpu?: string;
  };
}

export interface ApiCredentials {
  accountId: string;
  roleArn: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  details?: Array<{ field: string; message: string }>;
  timestamp?: string;
}

// -------------------- Base URL --------------------
const API_GATEWAY_URL =
  'https://yxxc6buhjk.execute-api.us-west-2.amazonaws.com'; // all endpoints (Express handles proxying to Lambda)

// -------------------- Service --------------------
class ApiService {
  private async makeRequest<T>(url: string, body?: any): Promise<T> {
    console.log(`🔄 Making API request to: ${url}`);

    try {
      const response = await fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      // Try to parse JSON safely
      const text = await response.text();
      let raw: any;
      try {
        raw = text ? JSON.parse(text) : null;
      } catch {
        raw = text;
      }

      // Detect ApiResponse<T>
      const looksLikeApiResponse =
        raw && typeof raw === 'object' && Object.prototype.hasOwnProperty.call(raw, 'success');

      if (looksLikeApiResponse) {
        const apiResp = raw as ApiResponse<T>;
        console.log('📦 Response (ApiResponse):', apiResp);

        if (!response.ok) {
          throw new Error(apiResp.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        if (!apiResp.success) {
          throw new Error(apiResp.error || 'API request failed');
        }

        return apiResp.data as T;
      } else {
        // plain JSON or text
        console.log('📦 Response (plain):', raw ?? text);
        if (!response.ok) {
          const errMsg = raw && raw.error ? raw.error : `HTTP ${response.status}: ${response.statusText}`;
          throw new Error(errMsg);
        }
        return (raw ?? text) as T;
      }
    } catch (error: unknown) {
      console.error(`❌ API request failed for ${url}:`, error);

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to backend server. Please ensure the backend is running.');
      }

      throw error instanceof Error ? error : new Error('Unknown error during API request');
    }
  }

  // ---------- Cost endpoints ----------
  async getComprehensiveAnalysis(credentials: ApiCredentials) {
    return this.makeRequest(`${API_GATEWAY_URL}/api/cost/analysis`, credentials);
  }

  async getResourcesForService(credentials: ApiCredentials, serviceName: string) {
    const body = { ...credentials, serviceName };
    return this.makeRequest<ResourceDetail[]>(`${API_GATEWAY_URL}/api/cost/resources`, body);
  }

  async getServiceCosts(credentials: ApiCredentials) {
    return this.makeRequest(`${API_GATEWAY_URL}/api/cost/services`, credentials);
  }

  async getUserCosts(credentials: ApiCredentials) {
    return this.makeRequest(`${API_GATEWAY_URL}/api/cost/users`, credentials);
  }

  async getProjectCosts(credentials: ApiCredentials) {
    return this.makeRequest(`${API_GATEWAY_URL}/api/cost/projects`, credentials);
  }

  async getRecommendations(credentials: ApiCredentials) {
    return this.makeRequest(`${API_GATEWAY_URL}/api/cost/recommendations`, credentials);
  }

  // ---------- Health check ----------
  async checkHealth(): Promise<{ status: string; timestamp: string; environment: string }> {
    const url = `${API_GATEWAY_URL}/health`;
    console.log(`🏥 Checking backend health: ${url}`);
    return this.makeRequest(url);
  }
}

export const apiService = new ApiService();
