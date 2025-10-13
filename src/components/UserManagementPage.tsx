// src/components/UserManagementPage.tsx
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { User, Shield, Loader, Edit } from 'lucide-react';
import ManageAccessModal from './ManageAccessModal'; // We'll create this next

interface User {
  id: string;
  email: string;
  status: string;
  createdAt: string;
}

interface Account {
  accountId: string;
  name: string;
}

interface UserManagementPageProps {
  allAccounts: Account[];
}

const UserManagementPage: React.FC<UserManagementPageProps> = ({ allAccounts }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await apiService.getUsers();
        if (response.success) {
          setUsers(response.data || []);
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleManageAccess = (user: User) => {
    setSelectedUser(user);
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <div className="flex justify-center items-center"><Loader className="animate-spin" /></div>;
  }

  return (
    <>
      {isModalOpen && selectedUser && (
        <ManageAccessModal
          user={selectedUser}
          allAccounts={allAccounts}
          onClose={() => setIsModalOpen(false)}
        />
      )}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
        <p className="mt-2 text-gray-600">Assign account access to viewer users.</p>
        <div className="mt-8 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="font-medium text-gray-900">{user.email}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'CONFIRMED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleManageAccess(user)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1">
                        <Edit className="w-4 h-4" /> Manage Access
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserManagementPage;