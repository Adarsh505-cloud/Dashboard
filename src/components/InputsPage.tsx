import React, { useState, useEffect } from 'react';
import { Cloud, Shield, ArrowRight, Wifi, WifiOff, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { apiService } from '../services/api';

interface InputsPageProps {
  onGetDetails: (accountId: string, roleArn: string) => void;
}

const InputsPage: React.FC<InputsPageProps> = ({ onGetDetails }) => {
  const [accountId, setAccountId] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

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
    
    // Simulate brief loading for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
    onGetDetails(accountId.trim(), roleArn.trim());
  };

  const isValid = accountId.trim().length === 12 && roleArn.trim().includes('arn:aws:iam::');

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-orange-400 to-orange-500 rounded-2xl mb-6 shadow-lg">
            <Cloud className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            AWS Cost Analysis Dashboard
          </h1>
          <p className="text-xl text-gray-600 max-w-md mx-auto">
            Get comprehensive insights into your AWS spending patterns and optimize your cloud costs
          </p>
        </div>

        {/* Backend Status */}
        <div className={`mb-6 p-4 border rounded-xl ${getStatusColor()}`}>
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-6 h-6" />
              <h2 className="text-2xl font-semibold">Connect Your AWS Account</h2>
            </div>
            <p className="text-blue-100">
              Enter your AWS credentials to analyze your cost data securely
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  AWS Account ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="123456789012"
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <div className={`w-3 h-3 rounded-full ${accountId.length === 12 ? 'bg-green-400' : 'bg-gray-300'}`} />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  12-digit AWS account identifier
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  IAM Role ARN
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={roleArn}
                    onChange={(e) => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::123456789012:role/CostAnalysisRole"
                    className="w-full px-4 py-4 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 outline-none"
                    required
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <div className={`w-3 h-3 rounded-full ${roleArn.includes('arn:aws:iam::') ? 'bg-green-400' : 'bg-gray-300'}`} />
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  IAM role with Cost Explorer and billing read permissions
                </p>
              </div>
            </div>

            {/* Information Panel */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 mb-1">How it works</p>
                  <p className="text-blue-700">
                    The application will securely connect to your AWS account using the provided credentials 
                    and fetch real-time cost data. If there are any authentication issues, detailed error 
                    messages will be displayed to help you troubleshoot.
                  </p>
                </div>
              </div>
            </div>

            {backendStatus === 'disconnected' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800 mb-1">Backend Server Required</p>
                    <p className="text-amber-700">
                      The backend server is not running. Please start the backend server on port 3001 
                      to fetch real AWS data. You can still proceed to see the dashboard interface.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {backendStatus === 'connected' && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800 mb-1">Backend Connected</p>
                    <p className="text-green-700">
                      Ready to fetch real AWS cost data. The application will validate your credentials 
                      and provide detailed feedback if there are any issues.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!isValid || isLoading}
              className={`w-full py-4 px-6 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-3 ${
                isValid && !isLoading
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-1'
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