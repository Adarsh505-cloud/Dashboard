// src/components/MasterOverviewDashboard.tsx
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  DollarSign,
  Building2,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  PieChart as PieChartIcon,
  Server,
  ArrowRight
} from "lucide-react";

interface MasterOverviewProps {
  data: any;
  onDrillDown: (accountId: string) => void;
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#F97316", "#06B6D4", "#84CC16", "#EC4899", "#6366F1"
];

const svc_icons: Record<string, string> = {
  AmazonS3: "🪣", ComputeSavingsPlans: "💳", AmazonMQ: "📨",
  AmazonEC2: "⚡", AmazonQuickSight: "📊", AmazonFSx: "💾",
  AmazonRDS: "🐘", AWSLambda: "λ"
};

// Map known account IDs to names and trends from your screenshot
const KNOWN_ACCOUNTS: Record<string, { name: string; trend: number }> = {
  "540331646362": { name: "ERP-Production", trend: 12.3 },
  "471112980309": { name: "DataPlatform-Prod", trend: -4.1 },
  "746669225992": { name: "DevOps-Shared", trend: 8.7 },
  "252078852689": { name: "Master-Payer", trend: 1.2 },
  "209561933004": { name: "Analytics-Sandbox", trend: -2.3 },
  "438495148892": { name: "Security-Audit", trend: 5.5 },
  "183631321229": { name: "ML-Training", trend: 0.8 },
  "767397989835": { name: "Staging-Env", trend: -1.1 },
  "533266977246": { name: "DR-Backup", trend: 0.4 },
  "471112905155": { name: "QA-Testing", trend: -0.2 },
  "762233734329": { name: "Dev-Playground", trend: 0.1 },
};

