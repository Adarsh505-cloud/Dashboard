// src/components/ProjectChart.tsx
import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  FolderOpen,
  DollarSign,
  TrendingUp,
  Hash,
  Server,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Eye,
  EyeOff,
  Search,
  X,
  AlertCircle,
  Braces,
  Grid,
  List,
  Download,
  RefreshCw,
  Settings,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ProjectCost {
  project: string;
  cost: number;
  resources: number;
  resourcesList?: string[] | string | null;
  resources_csv?: string | null;
}

interface ProjectChartProps {
  data: ProjectCost[];
}

const parseResourcesList = (resourcesList: any, resourcesCount: number): string[] => {
  if (Array.isArray(resourcesList)) return resourcesList.map(String);

  if (resourcesList == null) {
    return resourcesCount > 0
      ? Array.from({ length: resourcesCount }, (_, i) => `Resource ${i + 1}`)
      : [];
  }

  if (typeof resourcesList === 'object') {
    try {
      const str = JSON.stringify(resourcesList);
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) {}
  }

  if (typeof resourcesList === 'string') {
    const s = resourcesList.trim();
    try {
      let norm = s;
      if (norm.startsWith('[') && norm.includes("'") && !norm.includes('"')) {
        norm = norm.replace(/'/g, '"');
      }
      const parsed = JSON.parse(norm);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (typeof parsed === 'string' && parsed.length) return [parsed];
      if (parsed && typeof parsed === 'object') {
        const vals = Object.values(parsed).map(String);
        if (vals.length) return vals;
      }
    } catch (e) {
      // fallback parsing
    }

    if (s.startsWith('[') && s.endsWith(']')) {
      const inner = s.slice(1, -1);
      const parts = inner.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length) return parts.map(p => p.replace(/^["']|["']$/g, ''));
    }

    if (s.includes(',')) {
      const parts = s.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length) return parts;
    }

    if (s.length) return [s];
  }

  if (resourcesCount > 0) {
    return Array.from({ length: resourcesCount }, (_, i) => `Resource ${i + 1}`);
  }

  return [];
};

const ProjectChart: React.FC<ProjectChartProps> = ({ data }) => {
  const processedData = data.map(item => ({
    ...item,
    project: item.project === '<UNMAPPED>' || item.project === 'UNMAPPED' ? 'Others' : item.project
  }));

  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [viewingResourcesFor, setViewingResourcesFor] = useState<string | null>(null);
  const [copiedResource, setCopiedResource] = useState<string | null>(null);
  const [resourceSearchTerm, setResourceSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'high-to-low' | 'low-to-high'>('high-to-low');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const totalCost = processedData.reduce((sum, p) => sum + (p.cost || 0), 0);
  const totalProjects = processedData.length;
  const totalResources = processedData.reduce((sum, p) => sum + (p.resources || 0), 0);
  const avgCostPerProject = totalProjects > 0 ? totalCost / totalProjects : 0;

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'];

  const sortedData = [...processedData].sort((a, b) => {
    if (sortOrder === 'high-to-low') return (b.cost || 0) - (a.cost || 0);
    return (a.cost || 0) - (b.cost || 0);
  });

  const chartData = {
    labels: sortedData.map(item => {
      const maxLength = 12;
      return item.project.length > maxLength ? `${item.project.substring(0, maxLength)}...` : item.project;
    }),
    datasets: [{
      label: 'Cost ($)',
      data: sortedData.map(item => item.cost || 0),
      backgroundColor: (context: any) => {
        const idx = context.dataIndex % colors.length;
        return colors[idx];
      },
      borderColor: 'rgb(79, 70, 229)',
      borderWidth: 1,
      borderRadius: 8,
      hoverBackgroundColor: 'rgba(79, 70, 229, 0.9)',
    }]
  };

  const options: any = { // Use 'any' to bypass strict type checking for complex chart options
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(243, 244, 246)',
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 14, weight: 'bold' }, // Correctly typed
        bodyFont: { size: 13 },
        displayColors: false,
        callbacks: {
          title: (tooltipItems: any) => sortedData[tooltipItems[0].dataIndex].project,
          label: (context: any) => {
            const p = sortedData[context.dataIndex];
            return [
              `Cost: $${(context.parsed.y || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              `Resources: ${p.resources || 0}`
            ];
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(229, 231, 235, 0.5)', drawBorder: false },
        ticks: {
          callback: (value: any) => `$${value.toLocaleString()}`,
          color: 'rgb(107, 114, 128)',
          font: { size: 12 }, padding: 10
        }
      },
      x: { grid: { display: false }, ticks: { color: 'rgb(107, 114, 128)', font: { size: 12 }, padding: 10 } }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResource(text);
    setTimeout(() => setCopiedResource(null), 2000);
  };

  const getResourceType = (resourceId: string) => {
    if (!resourceId) return 'Other';
    const id = resourceId.toLowerCase();
    if (id.includes('ec2') || id.startsWith('i-')) return 'EC2';
    if (id.includes('rds') || id.startsWith('db-')) return 'RDS';
    if (id.includes('s3') || id.includes('bucket')) return 'S3';
    if (id.includes('lambda') || id.includes('function')) return 'Lambda';
    if (id.includes('natgateway') || id.includes('nat')) return 'NAT Gateway';
    if (id.includes('route53') || id.includes('hostedzone')) return 'Route 53';
    return 'Other';
  };

  const getResourceIcon = (resourceType: string) => {
    switch (resourceType.toLowerCase()) {
      case 'ec2': return '🖥️';
      case 'rds': return '🗄️';
      case 's3': return '📦';
      case 'lambda': return '⚡';
      case 'nat gateway': return '🌐';
      case 'route 53': return '🌍';
      default: return '🔧';
    }
  };

  const getCurrentProject = () => {
    const project = sortedData.find(p => p.project === viewingResourcesFor);
    if (!project) return null;
    const resourcesList = parseResourcesList(project.resourcesList ?? project.resources_csv ?? null, project.resources ?? 0);
    return { ...project, resourcesList };
  };

  const filteredResources = (getCurrentProject()?.resourcesList || []).filter((resource: string) =>
    resource.toLowerCase().includes(resourceSearchTerm.toLowerCase())
  );

  const exportResources = () => {
    const currentProject = getCurrentProject();
    if (!currentProject || !currentProject.resourcesList) return;
    const csvRows = [];
    csvRows.push(['Resource ID', 'Resource Type'].join(','));
    currentProject.resourcesList.forEach((r: string) => {
      csvRows.push([`"${r.replace(/"/g, '""')}"`, `"${getResourceType(r)}"`].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(currentProject.project || 'project').replace(/\s+/g, '_')}_resources.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg"><FolderOpen className="w-6 h-6 text-white" /></div>
            <div>
              <h2 className="text-xl font-bold text-white">Project Cost Analysis</h2>
              <p className="text-blue-200 text-sm">Cost distribution and resource ownership</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="p-2 text-blue-200 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"><RefreshCw className="w-5 h-5" /></button>
            <button className="p-2 text-blue-200 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"><Settings className="w-5 h-5" /></button>
            <button className="p-2 text-blue-200 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"><Download className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-6 border-b border-gray-200">
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><FolderOpen className="w-5 h-5 text-blue-600" /></div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Total Projects</div>
              <div className="text-xl font-bold text-gray-900">{totalProjects}</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><DollarSign className="w-5 h-5 text-blue-600" /></div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Total Cost</div>
              <div className="text-xl font-bold text-gray-900">${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><Server className="w-5 h-5 text-blue-600" /></div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Total Resources</div>
              <div className="text-xl font-bold text-gray-900">{totalResources}</div>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-3"><div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
            <div>
              <div className="text-sm text-blue-600 font-medium">Avg Cost/Project</div>
              <div className="text-xl font-bold text-gray-900">${avgCostPerProject.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-6">
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Cost Distribution by Project</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
              <AlertCircle className="w-4 h-4" />
              <span>UNMAPPED → Others</span>
            </div>
          </div>
          <div className="h-96"><Bar data={chartData} options={options} /></div>
        </div>
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Project Details</h3>
            <div className="flex items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded-lg bg-white">
                <button onClick={() => setSortOrder('high-to-low')} className={`px-3 py-1.5 flex items-center gap-1 text-sm rounded-l-lg ${sortOrder === 'high-to-low' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span>High to Low</span><ArrowDown className="w-4 h-4" />
                </button>
                <button onClick={() => setSortOrder('low-to-high')} className={`px-3 py-1.5 flex items-center gap-1 text-sm rounded-r-lg ${sortOrder === 'low-to-high' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                  <span>Low to High</span><ArrowUp className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 border border-gray-300 rounded-lg bg-white">
                <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-l-lg ${viewMode === 'grid' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><Grid className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-r-lg ${viewMode === 'list' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}><List className="w-4 h-4" /></button>
              </div>
            </div>
          </div>
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {sortedData.map((project, index) => {
              const rankBadge = sortOrder === 'high-to-low' ? `#${index + 1}` : `#${sortedData.length - index}`;
              const totalPercentage = totalCost > 0 ? Math.round(((project.cost || 0) / totalCost) * 100) : 0;
              const safeResourcesList = parseResourcesList(project.resourcesList ?? project.resources_csv ?? null, project.resources ?? 0);
              return (
                <div key={project.project} className={`bg-white rounded-xl border transition-all duration-200 overflow-hidden shadow-sm hover:shadow-md ${viewingResourcesFor === project.project ? 'border-blue-300 ring-2 ring-blue-100' : project.project === 'Others' ? 'border-amber-200 hover:border-amber-300' : 'border-gray-200 hover:border-blue-200'}`}>
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-lg" style={{ backgroundColor: colors[index % colors.length] }}>
                            {project.project.charAt(0).toUpperCase()}
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">{rankBadge}</div>
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {project.project}
                            {project.project === 'Others' && <AlertCircle className="w-4 h-4 text-amber-500" />}
                          </div>
                          <div className="text-sm text-gray-500 flex items-center gap-1">
                            <Hash className="w-3 h-3" /><span>{project.resources} resources</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg text-blue-600">${(project.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div className="text-xs text-gray-500">{totalPercentage}% of total</div>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 border-b border-gray-100">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Cost Distribution</span><span>{totalPercentage}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-500" style={{ backgroundColor: colors[index % colors.length], width: `${totalPercentage}%` }} />
                    </div>
                  </div>
                  <div className="p-3 flex justify-between items-center bg-gray-50">
                    <button onClick={() => setViewingResourcesFor(viewingResourcesFor === project.project ? null : project.project)} className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors" disabled={project.resources === 0}>
                      {viewingResourcesFor === project.project ? (<><EyeOff className="w-4 h-4" /><span>Hide Resources</span></>) : (<><Eye className="w-4 h-4" /><span>View Resources</span></>)}
                    </button>
                    <button onClick={() => setExpandedProject(expandedProject === project.project ? null : project.project)} className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">
                      {expandedProject === project.project ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                  {expandedProject === project.project && (
                    <div className="border-t border-gray-200 p-4 bg-white">
                      <div className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2"><Server className="w-4 h-4" /><span>Resource Preview</span></div>
                      {safeResourcesList.length > 0 ? (
                        <div className="space-y-2">
                          {safeResourcesList.slice(0, 3).map((resource, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-sm flex-shrink-0">{getResourceIcon(getResourceType(resource))}</span>
                                <div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-x-auto py-1" title={resource}>{resource}</div></div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{getResourceType(resource)}</span>
                                <button onClick={() => copyToClipboard(resource)} className="text-blue-600 hover:text-blue-800 p-1 rounded" title="Copy ID"><Copy className="w-4 h-4" /></button>
                              </div>
                            </div>
                          ))}
                          {safeResourcesList.length > 3 && (<div className="text-center pt-2"><button className="text-xs text-blue-600 hover:text-blue-800">+{safeResourcesList.length - 3} more resources</button></div>)}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-gray-500">
                          <div className="flex flex-col items-center gap-2"><Braces className="w-8 h-8 text-gray-400 mx-auto" /><span className="text-sm">No resource details available</span><span className="text-xs">Expected: {project.resources} resources</span></div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {viewingResourcesFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg"><Server className="w-5 h-5 text-white" /></div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Resources for {viewingResourcesFor}</h3>
                    <p className="text-blue-200 text-sm">{getCurrentProject()?.resources} resources • ${(getCurrentProject()?.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total cost</p>
                  </div>
                </div>
                <button onClick={() => setViewingResourcesFor(null)} className="p-2 text-blue-200 hover:text-white hover:bg-blue-500/20 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="Search resources..." value={resourceSearchTerm} onChange={(e) => setResourceSearchTerm(e.target.value)} className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={exportResources} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"><Download className="w-4 h-4" /> <span>Export</span></button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resource ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredResources.length > 0 ? (
                      filteredResources.map((resource: string, index: number) => {
                        const resourceType = getResourceType(resource);
                        return (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap"><div className="flex items-center"><span className="mr-3 text-lg">{getResourceIcon(resourceType)}</span><div className="min-w-0 flex-1"><div className="text-sm font-medium text-gray-900 whitespace-nowrap overflow-x-auto py-1" title={resource}>{resource}</div></div></div></td>
                            <td className="px-6 py-4 whitespace-nowrap"><span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">{resourceType}</span></td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center gap-2">
                                <button onClick={() => copyToClipboard(resource)} className="text-blue-600 hover:text-blue-900 flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50">
                                  {copiedResource === resource ? (<><Check className="w-4 h-4 text-green-500" /><span className="text-green-500">Copied!</span></>) : (<><Copy className="w-4 h-4" /><span>Copy ID</span></>)}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan={3} className="px-6 py-12 text-center"><div className="flex flex-col items-center gap-3"><div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"><Search className="w-6 h-6 text-gray-400" /></div><div className="text-gray-500">{resourceSearchTerm ? 'No resources match your search' : getCurrentProject()?.resources === 0 ? 'This project has no resources' : 'No resources found'}</div>{resourceSearchTerm && <button onClick={() => setResourceSearchTerm('')} className="text-blue-600 hover:text-blue-800 text-sm">Clear search</button>}</div></td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-200 px-6 py-3 bg-gray-50 rounded-b-xl">
                <div className="flex justify-between items-center text-sm text-gray-500">
                  <div>Showing {filteredResources.length} of {(getCurrentProject()?.resourcesList || []).length} resources</div>
                  <div className="flex items-center gap-4">
                    <button className="text-blue-600 hover:text-blue-800">View on AWS Console</button>
                    <button className="text-blue-600 hover:text-blue-800">Generate Cost Report</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectChart;