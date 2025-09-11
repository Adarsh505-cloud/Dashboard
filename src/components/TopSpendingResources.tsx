import React from 'react';
import { Server, Database, HardDrive, Zap, BarChart3, MapPin, Copy } from 'lucide-react';

interface Resource {
  service: string;
  resource_type: string;
  resource_id?: string;       // pretty / parsed id (preferred for display)
  raw_resource_id?: string;   // authoritative id from CUR
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
  if (s.includes('vpc')) return <MapPin className="w-6 h-6 text-green-500" />;
  if (s.includes('lambda')) return <Zap className="w-6 h-6 text-yellow-500" />;
  return <BarChart3 className="w-6 h-6 text-gray-500" />;
};

const formatCurrency = (v: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

const TopSpendingResources: React.FC<TopSpendingResourcesProps> = ({ resources }) => {
  // debug help: uncomment when troubleshooting
  // console.log('TopSpendingResources props:', resources);

  if (!resources || resources.length === 0) {
    return null;
  }

  const handleCopy = async (text?: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      // lightweight UX: briefly change title via alert or consider a toast in your app
      // eslint-disable-next-line no-alert
      alert('Copied to clipboard: ' + text);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Copy failed', err);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Spending Resources (Last 30 Days)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Type</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {resources.map((resource, idx) => {
              // prefer parsed / pretty id, then raw id, then service as last resort
              const displayId = resource.resource_id || resource.raw_resource_id || resource.service || 'unknown';
              const rawId = resource.raw_resource_id || null;
              // key should be stable; fall back to index only when no id available
              const keyId = (resource.raw_resource_id || resource.resource_id) ? (resource.raw_resource_id || resource.resource_id) : `${resource.service}-${idx}`;

              const showServiceSubtitle = resource.service && resource.service !== displayId;

              return (
                <tr key={keyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">
                        {getResourceIcon(resource.service)}
                      </div>
                      <div className="ml-4 overflow-hidden">
                        <div
                          className="text-sm font-medium text-gray-900 truncate"
                          style={{ maxWidth: '20rem' }}
                          title={displayId}
                        >
                          {displayId}
                        </div>
                        {showServiceSubtitle ? (
                          <div className="text-xs text-gray-500 truncate" style={{ maxWidth: '20rem' }}>
                            {resource.service}
                          </div>
                        ) : (
                          // if service equals display id (common when id missing), still show a muted hint if raw id missing
                          rawId ? (
                            <div className="text-xs text-gray-400 truncate" title={rawId}>
                              ({rawId})
                            </div>
                          ) : null
                        )}
                      </div>

                      <div className="ml-3">
                        <button
                          onClick={() => handleCopy(displayId)}
                          title={`Copy resource id: ${displayId}`}
                          aria-label={`Copy ${displayId}`}
                          className="ml-2 p-1 rounded hover:bg-gray-100"
                        >
                          <Copy className="w-4 h-4 text-gray-500" />
                        </button>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      {resource.resource_type}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {formatCurrency(resource.total_cost)}
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
