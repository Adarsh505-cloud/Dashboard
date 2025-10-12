// src/components/ConnectAccountModal.tsx
import React, { useState } from 'react';
import { X, Download, Shield, Info, Copy, Check } from 'lucide-react';

interface ConnectAccountModalProps {
  onClose: () => void;
  onConnect: (accountId: string, roleArn: string) => void;
}

const ConnectAccountModal: React.FC<ConnectAccountModalProps> = ({ onClose, onConnect }) => {
  const [newAccountId, setNewAccountId] = useState('');
  const [newRoleArn, setNewRoleArn] = useState('');
  const [copied, setCopied] = useState(false);

  const webAppAccountId = "183631321229"; // Your backend's AWS Account ID

  const handleCopy = () => {
    navigator.clipboard.writeText(webAppAccountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(newAccountId, newRoleArn);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">Connect a New AWS Account</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Instructions */}
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 font-bold rounded-full">1</div>
              <div>
                <h3 className="font-semibold text-lg text-gray-800">Download the Template</h3>
                <p className="text-gray-600">Download our CloudFormation template. This template creates a secure, read-only IAM role that allows our dashboard to analyze your cost data.</p>
                <a
                  href="/cost-analysis-role.yaml"
                  download
                  className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </a>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 font-bold rounded-full">2</div>
              <div>
                <h3 className="font-semibold text-lg text-gray-800">Deploy in Your AWS Account</h3>
                <p className="text-gray-600">
                  Go to the <a href="https://console.aws.amazon.com/cloudformation/home#/stacks/create/template" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">AWS CloudFormation console</a>, upload the template, and create the stack. You will be asked for one parameter:
                </p>
                <div className="mt-3 bg-gray-50 p-4 rounded-lg border">
                  <p className="text-sm font-medium text-gray-700">WebAppAwsAccountId</p>
                  <p className="text-xs text-gray-500 mb-2">This is our application's AWS account ID, which needs permission to assume the role.</p>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-md border">
                    <code className="text-sm text-gray-800">{webAppAccountId}</code>
                    <button onClick={handleCopy} className="ml-auto p-1.5 rounded text-gray-500 hover:bg-gray-100">
                      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-blue-100 text-blue-600 font-bold rounded-full">3</div>
              <div>
                <h3 className="font-semibold text-lg text-gray-800">Enter Role ARN</h3>
                <p className="text-gray-600">Once the stack is created, go to the "Outputs" tab, copy the `RoleArn`, and paste it below along with your account ID.</p>
              </div>
            </div>
          </div>

          {/* Permissions Info */}
          <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-blue-800">Read-Only Permissions</p>
                <p className="text-sm text-blue-700">The IAM role only grants read-only permissions for cost analysis services like Cost Explorer, CloudWatch, and Resource Groups. It cannot make any changes to your resources.</p>
              </div>
            </div>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit} className="space-y-4 pt-4 border-t">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your AWS Account ID</label>
              <input
                type="text"
                placeholder="123456789012"
                value={newAccountId}
                onChange={(e) => setNewAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pasted Role ARN</label>
              <input
                type="text"
                placeholder="arn:aws:iam::123456789012:role/AWS-Cost-Analysis-Dashboard-Role"
                value={newRoleArn}
                onChange={(e) => setNewRoleArn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </form>
        </div>

        <div className="p-6 bg-gray-50 border-t flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            Connect Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectAccountModal;