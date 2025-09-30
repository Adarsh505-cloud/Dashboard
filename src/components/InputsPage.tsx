import React, { useState, useEffect } from 'react';
import { Cloud, Shield, ArrowRight, Wifi, WifiOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { apiService } from '../services/api';

interface InputsPageProps {
  onGetDetails: (accountId: string, roleArn: string) => void;
}

interface Account {
  id: string;
  roleArn: string;
  name: string;
}

// Predefined list of accounts
const predefinedAccounts: Account[] = [
  {
    id: '183631321229',
    roleArn: 'arn:aws:iam::183631321229:role/AWS-Cost-Analysis-Dashboard-Role',
    name: 'Titans Sandbox',
  },
  // Add more accounts here if needed
];

const InputsPage: React.FC<InputsPageProps> = ({ onGetDetails }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>(predefinedAccounts[0].id);
  const [accountId, setAccountId] = useState<string>(predefinedAccounts[0].id);
  const [roleArn, setRoleArn] = useState<string>(predefinedAccounts[0].roleArn);
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  // Sync account details when selection changes
  useEffect(() => {
    const selected = predefinedAccounts.find(acc => acc.id === selectedAccountId);
    if (selected) {
      setAccountId(selected.id);
      setRoleArn(selected.roleArn);
    }
  }, [selectedAccountId]);

  // Check backend health on component mount
  useEffect(() => {
    const checkBackend = async () => {
      try {
        await apiService.checkHealth();
        setBackendStatus('connected');
        console.log('✅ Backend is available');
      } catch (error) {
        setBackendStatus('disconnected');
        console.log('❌ Backend is not available:', error);
      }
    };

    checkBackend();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId.trim() || !roleArn.trim()) return;

    setIsLoading(true);
    console.log('🚀 Submitting credentials:', {
      accountId: accountId.trim(),
      roleArn: roleArn.trim().substring(0, 50) + '...'
    });

    // Brief loading delay for better UX
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
    onGetDetails(accountId.trim(), roleArn.trim());
  };

  // Validation
  const isValid = accountId.trim().length === 12 && roleArn.trim().includes('arn:aws:iam::');

  // Status indicators
  const getStatusIcon = () => {
    switch (backendStatus) {
      case 'checking':
        return <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse" />;
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-600" />;
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-red-600" />;
    }
  };

  const getStatusText = () => {
    switch (backendStatus) {
      case 'checking':
        return 'Checking backend connection...';
      case 'connected':
        return 'Backend connected - Ready to fetch AWS data';
      case 'disconnected':
        return 'Backend disconnected - Please start the backend server';
    }
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'checking':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      case 'connected':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'disconnected':
        return 'text-red-700 bg-red-50 border-red-200';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="w-full max-w-2xl">
        {/* Header Section */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl mb-5 shadow-lg">
            <Cloud className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">
            AWS Cost Analysis Dashboard
          </h1>
          <p className="text-lg text-gray-600 max-w-lg mx-auto">
            Get comprehensive insights into your AWS spending patterns and optimize your cloud costs
          </p>
        </div>

        {/* Backend Status */}
        <div className={`mb-6 p-4 rounded-xl border ${getStatusColor()} transition-all duration-300`}>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 transition-all duration-300 hover:shadow-2xl">
          {/* Card Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6" />
              <h2 className="text-2xl font-semibold">Connect Your AWS Account</h2>
            </div>
            <p className="text-blue-100">
              Select your account to analyze cost data securely
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Account Selection */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Select Account
              </label>
              <div className="relative">
                <select
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-5 py-4 text-lg border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all duration-200 outline-none appearance-none bg-white"
                >
                  {predefinedAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} — {acc.id}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                  <svg className="fill-current h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Account Details Card */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 transition-all duration-300 hover:border-blue-300">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-500" />
                Account Details
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Account ID</p>
                  <p className="font-mono font-medium text-gray-900 bg-white px-3 py-2 rounded-lg border border-gray-200">
                    {accountId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">IAM Role ARN</p>
                  <p className="font-mono text-sm text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200 break-all">
                    {roleArn}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-xs text-gray-500 italic">
                This account is pre-approved for cost analysis with the required permissions.
              </p>
            </div>

            {/* Status Messages */}
            {backendStatus === 'disconnected' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl transition-all duration-300">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">Backend Server Required</p>
                    <p className="text-amber-700">
                      The backend server is not running. Please start the backend server to fetch real AWS data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {backendStatus === 'connected' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl transition-all duration-300">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800 mb-1">Backend Connected</p>
                    <p className="text-green-700">
                      Ready to fetch real AWS cost data with your selected account.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3 shadow-md ${
                isValid && !isLoading
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-lg transform hover:-translate-y-0.5'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  Analyze AWS Costs
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            🔒 Your credentials are processed securely and never stored
          </p>
        </div>
      </div>
    </div>
  );
};

export default InputsPage;