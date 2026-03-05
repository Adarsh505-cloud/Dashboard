// src/components/MasterOverviewDashboard.tsx
import React from 'react';
import { Building2, ArrowRight, DollarSign, Server, PieChart } from 'lucide-react';
import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MasterOverviewProps {
  data: any;
  onDrillDown: (accountId: string) => void;
}

const MasterOverviewDashboard: React.FC<MasterOverviewProps> = ({ data, onDrillDown }) => {
  const linkedAccounts = data.linkedAccountsSummary || [];
  
  // Normalize top spending resources
  const rawTopResources = data.topSpendingResources || data.top_spending_resources || data.topResources || [];
  const topResources = rawTopResources.map((r: any) => ({
    service: r.service || r.serviceName || 'Unknown',
    resource_id: r.resource_id || r.raw_resource_id || r.id || 'Unknown',
    total_cost: Number(r.total_cost || r.cost || 0),
    resource_type: r.resource_type || r.type || 'Other'
  }));

  // Colors for the chart
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  const chartData = {
    labels: linkedAccounts.map((a: any) => a.accountId),
    datasets: [
      {
        data: linkedAccounts.map((a: any) => a.cost),
        backgroundColor: colors.slice(0, linkedAccounts.length),
        borderWidth: 2,
        borderColor: '#ffffff',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' as const },
      tooltip: {
        callbacks: {
          label: (context: any) => `$${context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        },
      },
    },
  };

  return (
    <div className="space-y-8">
      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-blue-100 font-medium">
              Consolidated Bill
            </div>
          </div>
          <div className="text-4xl font-bold mb-1">${data.totalMonthlyCost?.toLocaleString() || 0}</div>
          <div className="text-blue-100 text-sm">Total Organization Cost (Current Month)</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-white/20 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-emerald-100 font-medium">
              Linked Accounts
            </div>
          </div>
          <div className="text-4xl font-bold mb-1">{linkedAccounts.length}</div>
          <div className="text-emerald-100 text-sm">Active Member Accounts</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Cost Distribution Chart */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 rounded-lg">
              <PieChart className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Cost by Account</h3>
          </div>
          <div className="h-64">
            {linkedAccounts.length > 0 ? (
              <Doughnut data={chartData} options={chartOptions} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">No account data available</div>
            )}
          </div>
        </div>

        {/* Linked Accounts Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Building2 className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Member Accounts</h3>
            </div>
          </div>
          <div className="flex-1 overflow-auto p-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600">Account ID</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600 text-right">Cost</th>
                  <th className="py-3 px-6 text-sm font-semibold text-gray-600 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {linkedAccounts.map((acc: any) => (
                  <tr key={acc.accountId} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-4 px-6 font-medium text-gray-900">{acc.accountId}</td>
                    <td className="py-4 px-6 text-right font-bold text-gray-700">
                      ${acc.cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => onDrillDown(acc.accountId)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        View Details <ArrowRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {linkedAccounts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-8 text-center text-gray-500">No member accounts found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Organization Top Resources */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Server className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Top 10 Organization Resources</h3>
              <p className="text-sm text-gray-500">Highest spending resources across all member accounts</p>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 rounded-l-lg">Service</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600">Resource Type</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600">Resource ID</th>
                <th className="py-3 px-4 text-sm font-semibold text-gray-600 text-right rounded-r-lg">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {topResources.map((resource: any, idx: number) => (
                <tr key={idx} className="hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-4 text-gray-900 font-medium">
                    {resource.service.replace('Amazon ', '').replace(' Service', '')}
                  </td>
                  <td className="py-3 px-4 text-gray-600 capitalize">
                    {resource.resource_type.replace('-', ' ')}
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-xs break-all max-w-xs truncate">
                    {resource.resource_id}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-gray-900">
                    ${resource.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
              {topResources.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-gray-500">No resources found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MasterOverviewDashboard;