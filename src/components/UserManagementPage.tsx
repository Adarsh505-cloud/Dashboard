// src/components/UserManagementPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/api';
import { Loader, Edit, UserPlus, ChevronDown, Trash2 } from 'lucide-react';
import ManageAccessModal from './ManageAccessModal';
import CreateUserModal from './CreateUserModal';

interface CognitoUser {
  id: string; // This is the UUID (sub)
  username: string; // This is the username used for Cognito API calls
  email: string;
  status: string;
  createdAt: string | null;
  groups: string[];
}
interface Account { accountId: string; name: string; }
interface UserManagementPageProps { allAccounts: Account[]; }

const UserManagementPage: React.FC<UserManagementPageProps> = ({ allAccounts }) => {
  const [users, setUsers] = useState<CognitoUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<CognitoUser | null>(null);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getUsers();
      if (response.success) setUsers(response.data || []);
    } catch (error) { console.error("Failed to fetch users:", error); } 
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleManageAccess = (user: CognitoUser) => {
    setSelectedUser(user);
    setIsAccessModalOpen(true);
  };

  const handleRoleChange = async (username: string, newRole: 'Admins' | 'Viewers') => {
    if (!username) return alert("Cannot change role for user with invalid username.");
    try {
        await apiService.updateUserRole(username, newRole);
        fetchUsers();
    } catch (error) {
        console.error("Failed to update role:", error);
        alert("Failed to update user role.");
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (window.confirm(`Are you sure you want to delete user ${username}? This action cannot be undone.`)) {
        try {
            await apiService.deleteUser(username);
            fetchUsers();
        } catch (error) {
            console.error("Failed to delete user:", error);
            alert("Failed to delete user. Please check the console.");
        }
    }
  };

  if (isLoading) return <div className="flex justify-center items-center"><Loader className="animate-spin" /></div>;

  return (
    <>
      {isAccessModalOpen && selectedUser && <ManageAccessModal user={selectedUser} allAccounts={allAccounts} onClose={() => setIsAccessModalOpen(false)} />}
      {isCreateModalOpen && <CreateUserModal onClose={() => setIsCreateModalOpen(false)} onUserCreated={fetchUsers} />}
      <div>
        <div className="flex justify-between items-center mb-2">
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">Create new users and manage their roles and account access.</p>
            </div>
            <button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                <UserPlus className="w-4 h-4" /> Create New User
            </button>
        </div>
        <div className="mt-8 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm dark:shadow-gray-900/20">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">User</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Created Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {users.map(user => {
                  if (!user || !user.id) return null;
                  const role = user.groups.includes('Admins') ? 'Admin' : 'Viewer';
                  return (
                    <tr key={user.id}>
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{user.email || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <div className="relative group w-24">
                           <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${role === 'Admin' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200'}`}>
                             {role}
                           </span>
                           <select 
                             value={role === 'Admin' ? 'Admins' : 'Viewers'}
                             onChange={(e) => handleRoleChange(user.username, e.target.value as 'Admins' | 'Viewers')}
                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           >
                              <option value="Viewers">Viewer</option>
                              <option value="Admins">Admin</option>
                           </select>
                           <ChevronDown className="w-3 h-3 absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"/>
                        </div>
                      </td>
                      <td className="px-6 py-4"><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.status === 'CONFIRMED' ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300'}`}>{user.status}</span></td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex gap-4 justify-end">
                            <button onClick={() => handleManageAccess(user)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 ml-auto">
                              <Edit className="w-4 h-4" /> Manage Access
                            </button>
                            <button onClick={() => handleDeleteUser(user.username)} className="text-red-600 hover:text-red-900 flex items-center gap-1 ml-auto">
                                <Trash2 className="w-4 h-4" /> Delete
                            </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default UserManagementPage;