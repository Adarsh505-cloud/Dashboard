import React, { useState } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import {
  ChevronRight,
  ChevronDown,
  Server,
  MapPin,
  TrendingUp,
  Eye,
  Filter,
  Search,
  Award,
  BarChart3
} from 'lucide-react';
import ServiceResourceDetails from './ServiceResourceDetails';

ChartJS.register(ArcElement, Tooltip, Legend);

interface ServiceCost {
  service: string;
  cost: number;
  region: string;
}

interface CostChartProps {
  data: ServiceCost[];
  credentials: {
    accountId: string;
    roleArn: string;
  };
}

interface GroupedService {
  service: string;
  totalCost: number;
  regions: Array<{
    region: string;
    cost: number;
    percentage: number;
  }>;
  isExpanded: boolean;
}

const CostChart: React.FC<CostChartProps> = ({ data, credentials }) => {
  const [groupedServices, setGroupedServices] = useState<GroupedService[]>([]);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'cost' | 'name'>('cost');

  React.useEffect(() => {
    // Group services by name and calculate totals
    const serviceMap = new Map<string, GroupedService>();
    
    data.forEach(item => {
      if (!serviceMap.has(item.service)) {
        serviceMap.set(item.service, {
          service: item.service,
          totalCost: 0,
          regions: [],
          isExpanded: false
        });
      }
      
      const service = serviceMap.get(item.service)!;
      service.totalCost += item.cost;
      service.regions.push({
        region: item.region,
        cost: item.cost,
        percentage: 0 // Will calculate after grouping
      });
    });

    // Calculate percentages and sort
    const grouped = Array.from(serviceMap.values()).map(service => ({
      ...service,
      regions: service.regions
        .map(region => ({
          ...region,
          percentage: (region.cost / service.totalCost) * 100
        }))
        .sort((a, b) => b.cost - a.cost)
    }));

    // Sort services
    grouped.sort((a, b) => {
      if (sortBy === 'cost') {
        return b.totalCost - a.totalCost;
      }
      return a.service.localeCompare(b.service);
    });

    setGroupedServices(grouped);
  }, [data, sortBy]);

  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#F97316', '#06B6D4', '#84CC16', '#EC4899', '#6366F1',
    '#14B8A6', '#F472B6', '#A855F7', '#22C55E', '#EAB308'
  ];

  const totalCost = data.reduce((sum, item) => sum + item.cost, 0);
  const topServices = groupedServices.slice(0, 10);

  // Filter services based on search
  const filteredServices = groupedServices.filter(service =>
    service.service.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const chartData = {
    labels: topServices.map(item => item.service.replace('Amazon ', '').replace(' Service', '')),
    datasets: [
      {
        data: topServices.map(item => item.totalCost),
        backgroundColor: colors.slice(0, topServices.length),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverBorderWidth: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed || 0;
            const percentage = ((value / totalCost) * 100).toFixed(1);
            return `$${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  const toggleServiceExpansion = (serviceName: string) => {
    setGroupedServices(prev =>
      prev.map(service =>
        service.service === serviceName
          ? { ...service, isExpanded: !service.isExpanded }
          : service
      )
    );
  };

  const handleServiceClick = (serviceName: string) => {
    setSelectedService(selectedService === serviceName ? null : serviceName);
  };

  if (selectedService) {
    // Find the cost data for the service that was clicked
    const serviceData = groupedServices.find(s => s.service === selectedService);
    const costForService = serviceData ? serviceData.totalCost : 0;
  
    return (
      <ServiceResourceDetails
        serviceName={selectedService}
        serviceCost={costForService} // Pass the cost to the details component
        credentials={credentials}
        onBack={() => setSelectedService(null)}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <Server className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold">Service Cost Analysis</h2>
            <p className="text-blue-100">Detailed breakdown of AWS service costs across regions</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{filteredServices.length}</div>
            <div className="text-blue-100">Active Services</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">${totalCost.toLocaleString()}</div>
            <div className="text-blue-100">Total Cost</div>
          </div>
          <div className="bg-white/10 rounded-xl p-4">
            <div className="text-2xl font-bold">{new Set(data.map(d => d.region)).size}</div>
            <div className="text-blue-100">Regions</div>
          </div>
        </div>
      </div>

      {/* Top 10 Services Chart */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Award className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Top 10 Cost-Generating Services</h3>
              <p className="text-gray-500">Highest spending services in your AWS account</p>
            </div>
          </div>
          <div className="p-2 bg-blue-100 rounded-lg">
            <BarChart3 className="w-5 h-5 text-blue-600" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <div className="h-80">
            <Doughnut data={chartData} options={chartOptions} />
          </div>
          
          <div className="space-y-3">
            {topServices.map((service, index) => {
              const percentage = (service.totalCost / totalCost) * 100;
              return (
                <div key={service.service} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-500 w-6">#{index + 1}</span>
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: colors[index] }}
                      />
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {service.service.replace('Amazon ', '').replace(' Service', '')}
                      </div>
                      <div className="text-sm text-gray-500">
                        {service.regions.length} region{service.regions.length > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">
                      ${service.totalCost.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">All Services Breakdown</h3>
            <p className="text-gray-500">Detailed view with regional distribution</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full sm:w-64"
              />
            </div>
            
            <div className="relative">
              <Filter className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'cost' | 'name')}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
              >
                <option value="cost">Sort by Cost</option>
                <option value="name">Sort by Name</option>
              </select>
            </div>
          </div>
        </div>

        {/* Services List */}
        <div className="space-y-4">
          {filteredServices.map((service, index) => {
            const percentage = (service.totalCost / totalCost) * 100;
            
            return (
              <div key={service.service} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-all duration-200">
                {/* Service Header */}
                <div className="p-6 bg-gray-50 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => toggleServiceExpansion(service.service)}
                        className="p-2 hover:bg-white rounded-lg transition-colors"
                      >
                        {service.isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-600" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-600" />
                        )}
                      </button>
                      
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: colors[index % colors.length] }}
                        />
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900">
                            {service.service}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {service.regions.length} region{service.regions.length > 1 ? 's' : ''} • 
                            {percentage.toFixed(1)}% of total cost
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          ${service.totalCost.toLocaleString()}
                        </div>
                        <div className="flex items-center gap-1 text-green-600">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm">+5.2%</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleServiceClick(service.service)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        View Resources
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Regional Breakdown */}
                {service.isExpanded && (
                  <div className="p-6 bg-white border-t border-gray-200">
                    <h5 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-gray-600" />
                      Regional Distribution
                    </h5>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {service.regions.map((region, regionIndex) => (
                        <div key={region.region} className="p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-gray-500" />
                              <span className="font-medium text-gray-900">{region.region}</span>
                            </div>
                            <span className="text-sm text-gray-500">
                              {region.percentage.toFixed(1)}%
                            </span>
                          </div>
                          
                          <div className="text-xl font-bold text-gray-900 mb-2">
                            ${region.cost.toLocaleString()}
                          </div>
                          
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div 
                              className="h-2 rounded-full transition-all duration-300"
                              style={{ 
                                backgroundColor: colors[index % colors.length],
                                width: `${region.percentage}%` 
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <Server className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No services found</h3>
            <p className="text-gray-500">Try adjusting your search criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostChart;