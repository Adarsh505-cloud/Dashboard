// src/components/ManageAccessModal.tsx
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { X, Loader, Save } from 'lucide-react';

interface ManageAccessModalProps {
  user: { id: string; email: string };
  allAccounts: { accountId: string; name: string }[];
  onClose: () => void;
}

const ManageAccessModal: React.FC<ManageAccessModalProps> = ({ user, allAccounts, onClose }) => {
  const [assignedAccounts, setAssignedAccounts] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const response = await apiService.getUserAccountMappings(user.id);
        if (response.success && response.data) {
          setAssignedAccounts(new Set(response.data));
        }
      } catch (error) {
        console.error("Failed to fetch mappings:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchMappings();
  }, [user.id]);

  const handleToggleAccount = (accountId: string) => {
    setAssignedAccounts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(accountId)) {
        newSet.delete(accountId);
      } else {
        newSet.add(accountId);
      }
      return newSet;
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      await apiService.updateUserAccountMappings(user.id, Array.from(assignedAccounts));
      onClose();
    } catch (error) {
      console.error("Failed to save mappings:", error);
      alert("Failed to save. Please check console.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Manage Access</h2>
            <p className="text-sm text-gray-600">Assign accounts for {user.email}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex justify-center items-center"><Loader className="animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {allAccounts.map(account => (
                <div key={account.accountId} className="flex items-center p-3 rounded-lg border hover:bg-gray-50">
                  <input
                    type="checkbox"
                    id={account.accountId}
                    className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={assignedAccounts.has(account.accountId)}
                    onChange={() => handleToggleAccount(account.accountId)}
                  />
                  <label htmlFor={account.accountId} className="ml-3 text-sm">
                    <span className="font-medium text-gray-900">{account.name}</span>
                    <span className="text-gray-500 ml-2 font-mono">{account.accountId}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="p-6 bg-gray-50 border-t flex justify-end">
          <button onClick={handleSave} disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
            {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManageAccessModal;