// src/components/InputsPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Cloud,
  CheckCircle,
  LogOut,
  PlusCircle,
  ChevronDown,
  BookOpen,
  Settings,
  User,
  Info,
  KeyRound,
  FileText
} from 'lucide-react';
import { apiService } from '../services/api';
import ConnectAccountModal from './ConnectAccountModal';
import { AuthContextProps } from 'react-oidc-context';

interface InputsPageProps {
  onGetDetails: (accountId: string, roleArn: string) => void;
  auth: AuthContextProps;
}

interface Account {
  id: string;
  roleArn: string;
  name: string;
}

const predefinedAccounts: Account[] = [
  {
    id: '183631321229',
    roleArn: 'arn:aws:iam::183631321229:role/AWS-Cost-Analysis-Dashboard-Role',
    name: 'Titans Sandbox',
  },
];

const InputsPage: React.FC<InputsPageProps> = ({ onGetDetails, auth }) => {
  const [activeTab, setActiveTab] = useState('accounts');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  useEffect(() => {
    apiService.checkHealth()
      .then(() => setBackendStatus('connected'))
      .catch(() => setBackendStatus('disconnected'));
  }, []);

  const handleConnectNewAccount = (newAccountId: string, newRoleArn: string) => {
    setIsModalOpen(false);
    onGetDetails(newAccountId, newRoleArn);
  };
  
  const user = auth.user?.profile;
  
  const cognitoConfig = {
    domain: "YOUR_COGNITO_DOMAIN", // e.g., my-app.auth.us-west-2.amazoncognito.com
    clientId: "641sh8j3j5iv62aot4ecnlpc3q", // Replace with your actual client ID
    redirectUri: "https://cloudbillanalyzer.epiuse-aws.com",
  };

  const handlePasswordReset = () => {
    if (!cognitoConfig.domain.startsWith("YOUR_")) {
        const url = `https://${cognitoConfig.domain}/forgotPassword?client_id=${cognitoConfig.clientId}&response_type=code&scope=email+openid+phone&redirect_uri=${cognitoConfig.redirectUri}`;
        window.location.href = url;
    } else {
        alert("Cognito domain is not configured. Please update it in InputsPage.tsx.");
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'accounts':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Cloud Accounts</h1>
            <p className="mt-2 text-gray-600">Analyze onboarded accounts or connect a new one.</p>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {predefinedAccounts.map(acc => (
                <div key={acc.id} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                       <FileText className="w-6 h-6 text-blue-500" />
                       <div>
                         <h3 className="text-lg font-semibold text-gray-900">{acc.name}</h3>
                         <p className="text-sm text-gray-500 font-mono">{acc.id}</p>
                       </div>
                    </div>
                  </div>
                  <button
                    onClick={() => onGetDetails(acc.id, acc.roleArn)}
                    className="w-full mt-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Analyze
                  </button>
                </div>
              ))}
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors flex flex-col items-center justify-center"
              >
                <PlusCircle className="w-8 h-8 text-gray-400 mb-2" />
                <span className="font-semibold text-gray-700">Onboard a New Account</span>
              </button>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
            <p className="mt-2 text-gray-600">Manage your account settings.</p>
            <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-lg">
                <div className="mb-4">
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-lg font-semibold text-gray-800">{user?.email}</p>
                </div>
                <div className="pt-4 border-t">
                    <h3 className="font-semibold text-gray-800 mb-2">Security</h3>
                     <button
                        onClick={handlePasswordReset}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200"
                    >
                        <KeyRound className="w-4 h-4" />
                        Reset Password
                    </button>
                    <p className="text-xs text-gray-500 mt-2">You will be redirected to a secure page to reset your password.</p>
                </div>
            </div>
          </div>
        );
      case 'about':
        return (
          <div>
            <h1 className="text-3xl font-bold text-gray-900">About</h1>
            <p className="mt-2 text-gray-600">Information about this application.</p>
            <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm max-w-lg">
                <h3 className="text-lg font-semibold text-gray-800">AWS Cost Analysis Dashboard</h3>
                <p className="text-gray-600 mt-2">This application provides comprehensive insights into your AWS spending patterns, helping you identify opportunities for cost optimization. By securely connecting to your AWS account via a read-only IAM role, it visualizes cost data across services, regions, users, and projects.</p>
                <div className="mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-700"><strong>Version:</strong> 1.0.0</p>
                </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {isModalOpen && <ConnectAccountModal onClose={() => setIsModalOpen(false)} onConnect={handleConnectNewAccount} />}
      <div className="flex h-screen bg-gray-100 font-sans">
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b h-16">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-800">Cost Analyzer</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <button onClick={() => setActiveTab('accounts')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${activeTab === 'accounts' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Cloud className="w-5 h-5" />
              <span>Accounts</span>
            </button>
            <div className="pt-4 mt-2 border-t">
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>
                <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${activeTab === 'profile' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <User className="w-5 h-5" />
                    <span>User Profile</span>
                </button>
                 <button onClick={() => setActiveTab('about')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg ${activeTab === 'about' ? 'bg-blue-50 text-blue-600 font-semibold' : 'text-gray-600 hover:bg-gray-100'}`}>
                    <Info className="w-5 h-5" />
                    <span>About</span>
                </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between h-16">
            <div></div>
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100"
              >
                {backendStatus === 'connected' && <div className="w-2.5 h-2.5 bg-green-500 rounded-full" title="Backend Connected"></div>}
                {backendStatus === 'disconnected' && <div className="w-2.5 h-2.5 bg-red-500 rounded-full" title="Backend Disconnected"></div>}
                <div className="w-8 h-8 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold">
                  {user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">{user?.email}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border z-10">
                  <button
                    onClick={() => auth.signoutRedirect()}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-8">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

export default InputsPage;