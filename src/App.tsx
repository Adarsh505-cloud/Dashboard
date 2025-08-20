import React, { useState } from 'react';
import InputsPage from './components/InputsPage';
import Dashboard from './components/Dashboard';

function App() {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {currentPage === 'inputs' ? (
        <InputsPage onGetDetails={handleGetDetails} />
      ) : (
        <Dashboard 
          credentials={awsCredentials!} 
          onBack={handleBackToInputs} 
        />
      )}
    </div>
  );
}

export default App;