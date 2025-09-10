import React from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Server,
  Database,
  HardDrive,
  CheckCircle,
  XCircle,
  TrendingUp,
  Settings,
  Trash2,
} from "lucide-react";

interface Recommendation {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  resource: string;
  description: string;
  potentialSavings: number;
  lastActivity: string;
  action: string;
}

interface RecommendationsPanelProps {
  data: Recommendation[];
}

const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({
  data,
}) => {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.toLowerCase().includes("savingsplans")) {
      return TrendingUp;
    }
    if (type.toLowerCase().includes("reservedinstances")) {
      return Database;
    }
    if (type.toLowerCase().includes("delete")) {
      return Trash2;
    }
    if (type.toLowerCase().includes("graviton")) {
      return Settings;
    }
    return AlertTriangle;
  };

  const totalPotentialSavings = data.reduce(
    (sum, item) => sum + item.potentialSavings,
    0
  );

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-4">
            <DollarSign className="w-8 h-8" />
            <div>
              <div className="text-2xl font-bold">
                ${totalPotentialSavings.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <div className="text-green-100">Potential Monthly Savings</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.filter((r) => r.severity === "high").length}
              </div>
              <div className="text-gray-600">High Priority</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.filter((r) => r.type.toLowerCase().includes("delete")).length}
              </div>
              <div className="text-gray-600">Unused Resources</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Server className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {data.length}
              </div>
              <div className="text-gray-600">Total Recommendations</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations List */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">
            Cost Optimization Recommendations
          </h3>
          <p className="text-gray-600 mt-1">
            Recommendations from your AWS Cost Optimization report.
          </p>
        </div>

        <div className="divide-y divide-gray-200">
          {data.map((recommendation) => {
            const TypeIcon = getTypeIcon(recommendation.type);

            return (
              <div
                key={recommendation.id}
                className="p-6 hover:bg-gray-50 transition-colors duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <TypeIcon className="w-5 h-5 text-gray-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-lg font-medium text-gray-900 mb-1">
                          {recommendation.resource}
                        </h4>
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(
                            recommendation.severity
                          )}`}
                        >
                          {recommendation.severity.toUpperCase()} PRIORITY
                        </span>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-green-600">
                          $
                          {recommendation.potentialSavings.toLocaleString(
                            undefined,
                            {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          monthly savings
                        </div>
                      </div>
                    </div>

                    <p className="text-gray-600 mb-3">
                      {recommendation.description}
                    </p>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>
                          Last refreshed: {recommendation.lastActivity}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200">
                          <XCircle className="w-4 h-4" />
                          Dismiss
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors duration-200">
                          <CheckCircle className="w-4 h-4" />
                          {recommendation.action}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default RecommendationsPanel;