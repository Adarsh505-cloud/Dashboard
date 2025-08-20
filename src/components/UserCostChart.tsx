import React from 'react';
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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface UserCost {
  user: string;
  cost: number;
  resources: number;
}

interface UserCostChartProps {
  data: UserCost[];
}

const UserCostChart: React.FC<UserCostChartProps> = ({ data }) => {
  const chartData = {
    labels: data.map(item => item.user),
    datasets: [
      {
        label: 'Cost ($)',
        data: data.map(item => item.cost),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: 8,
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
            const userIndex = context.dataIndex;
            const userData = data[userIndex];
            return [
              `Cost: $${context.parsed.y.toLocaleString()}`,
              `Resources: ${userData.resources}`,
            ];
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `$${value.toLocaleString()}`,
        },
      },
    },
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
      <div className="xl:col-span-2 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">User-Based Cost Tracking</h3>
        <div className="h-80">
          <Bar data={chartData} options={options} />
        </div>
      </div>
      
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-6">User Details</h3>
        <div className="space-y-4">
          {data.map((user, index) => (
            <div key={user.user} className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{user.user}</span>
                <span className="text-lg font-bold text-blue-600">
                  ${user.cost.toLocaleString()}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                {user.resources} resources
              </div>
              <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ 
                    width: `${(user.cost / Math.max(...data.map(u => u.cost))) * 100}%` 
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

export default UserCostChart;