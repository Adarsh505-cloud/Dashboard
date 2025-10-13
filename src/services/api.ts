// src/services/api.ts

// --- INTERFACES ---
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

export interface OnboardedAccount {
    id: string;
    accountId: string;
    roleArn: string;
    name: string;
}


// --- CONFIGURATION ---
const API_GATEWAY_URL = 'https://yxxc6buhjk.execute-api.us-west-2.amazonaws.com';

export const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-west-2.amazonaws.com/us-west-2_XF0vQvYuH",
  client_id: "641sh8j3j5iv62aot4ecnlpc3q", // Your actual Client ID
};

// --- HELPER TO GET AUTH TOKEN ---
const getAuthHeader = (): string => {
    const oidcStorageKey = `oidc.user:${cognitoAuthConfig.authority}:${cognitoAuthConfig.client_id}`;
    const oidcStorage = sessionStorage.getItem(oidcStorageKey);
    
    if (oidcStorage) {
        try {
            const user = JSON.parse(oidcStorage);
            if (user && user.access_token) {
                return `Bearer ${user.access_token}`;
            }
        } catch (e) {
            console.error("Failed to parse OIDC user from sessionStorage", e);
        }
    }
    return '';
};


// --- API SERVICE CLASS ---
class ApiService {
  private async makeRequest<T>(url: string, body?: any, method: string = 'POST'): Promise<any> {
    console.log(`Making API request: ${method} ${url}`);

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
    };

    try {
      const response = await fetch(url, {
        method: body ? method : 'GET',
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const responseBody = await response.json();

      if (!response.ok) {
        throw new Error(responseBody.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      return responseBody;

    } catch (error: unknown) {
      console.error(`API request failed for ${url}:`, error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Unable to connect to backend server. Please ensure the backend is running.');
      }
      throw error instanceof Error ? error : new Error('Unknown error during API request');
    }
  }

  // --- ACCOUNT MANAGEMENT METHODS ---
  async getOnboardedAccounts(): Promise<ApiResponse<OnboardedAccount[]>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/accounts`, undefined, 'GET');
  }

  async saveOnboardedAccount(account: { id: string; roleArn: string; name: string }): Promise<ApiResponse<OnboardedAccount>> {
    const payload = { 
        accountId: account.id, 
        roleArn: account.roleArn, 
        name: account.name 
    };
    return this.makeRequest(`${API_GATEWAY_URL}/api/accounts`, payload, 'POST');
  }
  
  // --- USER MANAGEMENT METHODS ---
  async getUsers(): Promise<ApiResponse<any[]>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/users`, undefined, 'GET');
  }

  async createUser(userData: { email: string; username: string; temporaryPassword: string; role: 'Admins' | 'Viewers' }): Promise<ApiResponse<any>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/users`, userData, 'POST');
  }

  async updateUserRole(username: string, newRole: 'Admins' | 'Viewers'): Promise<ApiResponse<any>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/users/${username}/role`, { newRole }, 'PUT');
  }

  async getUserAccountMappings(userId: string): Promise<ApiResponse<string[]>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/users/${userId}/accounts`, undefined, 'GET');
  }

  async updateUserAccountMappings(userId: string, accountIds: string[]): Promise<ApiResponse<any>> {
    return this.makeRequest(`${API_GATEWAY_URL}/api/users/${userId}/accounts`, { accountIds }, 'PUT');
  }

  // --- EXISTING METHODS ---
  async getComprehensiveAnalysis(credentials: ApiCredentials) {
    const response = await this.makeRequest<any>(`${API_GATEWAY_URL}/api/cost/analysis`, credentials);
    return response.data;
  }

  async getResourcesForService(credentials: ApiCredentials, serviceName: string) {
    const body = { ...credentials, serviceName };
    const response = await this.makeRequest<ResourceDetail[]>(`${API_GATEWAY_URL}/api/cost/resources`, body);
    return response.data;
  }
  
  async checkHealth(): Promise<{ status: string; timestamp: string; environment: string }> {
    return this.makeRequest(`${API_GATEWAY_URL}/health`, undefined, 'GET');
  }
}

export const apiService = new ApiService();