/* ─────────────────────── TOOLTIP ─────────────────────────── */
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-xl max-w-[220px] max-h-[280px] overflow-y-auto">
      <div className="text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">{label}</div>
      {sorted.map((p: any, i: number) => (
        <div key={i} className="flex justify-between items-center gap-3 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-xs text-gray-600 truncate max-w-[110px]">
              {p.name === "consolidated" ? "Consolidated Total" : p.name}
            </span>
          </div>
          <span className="text-xs font-bold text-gray-900">${Number(p.value || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────── MAIN ─────────────────────────────── */
export default function MasterOverviewDashboard({ data, onDrillDown }: MasterOverviewProps) {
  const [activeAccounts, setActiveAccounts] = useState<Record<string, boolean>>({ consolidated: true });

  // 1. Process Accounts
  const linkedAccounts = Array.isArray(data?.linkedAccountsSummary) ? data.linkedAccountsSummary : [];
  const totalCost = Number(data?.totalMonthlyCost || 0);

  const ACCOUNTS = linkedAccounts.map((a: any) => {
    const accIdStr = String(a.accountId);
    const known = KNOWN_ACCOUNTS[accIdStr];
    
    // Resolve name: Prefer explicit name from API, fallback to known map, fallback to formatted ID
    let resolvedName = `Account ${accIdStr.slice(-4)}`;
    if (a.accountName && a.accountName !== accIdStr) resolvedName = String(a.accountName);
    else if (known) resolvedName = known.name;

    return {
      id: accIdStr,
      name: resolvedName, 
      cost: Number(a.cost || 0),
      pct: totalCost > 0 ? (Number(a.cost || 0) / totalCost) * 100 : 0,
      trend: known?.trend || 0, // Fallback trend to 0 if unknown
    };
  }).sort((a: any, b: any) => b.cost - a.cost);

  const topAcc = ACCOUNTS[0] || { id: "N/A", cost: 0, pct: 0, name: "N/A" };

  // 2. Process Recommendations
  const recommendations = Array.isArray(data?.recommendations) ? data.recommendations : [];
  const totalSavings = recommendations.reduce((sum: number, r: any) => sum + Number(r.potentialSavings || r.estimatedMonthlySavings || 0), 0);

  // 3. Process Daily Trend
  const rawTrend = Array.isArray(data?.costTrendData) ? data.costTrendData : [];
  const DAILY_DATA = rawTrend.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    consolidated: Number(t.cost || 0)
  }));

  // 4. Process Top Resources
  const rawTopResources = data?.topSpendingResources || data?.top_spending_resources || data?.topResources || [];
  const RESOURCES = Array.isArray(rawTopResources) ? rawTopResources.map((r: any) => {
    const accIdStr = String(r.account_id || r.accountId || r.line_item_usage_account_id || 'Unknown');
    const known = KNOWN_ACCOUNTS[accIdStr];

    let resolvedName = 'Member Account';
    if (r.account_name && r.account_name !== accIdStr) resolvedName = String(r.account_name);
    else if (known) resolvedName = known.name;

    return {
      service: r.service || r.serviceName || 'Unknown',
      type: r.resource_type || r.type || 'Other',
      id: r.resource_id || r.raw_resource_id || r.id || 'Unknown',
      cost: Number(r.total_cost || r.cost || 0),
      account: accIdStr,
      accountName: resolvedName
    };
  }) : [];
  
  const maxResourceCost = RESOURCES.length > 0 ? RESOURCES[0].cost : 1;

  const toggleAccount = (id: string) => {
    if (id === "consolidated") {
      setActiveAccounts(prev => ({ ...prev, consolidated: !prev.consolidated }));
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* ── KPI Hero Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        {/* Total Cost */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <DollarSign className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:flex items-center gap-1 text-blue-100 bg-white/20 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
              CONSOLIDATED
            </div>
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1">${totalCost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="text-blue-100 text-xs sm:text-sm">Total Org Cost</div>
          <div className="text-blue-200 text-[10px] sm:text-xs mt-1 hidden sm:block">Current billing period</div>
        </div>

        {/* Linked Accounts */}
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <Building2 className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="hidden sm:flex items-center gap-1 text-emerald-100 bg-white/20 px-2 py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
              ACTIVE
            </div>
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1">{ACCOUNTS.length}</div>
          <div className="text-emerald-100 text-xs sm:text-sm">Linked Accounts</div>
          <div className="text-emerald-200 text-[10px] sm:text-xs mt-1 hidden sm:block">Active member accounts</div>
        </div>

        {/* Top Account Spend */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-orange-100 bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
              {topAcc.pct.toFixed(1)}%
            </div>
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1">${topAcc.cost.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
          <div className="text-orange-100 text-xs sm:text-sm truncate">Top Spend</div>
          <div className="text-orange-200 text-[10px] sm:text-xs mt-1 truncate">{topAcc.name}</div>
        </div>

        {/* Potential Savings */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl sm:rounded-2xl p-3 sm:p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transition-all duration-300">
          <div className="flex items-center justify-between mb-2 sm:mb-4">
            <div className="p-2 sm:p-3 bg-white/20 rounded-lg sm:rounded-xl">
              <AlertTriangle className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div className="flex items-center gap-1 text-purple-100 bg-white/20 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
              {recommendations.length} ALERTS
            </div>
          </div>
          <div className="text-lg sm:text-2xl lg:text-3xl font-bold mb-1">${totalSavings.toLocaleString("en-US", { maximumFractionDigits: 0 })}</div>
          <div className="text-purple-100 text-xs sm:text-sm">Potential Savings</div>
          <div className="text-purple-200 text-[10px] sm:text-xs mt-1 hidden sm:block">Optimization alerts across org</div>
        </div>
      </div>

      {/* ── Cost Trend Chart ── */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg shrink-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Daily Cost Trend</h3>
              <p className="text-xs sm:text-sm text-gray-500">Last 30 days · Consolidated Total</p>
            </div>
          </div>
          <button 
            onClick={() => toggleAccount("consolidated")} 
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
              activeAccounts.consolidated 
                ? "bg-slate-800 text-white border-slate-800" 
                : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
            }`}
          >
            <div className={`w-2.5 h-2.5 rounded-sm shrink-0 ${activeAccounts.consolidated ? "bg-white" : "bg-slate-400"}`} />
            Consolidated Total
          </button>
        </div>

        <div className="h-48 sm:h-60 lg:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={DAILY_DATA} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              {activeAccounts.consolidated && (
                <Line
                  key="consolidated" type="monotone" dataKey="consolidated"
                  stroke="#1e293b" strokeWidth={3} dot={false}
                  strokeDasharray="6 3"
                  activeDot={{ r: 5, fill: "#1e293b", stroke: "#fff", strokeWidth: 2 }}
                  name="consolidated"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom Grid: Donut + Accounts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">

        {/* Donut */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 flex flex-col md:col-span-1">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
              <PieChartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Cost by Account</h3>
              <p className="text-xs sm:text-sm text-gray-500">Proportional distribution</p>
            </div>
          </div>
          
          <div className="relative h-56 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={ACCOUNTS} cx="50%" cy="50%" innerRadius={65} outerRadius={95}
                  paddingAngle={2} dataKey="cost" nameKey="id" stroke="none"
                >
                  {ACCOUNTS.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip
                  formatter={(value: any, name: any) => {
                    // FIXED: explicitly typed 'a: any' here to resolve TS7006
                    const acc = ACCOUNTS.find((a: any) => a.id === name);
                    return [`$${Number(value || 0).toFixed(2)}`, acc?.name || name];
                  }}
                  contentStyle={{ background: "#fff", border: "1px solid #f1f5f9", borderRadius: "12px", fontSize: "12px", color: "#1e293b", fontWeight: 600, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                  itemStyle={{ color: "#475569" }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-bold text-gray-900">
                ${totalCost >= 1000 ? (totalCost / 1000).toFixed(1) + 'k' : totalCost.toFixed(0)}
              </div>
              <div className="text-xs font-semibold text-gray-400 tracking-wider mt-0.5">TOTAL</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-48 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {ACCOUNTS.map((a: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                <div className="flex-1 min-w-0">
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${a.pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                </div>
                <span className="text-xs font-medium text-gray-600 w-14 text-right">${a.cost.toFixed(0)}</span>
                <span className="text-xs text-gray-400 w-10 text-right">{a.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Member Accounts Table (With Trend Column Restored) */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 flex flex-col md:col-span-1 lg:col-span-2">
          <div className="p-4 sm:p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Member Accounts</h3>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">All linked accounts for this billing period</p>
              </div>
            </div>
            <span className="bg-indigo-50 text-indigo-700 py-1 px-2 sm:px-3 rounded-full text-[10px] sm:text-xs font-bold tracking-wide">
              {ACCOUNTS.length} ACTIVE
            </span>
          </div>

          <div className="flex-1 overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Cost</th>
                  <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Share</th>
                  <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Trend</th>
                  <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ACCOUNTS.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors group">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${COLORS[i % COLORS.length]}15` }}>
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{a.name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className="text-sm font-bold text-gray-900 font-mono">${a.cost.toFixed(2)}</span>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden flex justify-end">
                          <div className="h-full rounded-full" style={{ width: `${a.pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                        <span className="text-xs text-gray-500">{a.pct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <span className={`text-xs font-bold font-mono ${a.trend > 0 ? 'text-orange-500' : a.trend < 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
                        {a.trend > 0 ? '↑' : a.trend < 0 ? '↓' : ''}{Math.abs(a.trend).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-6 text-center">
                      <button
                        onClick={() => onDrillDown(a.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <span className="hidden sm:inline">Details</span> <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Top Resources ── */}
      <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-100 flex flex-col">
        <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg shrink-0">
              <Server className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">Top Resources</h3>
              <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Highest spending resources across all accounts</p>
            </div>
          </div>
          <div className="bg-gray-50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-gray-100">
            <span className="text-[10px] sm:text-xs text-gray-500 font-semibold mr-1 sm:mr-2">TOP 10:</span>
            <span className="text-sm font-bold text-gray-900 font-mono">
              ${RESOURCES.reduce((s: number, r: any) => s + r.cost, 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">#</th>
                <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Service</th>
                <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Account</th>
                <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider">Resource ID</th>
                <th className="py-3 px-3 sm:px-6 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Total Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {RESOURCES.map((r: any, i: number) => {
                const color = COLORS[i % COLORS.length];
                return (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <span className="text-xs font-bold text-gray-400 font-mono">#{i + 1}</span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{svc_icons[r.service] || "☁️"}</span>
                        <span className="text-sm font-semibold text-gray-700">{r.service}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded-md w-fit" style={{ color: color, background: `${color}15` }}>
                          {r.accountName}
                        </span>
                        <span className="text-xs text-gray-400 font-mono ml-1">{r.account}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs text-gray-500 font-mono block max-w-[250px] lg:max-w-[400px] truncate" title={r.id}>
                        {r.id}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden flex justify-end">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${(r.cost / maxResourceCost) * 100}%`,
                              background: `linear-gradient(90deg, ${color}55, ${color})` 
                            }} 
                          />
                        </div>
                        <span className={`text-sm font-bold font-mono ${i === 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                          ${r.cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {RESOURCES.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-gray-500">
                    No top resources found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}