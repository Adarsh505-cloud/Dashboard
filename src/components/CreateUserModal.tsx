// src/components/CreateUserModal.tsx
import React, { useState } from 'react';
import { apiService } from '../services/api';
import { X, Loader, Save, UserPlus } from 'lucide-react';

interface CreateUserModalProps {
  onClose: () => void;
  onUserCreated: () => void;
}

const CreateUserModal: React.FC<CreateUserModalProps> = ({ onClose, onUserCreated }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [role, setRole] = useState<'Viewers' | 'Admins'>('Viewers');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (temporaryPassword.length < 8) {
        setError("Password must be at least 8 characters long.");
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const response = await apiService.createUser({ email, username, temporaryPassword, role });
      if (response.success) {
        onUserCreated();
        onClose();
      } else {
        throw new Error(response.error || 'Failed to create user.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-bold text-gray-900">Create New User</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><X /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label htmlFor="temp-password" className="block text-sm font-medium text-gray-700 mb-1">Temporary Password</label>
              <input type="password" id="temp-password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required />
               <p className="text-xs text-gray-500 mt-1">Min 8 characters. An invitation email with this password will be sent.</p>
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'Viewers' | 'Admins')} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                <option value="Viewers">Viewer</option>
                <option value="Admins">Admin</option>
              </select>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>}
          </div>
          <div className="p-6 bg-gray-50 border-t flex justify-end">
            <button type="submit" disabled={isLoading} className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-400">
              {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isLoading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateUserModal;