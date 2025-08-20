import React from 'react';
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';

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
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1'
  ];

  const chartData = {
    labels: data.map(item => item.project),
    datasets: [
      {
        data: data.map(item => item.cost),
        backgroundColor: colors.slice(0, data.length),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const projectIndex = context.dataIndex;
            const projectData = data[projectIndex];
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((context.parsed / total) * 100).toFixed(1);
            return [
              `${context.label}: $${context.parsed.toLocaleString()} (${percentage}%)`,
              `Resources: ${projectData.resources}`,
              `Owner: ${projectData.owner}`,
            ];
          },
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Project Tag Based Costs</h3>
        <div className="h-80">
          <Pie data={chartData} options={options} />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">Project Details</h3>
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {data.map((project, index) => (
            <div key={project.project} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: colors[index] }}
                  />
                  <div>
                    <div className="font-medium text-gray-900">{project.project}</div>
                    <div className="text-sm text-gray-500">Owner: {project.owner}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${project.cost.toLocaleString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {project.resources} resources
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="h-2 rounded-full transition-all duration-300"
                  style={{ 
                    backgroundColor: colors[index],
                    width: `${(project.cost / Math.max(...data.map(p => p.cost))) * 100}%` 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectChart;