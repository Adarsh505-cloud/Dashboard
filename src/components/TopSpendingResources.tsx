// src/components/TopSpendingResources.tsx
import React, { useState, useEffect } from 'react';
import { Server, Database, HardDrive, Zap, MapPin, Activity, Copy } from 'lucide-react';

// This interface must match the one in ResourceChart.tsx
interface TopSpendingResource {
  service: string;
  region: string;
  resource_type: string;
  resource_id?: string | null;
  raw_resource_id?: string | null;
  total_cost: number;
}

interface TopSpendingResourcesProps {
  topSpendingResources: TopSpendingResource[];
}

const getResourceIcon = (serviceOrType: string) => {
  const s = (serviceOrType || '').toLowerCase();
  if (s.includes('ec2') || s.includes('instance') || s.includes('compute')) return <Server className="w-5 h-5" />;
  if (s.includes('rds') || s.includes('database')) return <Database className="w-5 h-5" />;
  if (s.includes('s3') || s.includes('storage')) return <HardDrive className="w-5 h-5" />;
  if (s.includes('lambda') || s.includes('function')) return <Zap className="w-5 h-5" />;
  if (s.includes('vpc')) return <MapPin className="w-5 h-5" />;
  if (s.includes('workspace')) return <HardDrive className="w-5 h-5" />;
  return <Activity className="w-5 h-5" />;
};


const getDisplayRegion = (res: TopSpendingResource) => {
  // DEBUG LOGGING
  const regionCandidate = (res.region || '').trim();
  console.log(`🔍 getDisplayRegion called for resource:`, { 
    service: res.service,
    regionCandidate: regionCandidate,
    raw_resource_id: res.raw_resource_id,
    resource_id: res.resource_id,
  });

  const raw = (res.raw_resource_id || res.resource_id || '').trim();
  const knownInvalidRegions = ['Bank'];

  if (regionCandidate && regionCandidate !== 'global' && !knownInvalidRegions.includes(regionCandidate)) {
    console.log(`✅ Using valid region candidate: "${regionCandidate}"`);
    return regionCandidate;
  }
  
  console.log(`❌ Region candidate invalid: "${regionCandidate}", trying fallback...`);
  
  const REGION_SIMPLE_RE = /\b[a-z]{2}(?:-[a-z]+)+-\d\b/i;
  if (raw) {
    const arnMatch = raw.match(/arn:aws:[^:]+:([a-z0-9-]+):/i);
    if (arnMatch && arnMatch[1]) {
      console.log(`📍 Found region from ARN: ${arnMatch[1]}`);
      return arnMatch[1];
    }
    const inlineMatch = raw.match(REGION_SIMPLE_RE);
    if (inlineMatch) {
      console.log(`📍 Found inline region: ${inlineMatch[0]}`);
      return inlineMatch[0];
    }
  }

  console.log(`🌐 Final fallback to global`);
  return 'global';
};


const TopSpendingResources: React.FC<TopSpendingResourcesProps> = ({ topSpendingResources }) => {
  const [visibleCount, setVisibleCount] = useState(5);

  // DEBUG LOG: Log the incoming props for this component
  useEffect(() => {
    console.log('📦 TopSpendingResources component received:', topSpendingResources);
  }, [topSpendingResources]);

  if (!topSpendingResources || topSpendingResources.length === 0) {
    return null;
  }

  const visibleResources = topSpendingResources.slice(0, visibleCount);
  const hasMore = topSpendingResources.length > visibleCount;

  const handleToggle = () => {
    setVisibleCount(prev => (prev >= topSpendingResources.length ? 5 : prev + 5));
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Top Spending Resources (Last 30 Days)</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-auto">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Region</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource Type</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleResources.map((resource, index) => {
              const displayId = resource.resource_id || '—';
              const rawId = resource.raw_resource_id || null;
              const serviceName = resource.service || 'unknown';
              const isCopyDisabled = displayId === 'No resource id available' || displayId === '—';
              const keyId = `${rawId || serviceName}-${index}`;
              const displayRegion = getDisplayRegion(resource);
              
              // DEBUG LOG: Log the final values for each rendered row
              if (index === 0) { // Log only for the first few to avoid spam
                  console.log(`📊 Rendering row ${index}:`, {
                      service: serviceName,
                      originalRegion: resource.region,
                      displayRegion: displayRegion,
                      resource_id: displayId
                  });
              }

              return (
                <tr key={keyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center bg-gray-100 rounded-lg">{getResourceIcon(serviceName)}</div>
                      <div className="ml-4"><div className="text-sm font-medium text-gray-900">{serviceName}</div></div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap max-w-xs">
                    <div className="flex items-center gap-2">
                      <div className={`text-sm truncate ${isCopyDisabled ? 'text-gray-400' : 'text-gray-900'}`} title={rawId || displayId} style={{ maxWidth: '12rem' }}>{displayId}</div>
                      <button onClick={() => !isCopyDisabled && navigator.clipboard?.writeText(rawId || displayId)} title={isCopyDisabled ? 'No ID to copy' : `Copy full ID: ${rawId || displayId}`} className="p-1 rounded hover:bg-gray-100 disabled:opacity-50" disabled={isCopyDisabled}><Copy className="w-4 h-4 text-gray-500" /></button>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" title={resource.region || ''}>{displayRegion}</td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">{resource.resource_type}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">${Number(resource.total_cost || 0).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {topSpendingResources.length > 5 && (<div className="mt-4 text-center"><button onClick={handleToggle} className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">{hasMore ? 'Show More' : 'Show Less'}</button></div>)}
    </div>
  );
};

export default TopSpendingResources;