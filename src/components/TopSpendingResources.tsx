// src/components/TopSpendingResources.tsx
import React from 'react';
import { Server, Database, HardDrive, Zap, MapPin, Activity, Copy } from 'lucide-react';

// ------- Interface -------
interface TopSpendingResource {
  service: string;
  resource_type: string;
  resource_id?: string | null;
  raw_resource_id?: string | null;
  total_cost: number;
}

interface TopSpendingResourcesProps {
  topSpendingResources: TopSpendingResource[];
}

// ------- Helper Function for Icons -------
const getResourceIcon = (serviceOrType: string) => {
  const s = (serviceOrType || '').toLowerCase();
  if (s.includes('ec2') || s.includes('instance') || s.includes('compute')) return <Server className="w-5 h-5" />;
  if (s.includes('rds') || s.includes('database')) return <Database className="w-5 h-5" />;
  if (s.includes('s3') || s.includes('storage')) return <HardDrive className="w-5 h-5" />;
  if (s.includes('lambda') || s.includes('function')) return <Zap className="w-5 h-5" />;
  if (s.includes('vpc')) return <MapPin className="w-5 h-5" />;
  return <Activity className="w-5 h-5" />;
};

// ------- Component -------
const TopSpendingResources: React.FC<TopSpendingResourcesProps> = ({ topSpendingResources }) => {
  // If no resources, don't render anything.
  if (!topSpendingResources || topSpendingResources.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Spending Resources (Last 30 Days)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
              </th>

              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource ID
              </th>

              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource Type
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {topSpendingResources.map((resource, index) => {
              const displayId = resource.resource_id || resource.raw_resource_id || '—';
              const rawId = resource.raw_resource_id || null;
              const serviceName = resource.service || resource.resource_type || 'unknown';
              const keyId = `${displayId || serviceName}-${index}`;

              return (
                <tr key={keyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                        {getResourceIcon(serviceName)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{serviceName}</div>
                        <div className="text-xs text-gray-400">{resource.resource_type}</div>
                      </div>
                    </div>
                  </td>

                  {/* Resource ID */}
                  <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-gray-900 truncate" title={displayId} style={{ maxWidth: '12rem' }}>
                        {displayId}
                      </div>
                      <button
                        onClick={() => displayId !== '—' && navigator.clipboard?.writeText(displayId)}
                        title={`Copy resource id: ${displayId}`}
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        <Copy className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {rawId && rawId !== displayId ? (
                      <div className="text-xs text-gray-400 truncate mt-1" title={rawId}>
                        ({rawId})
                      </div>
                    ) : null}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {resource.resource_type}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    ${Number(resource.total_cost || 0).toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopSpendingResources;
