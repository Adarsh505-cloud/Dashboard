import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { FolderOpen, DollarSign, User, Hash, AlertCircle } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProjectCost {
  project: string;
  cost: number;
  resources: number;
  owner: string;
}

interface ProjectChartProps {
  data: ProjectCost[];
}

const ProjectChart: React.FC<ProjectChartProps> = ({ data }) => {
  // Process data to rename UNMAPPED to Others
  const processedData = data.map(item => ({
    ...item,
    project: item.project === 'UNMAPPED' ? 'Others' : item.project
  }));

  // Define colors for the chart
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  // Create chart data
  const chartData = {
    labels: processedData.map(item => item.project),
    datasets: [
      {
        data: processedData.map(item => item.cost),
        backgroundColor: colors.slice(0, processedData.length),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
        hoverOffset: 8,
      },
    ],
  };

  // Chart options with enhanced tooltip
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: 'rgb(243, 244, 246)',
        bodyColor: 'rgb(243, 244, 246)',
        padding: 12,
        cornerRadius: 8,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        displayColors: false,
        callbacks: {
          label: (context: any) => {
            const projectIndex = context.dataIndex;
            const projectData = processedData[projectIndex];
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return [
              `Cost: $${context.parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${percentage}%)`,
              `Resources: ${projectData.resources}`,
              `Owner: ${projectData.owner}`,
            ];
          },
        },
      },
    },
  };

  // Calculate max cost for percentage calculations
  const maxCost = Math.max(...processedData.map(p => p.cost), 1);
  
  // Calculate total cost
  const totalCost = processedData.reduce((sum, project) => sum + project.cost, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Project Tag Based Costs</h3>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full">
            <AlertCircle className="w-4 h-4" />
            <span>UNMAPPED → Others</span>
          </div>
        </div>
        <div className="h-80">
          <Pie data={chartData} options={options} />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-50 rounded-lg">
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900">Project Details</h3>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm text-blue-700 font-medium mb-1">Total Projects</div>
            <div className="text-2xl font-bold text-blue-900">{processedData.length}</div>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <div className="text-sm text-blue-700 font-medium mb-1">Total Cost</div>
            <div className="text-2xl font-bold text-blue-900">
              ${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
        
        {/* Project List */}
        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
          {processedData.map((project, index) => (
            <div 
              key={project.project} 
              className={`p-4 rounded-lg transition-all duration-200 border ${
                project.project === 'Others' 
                  ? 'bg-amber-50 border-amber-200 hover:bg-amber-100' 
                  : 'bg-gray-50 border-gray-100 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <div>
                    <div className={`font-medium flex items-center gap-1 ${
                      project.project === 'Others' ? 'text-amber-800' : 'text-gray-900'
                    }`}>
                      {project.project}
                      {project.project === 'Others' && (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">
                        Owner: {project.owner}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${project.cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500">
                    <Hash className="w-3 h-3" />
                    <span>{project.resources} resources</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Cost Distribution</span>
                  <span>{Math.round((project.cost / maxCost) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div 
                    className="h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ 
                      backgroundColor: colors[index],
                      width: `${(project.cost / maxCost) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectChart;