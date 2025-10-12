// src/App.tsx
import { useState } from 'react';
import { useAuth } from 'react-oidc-context';
import InputsPage from './components/InputsPage';
import Dashboard from './components/Dashboard';
import { LogIn, Loader, AlertCircle } from 'lucide-react';

function App() {
  const auth = useAuth();
  const [currentPage, setCurrentPage] = useState<'inputs' | 'dashboard'>('inputs');
  const [awsCredentials, setAwsCredentials] = useState<{
    accountId: string;
    roleArn: string;
  } | null>(null);

  const handleGetDetails = (accountId: string, roleArn: string) => {
    setAwsCredentials({ accountId, roleArn });
    setCurrentPage('dashboard');
  };

  const handleBackToInputs = () => {
    setCurrentPage('inputs');
    setAwsCredentials(null);
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-gray-700">
        <Loader className="w-12 h-12 animate-spin mb-4" />
        <p className="text-lg">Loading session...</p>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-red-700">
        <AlertCircle className="w-12 h-12 mb-4" />
        <p className="text-lg font-semibold">Authentication Error</p>
        <p>{auth.error.message}</p>
      </div>
    );
  }

  if (auth.isAuthenticated) {
    if (currentPage === 'inputs') {
      return <InputsPage onGetDetails={handleGetDetails} auth={auth} />;
    }
    if (currentPage === 'dashboard' && awsCredentials) {
      return <Dashboard credentials={awsCredentials} onBack={handleBackToInputs} />;
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the Cost Analysis Dashboard</h1>
        <p className="text-gray-600 mb-8">Please sign in to continue.</p>
        <button
          onClick={() => auth.signinRedirect()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <LogIn className="w-5 h-5" />
          Sign In
        </button>
      </div>
    </div>
  );
}

export default App;