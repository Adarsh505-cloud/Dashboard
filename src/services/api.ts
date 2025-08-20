const API_BASE_URL = '';

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

class ApiService {
  private async makeRequest<T>(
    endpoint: string, 
    credentials: ApiCredentials
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log(`🔄 Making API request to: ${url}`);
    console.log(`📋 Credentials:`, {
      accountId: credentials.accountId,
      roleArn: credentials.roleArn.substring(0, 50) + '...'
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log(`📡 Response status: ${response.status} ${response.statusText}`);

      const data: ApiResponse<T> = await response.json();
      
      console.log(`📦 Response data:`, {
        success: data.success,
        hasData: !!data.data,
        error: data.error,
        code: data.code,
        timestamp: data.timestamp
      });

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data.data as T;
    } catch (error) {
      console.error(`❌ API request failed for ${endpoint}:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to backend server. Please ensure the backend is running on port 3001.');
      }
      
      throw error;
    }
  }

  async getComprehensiveAnalysis(credentials: ApiCredentials) {
    return this.makeRequest('/api/cost/analysis', credentials);
  }

  async getServiceCosts(credentials: ApiCredentials) {
    return this.makeRequest('/api/cost/services', credentials);
  }

  async getUserCosts(credentials: ApiCredentials) {
    return this.makeRequest('/api/cost/users', credentials);
  }

  async getProjectCosts(credentials: ApiCredentials) {
    return this.makeRequest('/api/cost/projects', credentials);
  }

  async getRecommendations(credentials: ApiCredentials) {
    return this.makeRequest('/api/cost/recommendations', credentials);
  }

  async checkHealth(): Promise<{ status: string; timestamp: string; environment: string }> {
    const url = `${API_BASE_URL}/health`;
    console.log(`🏥 Checking backend health: ${url}`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Invalid response format - expected JSON');
      }
      
      const data = await response.json();
      
      console.log(`💚 Backend health check:`, data);
      return data;
    } catch (error) {
      console.error(`💔 Backend health check failed:`, error);
      
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Backend server is not responding - connection refused');
      }
      
      throw new Error(`Backend health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const apiService = new ApiService();