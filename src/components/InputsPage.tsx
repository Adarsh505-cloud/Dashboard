// src/components/InputsPage.tsx
import React, { useState, useEffect } from 'react';
import {
  Cloud,
  LogOut,
  PlusCircle,
  ChevronDown,
  User,
  Info,
  Database,
  Loader,
} from 'lucide-react';
import { apiService } from '../services/api';
import ConnectAccountModal from './ConnectAccountModal';
import { AuthContextProps } from 'react-oidc-context';

// --- PROPS AND TYPES ---
interface InputsPageProps {
  onGetDetails: (accountId: string, roleArn: string) => void;
  auth: AuthContextProps;
}

interface Account {
  accountId: string;
  roleArn: string;
  name: string;
}

// --- MAIN COMPONENT ---
const InputsPage: React.FC<InputsPageProps> = ({ onGetDetails, auth }) => {
  const [activeTab, setActiveTab] = useState('accounts');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);

  const user = auth.user?.profile;
  const isAdmin = (user?.['cognito:groups'] as string[])?.includes('Admins') ?? false;

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const response = await apiService.getOnboardedAccounts();
        if (response.success && Array.isArray(response.data)) {
            setAccounts(response.data);
        } else {
            throw new Error(response.error || "Failed to fetch accounts");
        }
      } catch (error) {
        console.error("Failed to fetch accounts:", error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    if (auth.isAuthenticated) {
        fetchAccounts();
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    apiService.checkHealth()
      .then(() => setBackendStatus('connected'))
      .catch(() => setBackendStatus('disconnected'));
  }, []);

  const handleConnectNewAccount = async (newAccountId: string, newRoleArn: string) => {
    setIsModalOpen(false);
    
    const newAccount = {
      id: newAccountId,
      roleArn: newRoleArn,
      name: `Account ${newAccountId.slice(-4)}`,
    };

    try {
        const response = await apiService.saveOnboardedAccount(newAccount);
        if (response.success && response.data) {
            setAccounts(prev => [...prev, response.data!]);
            onGetDetails(newAccountId, newRoleArn);
        } else {
            throw new Error(response.error || "Failed to save account");
        }
    } catch (error) {
        console.error("Failed to save account:", error);
        alert(`Error: Could not save the new account. Please check the console.`);
    }
  };
  
  const cognitoConfig = {
    domain: "https://us-west-2xf0vqvyuh.auth.us-west-2.amazoncognito.com",
    clientId: "641sh8j3j5iv62aot4ecnlpc3q",
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
    if (isLoadingAccounts) {
        return (
            <div className="flex justify-center items-center h-full">
                <Loader className="w-8 h-8 animate-spin text-blue-600" />
                <p className="ml-4 text-gray-600">Fetching onboarded accounts...</p>
            </div>
        );
    }
    switch (activeTab) {
      case 'accounts':
        return <AccountsTab accounts={accounts} isAdmin={isAdmin} onGetDetails={onGetDetails} onModalOpen={() => setIsModalOpen(true)} />;
      case 'profile':
        return <ProfileTab onPasswordReset={handlePasswordReset} />;
      case 'about':
        return <AboutTab />;
      default:
        return null;
    }
  };

  return (
    <>
      {isModalOpen && <ConnectAccountModal onClose={() => setIsModalOpen(false)} onConnect={handleConnectNewAccount} />}
      <div className="flex h-screen bg-gray-100 font-sans text-gray-800">
        <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
          <div className="flex items-center gap-3 p-4 border-b h-16 shrink-0">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-800">Cost Analyzer</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            <SidebarButton text="Accounts" icon={Cloud} active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} />
            <div className="pt-4 mt-2 border-t">
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Settings</h3>
                <SidebarButton text="User Profile" icon={User} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} />
                <SidebarButton text="About" icon={Info} active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
            </div>
          </nav>
        </aside>
        <div className="flex-1 flex flex-col">
          <header className="bg-white border-b border-gray-200 p-4 flex items-center justify-between h-16 shrink-0">
             <div>
                {backendStatus === 'connected' && <div className="w-3 h-3 bg-green-400 rounded-full" title="Backend Connected"></div>}
                {backendStatus === 'disconnected' && <div className="w-3 h-3 bg-red-500 rounded-full" title="Backend Disconnected"></div>}
            </div>
            <div className="relative">
              <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm">
                  {user?.email?.charAt(0).toUpperCase() || 'A'}
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border z-10 animate-in">
                  <button onClick={() => auth.signoutRedirect()} className="w-full text-left flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors">
                    <LogOut className="w-4 h-4" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-8 animate-in" key={activeTab}>
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

// --- Child Components ---
const SidebarButton = ({ text, icon: Icon, active, onClick }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${active ? 'bg-blue-50 text-blue-600 font-bold shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-800'}`}>
        <Icon className="w-5 h-5" />
        <span>{text}</span>
    </button>
);

const AccountsTab = ({ accounts, isAdmin, onGetDetails, onModalOpen }: { accounts: Account[], isAdmin: boolean, onGetDetails: (id: string, arn: string) => void, onModalOpen: () => void }) => (
    <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="p-6 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg">
                <Database className="w-7 h-7 opacity-50 mb-4"/>
                <p className="text-sm">Total Onboarded Accounts</p>
                <p className="text-3xl font-bold">{accounts.length}</p>
            </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Onboarded Accounts</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {accounts.map(acc => (
                <div key={acc.accountId} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between transition-all hover:shadow-lg hover:-translate-y-1">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                           <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0"><Cloud className="w-6 h-6"/></div>
                           <div>
                             <h3 className="text-lg font-bold text-gray-900">{acc.name}</h3>
                             <p className="text-sm text-gray-500 font-mono">{acc.accountId}</p>
                           </div>
                        </div>
                    </div>
                    <button
                        onClick={() => onGetDetails(acc.accountId, acc.roleArn)}
                        className="w-full mt-4 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Analyze
                    </button>
                </div>
            ))}
            {isAdmin && (
              <button onClick={onModalOpen} className="bg-white p-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-500 hover:bg-blue-50/50 transition-colors flex flex-col items-center justify-center text-center">
                  <PlusCircle className="w-10 h-10 text-gray-400 mb-2" />
                  <span className="font-semibold text-gray-700">Onboard a New Account</span>
              </button>
            )}
        </div>
    </div>
);

const ProfileTab = ({ onPasswordReset }: { onPasswordReset: () => void }) => (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">User Profile</h1>
      <p className="mt-2 text-gray-600">Manage your account and security settings.</p>
      <div className="mt-8 bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
          <h3 className="font-bold text-xl mb-6">Security Settings</h3>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                    <h4 className="font-semibold">Password</h4>
                    <p className="text-sm text-gray-500">Strengthen your account with a new password.</p>
                </div>
                <button onClick={onPasswordReset} className="px-4 py-2 text-sm font-semibold text-blue-600 bg-blue-100 rounded-lg hover:bg-blue-200">Reset Password</button>
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-gray-50 opacity-70">
                <div>
                    <h4 className="font-semibold text-gray-700">Two-Factor Authentication (2FA)</h4>
                    <p className="text-sm text-gray-500">Add an extra layer of security (coming soon).</p>
                </div>
                <button className="px-4 py-2 text-sm font-semibold text-gray-500 bg-gray-200 rounded-lg cursor-not-allowed">Enable</button>
            </div>
          </div>
      </div>
    </div>
);

const AboutTab = () => (
    <div>
      <h1 className="text-3xl font-bold text-gray-900">About</h1>
      <p className="mt-2 text-gray-600">Information about this application.</p>
      <div className="mt-8 bg-white p-8 rounded-xl border border-gray-200 shadow-sm max-w-2xl">
          <h3 className="font-bold text-xl mb-4">AWS Cost Analysis Dashboard</h3>
          <p className="text-gray-600 mb-6">This tool securely connects to your AWS account to provide comprehensive insights into your cloud spending, helping you identify opportunities for cost optimization.</p>
          <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-gray-700 font-mono">Version: 1.0.0</p>
          </div>
      </div>
    </div>
);

export default InputsPage;