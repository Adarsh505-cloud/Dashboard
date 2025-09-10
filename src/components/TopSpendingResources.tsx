// TopSpendingResources.tsx (fixed)
import React from 'react';
import { Server, Database, HardDrive, Zap, BarChart3, MapPin } from 'lucide-react';

interface Resource {
  service: string;
  resource_type: string;
  resource_id: string;
  total_cost: number;
}

interface TopSpendingResourcesProps {
  resources: Resource[];
}

const getResourceIcon = (service: string) => {
  const s = (service || '').toLowerCase();
  if (s.includes('ec2')) return <Server className="w-6 h-6 text-orange-500" />;
  if (s.includes('rds')) return <Database className="w-6 h-6 text-blue-500" />;
  if (s.includes('s3')) return <HardDrive className="w-6 h-6 text-red-500" />;
  if (s.includes('vpc')) return <MapPin className="w-6 h-6 text-green-500" />; // <-- replaced Vpc with MapPin
  if (s.includes('lambda')) return <Zap className="w-6 h-6 text-yellow-500" />;
  return <BarChart3 className="w-6 h-6 text-gray-500" />;
};

const TopSpendingResources: React.FC<TopSpendingResourcesProps> = ({ resources }) => {
  if (!resources || resources.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Spending Resources (Last 30 Days)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resource
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
            {resources.map((resource, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                      {getResourceIcon(resource.service)}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900 truncate" style={{ maxWidth: '20rem' }}>
                        {resource.resource_id}
                      </div>
                      <div className="text-xs text-gray-500">{resource.service}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                    {resource.resource_type}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                  ${resource.total_cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TopSpendingResources;
