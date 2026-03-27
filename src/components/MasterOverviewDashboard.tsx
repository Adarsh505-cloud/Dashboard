// src/components/MasterOverviewDashboard.tsx
import React, { useState } from "react";
import { useTheme } from '../context/ThemeContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import {
  DollarSign, Building2, BarChart3, PieChart as PieChartIcon,
  Server, ArrowRight, ShieldCheck, ShoppingCart, Globe, Crown, Layers, ChevronDown, ChevronRight, ExternalLink, Boxes
} from "lucide-react";

interface MasterOverviewProps {
  data: any;
  onDrillDown: (accountId: string) => void;
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#F97316", "#06B6D4", "#84CC16", "#EC4899", "#6366F1"
];




const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].sort((a: any, b: any) => b.value - a.value);
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-xl max-w-[220px] max-h-[280px] overflow-y-auto">
      <div className="text-xs font-bold text-gray-400 dark:text-gray-500 mb-2 uppercase tracking-wider">{label}</div>
      {sorted.map((p: any, i: number) => (
        <div key={i} className="flex justify-between items-center gap-3 mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: p.color }} />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[110px]">
              {p.name === "consolidated" ? "Consolidated Total" : p.name}
            </span>
          </div>
          <span className="text-xs font-bold text-gray-900 dark:text-gray-100">${Number(p.value || 0).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
};

export default function MasterOverviewDashboard({ data, onDrillDown }: MasterOverviewProps) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [_activeAccounts, _setActiveAccounts] = useState<Record<string, boolean>>({ consolidated: true });
  const [trendView, setTrendView] = useState<'total' | 'service' | 'account'>('total');
  const [expandedOus, setExpandedOus] = useState<Record<string, boolean>>({});

  const metrics = data?.dashboardMetrics || {
    totalSpend: data?.totalMonthlyCost || 0,
    activeAccounts: data?.linkedAccountsSummary?.length || 0,
    supportCost: 0,
    marketplaceCost: 0,
    topService: { label: 'N/A', cost: 0 },
    topRegion: { label: 'N/A', cost: 0 },
    topAccount: { label: 'N/A', cost: 0 }
  };

  const linkedAccounts = Array.isArray(data?.linkedAccountsSummary) ? data.linkedAccountsSummary : [];
  const totalCost = Number(data?.totalMonthlyCost || 0);

  const ACCOUNTS = linkedAccounts.map((a: any) => {
    const accIdStr = String(a.accountId);
    const resolvedName = (a.accountName && a.accountName !== accIdStr) ? String(a.accountName) : `Account ${accIdStr.slice(-4)}`;

    return {
      id: accIdStr, name: resolvedName, cost: Number(a.cost || 0),
      pct: totalCost > 0 ? (Number(a.cost || 0) / totalCost) * 100 : 0,
      trend: 0,
    };
  }).sort((a: any, b: any) => b.cost - a.cost);

  const rawTrend = Array.isArray(data?.costTrendData) ? data.costTrendData : [];
  const DAILY_DATA = rawTrend.map((t: any) => ({
    date: new Date(t.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    consolidated: Number(t.cost || 0)
  }));

  // By-service daily data (from dailyCostData)
  const rawDailyByService = Array.isArray(data?.dailyCostData) ? data.dailyCostData : [];
  const allServices = new Set<string>();
  const SERVICE_DAILY: any[] = [];
  rawDailyByService.forEach((d: any) => {
    const entry: any = { date: new Date(d.TimePeriod?.Start).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    (d.Groups || []).forEach((g: any) => {
      const svc = g.Keys?.[0] || 'Unknown';
      const cost = parseFloat(g.Metrics?.BlendedCost?.Amount || '0');
      if (cost > 0.01) { entry[svc] = (entry[svc] || 0) + cost; allServices.add(svc); }
    });
    SERVICE_DAILY.push(entry);
  });
  const topServices = [...allServices].slice(0, 8);

  // By-account daily data
  const rawDailyByAccount = Array.isArray(data?.dailyCostByAccount) ? data.dailyCostByAccount : [];
  const allAccNames = new Set<string>();
  const ACCOUNT_DAILY = rawDailyByAccount.map((d: any) => {
    const entry: any = { date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    Object.entries(d.accounts || {}).forEach(([name, cost]: any) => {
      if (cost > 0.01) { entry[name] = cost; allAccNames.add(name); }
    });
    return entry;
  });
  const topAccNames = [...allAccNames].slice(0, 8);

  const rawTopResources = data?.topSpendingResources || data?.top_spending_resources || data?.topResources || [];
  const RESOURCES = Array.isArray(rawTopResources) ? rawTopResources.map((r: any) => {
    const accIdStr = String(r.account_id || r.accountId || r.line_item_usage_account_id || 'Unknown');
    const resolvedName = (r.account_name && r.account_name !== accIdStr) ? String(r.account_name) : `Account ${accIdStr.slice(-4)}`;

    return {
      service: r.service || r.serviceName || 'Unknown',
      type: r.resource_type || r.type || 'Other',
      id: r.resource_id || r.raw_resource_id || r.id || 'Unknown',
      cost: Number(r.total_cost || r.cost || 0),
      account: accIdStr, accountName: resolvedName
    };
  }) : [];
  
  // maxResourceCost available if needed: RESOURCES.length > 0 ? RESOURCES[0].cost : 1

  // ── OU Metrics ──
  const ouMetrics = data?.ouMetrics || { ouSummary: [], topServicePerOu: [], dailyOuTrend: [], accountsByOu: [] };
  const ouSummary = ouMetrics.ouSummary || [];
  const topServicePerOu = ouMetrics.topServicePerOu || [];
  const accountsByOu = ouMetrics.accountsByOu || [];
  const dailyOuTrend = ouMetrics.dailyOuTrend || [];

  const totalOuCost = ouSummary.reduce((s: number, o: any) => s + (o.total_cost || 0), 0);
  // OU KPI values (used in OU section if re-enabled)
  // const totalOuAccounts = ouSummary.reduce((s: number, o: any) => s + (o.account_count || 0), 0);
  // const highestOu = ouSummary.length > 0 ? ouSummary[0] : { ou_name: 'N/A', total_cost: 0 };
  // const uncategorizedCost = ouSummary.find((o: any) => o.ou_name === 'Uncategorized')?.total_cost || 0;

  // Build OU donut data
  // const ouDonutData = ouSummary.map((o: any) => ({ name: o.ou_name, value: o.total_cost }));

  // Build OU stacked chart data
  const ouNames = Array.from(new Set<string>(dailyOuTrend.map((d: any) => String(d.ou_name)))).slice(0, 8);
  const ouDates = Array.from(new Set<string>(dailyOuTrend.map((d: any) => String(d.usage_date)))).sort();
  const ouStackedData = ouDates.map((date: string) => {
    const entry: any = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    ouNames.forEach((ou: string) => {
      const match = dailyOuTrend.find((d: any) => d.usage_date === date && d.ou_name === ou);
      entry[ou] = match ? match.daily_cost : 0;
    });
    return entry;
  });

  // Merge top service into OU summary for display
  const ouTableData = ouSummary.map((o: any) => {
    const topSvc = topServicePerOu.find((s: any) => s.ou_name === o.ou_name);
    const accounts = accountsByOu.filter((a: any) => a.ou_name === o.ou_name);
    return {
      ...o,
      pct: totalOuCost > 0 ? (o.total_cost / totalOuCost) * 100 : 0,
      top_service: topSvc?.top_service || 'N/A',
      accounts
    };
  });

  const toggleOu = (ouName: string) => setExpandedOus(prev => ({ ...prev, [ouName]: !prev[ouName] }));

  // ── Product Category Metrics ──
  const pcMetrics = data?.productCategoryMetrics || { categorySummary: [], topServicePerCategory: [], dailyCategoryTrend: [], servicesByCategory: [] };
  const catSummary = pcMetrics.categorySummary || [];
  const topServicePerCat = pcMetrics.topServicePerCategory || [];
  const servicesByCat = pcMetrics.servicesByCategory || [];
  const dailyCatTrend = pcMetrics.dailyCategoryTrend || [];

  const totalCatCost = catSummary.reduce((s: number, c: any) => s + (c.total_cost || 0), 0);

  // Build category stacked chart data
  const catNames = Array.from(new Set<string>(dailyCatTrend.map((d: any) => String(d.category_name)))).slice(0, 8);
  const catDates = Array.from(new Set<string>(dailyCatTrend.map((d: any) => String(d.usage_date)))).sort();
  /* catStackedData — available for stacked chart if re-enabled
  const catStackedData = catDates.map((date: string) => {
    const entry: any = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    catNames.forEach((cat: string) => {
      const match = dailyCatTrend.find((d: any) => d.usage_date === date && d.category_name === cat);
      entry[cat] = match ? match.daily_cost : 0;
    });
    return entry;
  }); */

  // Merge services into category summary
  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({});
  const catTableData = catSummary.map((c: any) => {
    const topSvc = topServicePerCat.find((s: any) => s.category_name === c.category_name);
    const services = servicesByCat.filter((s: any) => s.category_name === c.category_name);
    return {
      ...c,
      pct: totalCatCost > 0 ? (c.total_cost / totalCatCost) * 100 : 0,
      top_service: topSvc?.top_service || 'N/A',
      services
    };
  });
  const toggleCat = (catName: string) => setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }));

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8">
      {/* ── KPI 7 Cards Row — Glass Design ── */}
      {(() => {
        const supportPct = metrics.totalSpend > 0 ? ((metrics.supportCost / metrics.totalSpend) * 100) : 0;
        const marketplacePct = metrics.totalSpend > 0 ? ((metrics.marketplaceCost / metrics.totalSpend) * 100) : 0;
        const topServicePct = metrics.totalSpend > 0 ? ((metrics.topService.cost / metrics.totalSpend) * 100) : 0;
        const topRegionPct = metrics.totalSpend > 0 ? ((metrics.topRegion.cost / metrics.totalSpend) * 100) : 0;
        const topAccountPct = metrics.totalSpend > 0 ? ((metrics.topAccount.cost / metrics.totalSpend) * 100) : 0;
        const topAccLabel = String(metrics.topAccount?.label || '');
        const matchedLinked = linkedAccounts.find((a: any) => String(a.accountId) === topAccLabel);
        const resolvedAccountName = (matchedLinked?.accountName && String(matchedLinked.accountName) !== topAccLabel ? String(matchedLinked.accountName) : null) || (topAccLabel ? `Account ${topAccLabel.slice(-4)}` : 'N/A');
        const cardBg = "bg-white dark:bg-gray-900/60 backdrop-blur-sm";
        const cardText = "text-gray-900 dark:text-white";
        const cardSub = "text-gray-500 dark:text-gray-400";
        const barBg = "bg-gray-200 dark:bg-gray-700";
        const cardBase = "rounded-2xl p-3 sm:p-4 transition-all shadow-sm dark:shadow-none flex flex-col justify-between min-h-[130px]";
        const badgeCls = "text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider";
        const valCls = `text-lg sm:text-xl leading-tight font-bold ${cardText} mb-0.5 truncate`;
        const subCls = `${cardSub} text-[11px] truncate`;
        const barH = "h-1.5";
        return (
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 sm:gap-4">

        {/* 1. Total Spend */}
        <div className={`${cardBg} ${cardBase} border border-emerald-500/30 hover:border-emerald-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg"><DollarSign className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /></div>
            <span className={`${badgeCls} bg-emerald-500/20 text-emerald-600 dark:text-emerald-300`}>Usage</span>
          </div>
          <div>
            <div className={valCls}>${metrics.totalSpend.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className={subCls}>Total Spend</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-1.5 rounded-full w-full" />
          </div>
        </div>

        {/* 2. Accounts */}
        <div className={`${cardBg} ${cardBase} border border-teal-500/30 hover:border-teal-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-teal-500/20 rounded-lg"><Building2 className="w-4 h-4 text-teal-500 dark:text-teal-400" /></div>
            <span className={`${badgeCls} bg-teal-500/20 text-teal-600 dark:text-teal-300`}>Active</span>
          </div>
          <div>
            <div className={valCls}>{metrics.activeAccounts}</div>
            <div className={subCls}>Linked Accounts</div>
          </div>
          <div className="mt-2" />
        </div>

        {/* 3. Support Cost */}
        <div className={`${cardBg} ${cardBase} border border-purple-500/30 hover:border-purple-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-purple-500/20 rounded-lg"><ShieldCheck className="w-4 h-4 text-purple-500 dark:text-purple-400" /></div>
            <span className={`${badgeCls} bg-purple-500/20 text-purple-600 dark:text-purple-300`}>Fees</span>
          </div>
          <div>
            <div className={valCls}>${metrics.supportCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className={subCls}>Support ({supportPct.toFixed(1)}%)</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.max(supportPct, 4)}%` }} />
          </div>
        </div>

        {/* 4. Marketplace */}
        <div className={`${cardBg} ${cardBase} border border-indigo-500/30 hover:border-indigo-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-indigo-500/20 rounded-lg"><ShoppingCart className="w-4 h-4 text-indigo-500 dark:text-indigo-400" /></div>
            <span className={`${badgeCls} bg-indigo-500/20 text-indigo-600 dark:text-indigo-300`}>Vendor</span>
          </div>
          <div>
            <div className={valCls}>${metrics.marketplaceCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
            <div className={subCls}>Marketplace ({marketplacePct.toFixed(1)}%)</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.max(marketplacePct, 4)}%` }} />
          </div>
        </div>

        {/* 5. Top Service */}
        <div className={`${cardBg} ${cardBase} border border-cyan-500/30 hover:border-cyan-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-cyan-500/20 rounded-lg"><Server className="w-4 h-4 text-cyan-500 dark:text-cyan-400" /></div>
            <span className={`${badgeCls} bg-cyan-500/20 text-cyan-600 dark:text-cyan-300`}>Top Service</span>
          </div>
          <div>
            <div className={valCls}>{metrics.topService.label.replace('Amazon ', '').replace('Elastic Compute Cloud', 'EC2').replace('Savings Plans for AWS Compute usage', 'SP: Compute')}</div>
            <div className={subCls}>${metrics.topService.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({topServicePct.toFixed(1)}%)</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(topServicePct, 100)}%` }} />
          </div>
        </div>

        {/* 6. Top Region */}
        <div className={`${cardBg} ${cardBase} border border-pink-500/30 hover:border-pink-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-pink-500/20 rounded-lg"><Globe className="w-4 h-4 text-pink-500 dark:text-pink-400" /></div>
            <span className={`${badgeCls} bg-pink-500/20 text-pink-600 dark:text-pink-300`}>Top Region</span>
          </div>
          <div>
            <div className={valCls}>{metrics.topRegion.label.toUpperCase()}</div>
            <div className={subCls}>${metrics.topRegion.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({topRegionPct.toFixed(1)}%)</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-pink-500 to-pink-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(topRegionPct, 100)}%` }} />
          </div>
        </div>

        {/* 7. Top Account */}
        <div className={`${cardBg} ${cardBase} border border-orange-500/30 hover:border-orange-400/50`}>
          <div className="flex items-center justify-between mb-2">
            <div className="p-1.5 bg-orange-500/20 rounded-lg"><Crown className="w-4 h-4 text-orange-500 dark:text-orange-400" /></div>
            <span className={`${badgeCls} bg-orange-500/20 text-orange-600 dark:text-orange-300`}>Top Account</span>
          </div>
          <div>
            <div className={valCls}>{resolvedAccountName}</div>
            <div className={subCls}>${metrics.topAccount.cost.toLocaleString(undefined, { maximumFractionDigits: 0 })} ({topAccountPct.toFixed(1)}%)</div>
          </div>
          <div className={`w-full ${barBg} rounded-full ${barH} mt-2`}>
            <div className="bg-gradient-to-r from-orange-500 to-orange-400 h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(topAccountPct, 100)}%` }} />
          </div>
        </div>

      </div>
        );
      })()}

      {/* ── Cost Trend Chart with Toggle ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Daily Cost Trend</h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                Last {DAILY_DATA.length} days · {trendView === 'total' ? 'Consolidated' : trendView === 'service' ? 'By Service' : 'By Account'}
              </p>
            </div>
          </div>
          <div className="flex items-center border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {(['total', 'service', 'account'] as const).map(view => (
              <button key={view} onClick={() => setTrendView(view)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors ${trendView === view ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                {view === 'total' ? 'Total' : view === 'service' ? 'By Service' : 'By Account'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-48 sm:h-60 lg:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <LineChart
              data={trendView === 'total' ? DAILY_DATA : trendView === 'service' ? SERVICE_DAILY : ACCOUNT_DAILY}
              margin={{ top: 5, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#374151" : "#f1f5f9"} vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} minTickGap={30} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: any) => `$${Number(v).toLocaleString()}`} />
              <RechartsTooltip content={<CustomTooltip />} />
              {trendView === 'total' && (
                <Line key="consolidated" type="monotone" dataKey="consolidated"
                  stroke={isDark ? "#818cf8" : "#4f46e5"} strokeWidth={2.5} dot={{ r: 2.5, fill: isDark ? "#818cf8" : "#4f46e5" }}
                  activeDot={{ r: 5, fill: "#4f46e5", stroke: "#fff", strokeWidth: 2 }}
                  name="consolidated" />
              )}
              {trendView === 'service' && topServices.map((svc, i) => (
                <Line key={svc} type="monotone" dataKey={svc} stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2} dot={false} name={svc} />
              ))}
              {trendView === 'account' && topAccNames.map((acc, i) => (
                <Line key={acc} type="monotone" dataKey={acc} stroke={COLORS[i % COLORS.length]}
                  strokeWidth={2} dot={false} name={acc} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom Grid: Donut + Accounts ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
        {/* Cost by Region Donut */}
        {(() => {
          const regionCosts = Array.isArray(data?.regionCosts) ? data.regionCosts : [];
          const REGIONS = regionCosts
            .filter((r: any) => Number(r.cost || 0) > 0)
            .map((r: any) => ({ name: String(r.region || 'Unknown'), cost: Number(r.cost || 0) }))
            .sort((a: any, b: any) => b.cost - a.cost);
          return (
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6 flex flex-col md:col-span-1">
          <div className="flex items-center gap-3 mb-4 sm:mb-6">
            <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
              <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Cost by Region</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Regional cost distribution</p>
            </div>
          </div>

          <div className="relative h-48 mb-4">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={REGIONS.slice(0, 8)} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} dataKey="cost" nameKey="name" stroke="none">
                  {REGIONS.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(value: any, name: any) => [`$${Number(value || 0).toFixed(2)}`, name]} contentStyle={{ background: isDark ? "#1f2937" : "#fff", border: `1px solid ${isDark ? "#374151" : "#f1f5f9"}`, borderRadius: "12px", fontSize: "12px", color: isDark ? "#f3f4f6" : "#1e293b", fontWeight: 600, boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }} itemStyle={{ color: isDark ? "#d1d5db" : "#475569" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-xl font-bold text-gray-900 dark:text-gray-100">${totalCost >= 1000 ? (totalCost / 1000).toFixed(1) + 'k' : totalCost.toFixed(0)}</div>
              <div className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 tracking-wider mt-0.5">TOTAL</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-40">
            {REGIONS.slice(0, 8).map((r: any, i: number) => {
              const pct = totalCost > 0 ? (r.cost / totalCost * 100) : 0;
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{r.name}</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-14 text-right">${r.cost >= 1000 ? (r.cost / 1000).toFixed(1) + 'k' : r.cost.toFixed(0)}</span>
                  <span className="text-[10px] text-gray-400 dark:text-gray-500 w-10 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
          );
        })()}

        {/* Member Accounts Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 flex flex-col md:col-span-1 lg:col-span-2">
          <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg shrink-0">
                <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Member Accounts</h3>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-x-auto max-h-[400px]">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
              <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Account</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Cost</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Share</th>
                  <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {ACCOUNTS.map((a: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800 group">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${COLORS[i % COLORS.length]}15` }}>
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{a.name}</div>
                          <div className="text-xs text-gray-500 font-mono mt-0.5">{a.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-bold">${a.cost.toFixed(2)}</td>
                    <td className="py-3 px-6 text-right text-sm text-gray-500">{a.pct.toFixed(1)}%</td>
                    <td className="py-3 px-6 text-center">
                      <button onClick={() => onDrillDown(a.id)} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 rounded-lg hover:bg-blue-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                        Details <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Cost by Category & Service ── */}
      {catSummary.length > 0 && (
        <>
          {/* Category Stacked Bar + Detail Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-violet-100 dark:bg-violet-900 rounded-lg"><Boxes className="w-5 h-5 text-violet-600" /></div>
                <div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Cost by Category & Service</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click a category to see its service breakdown</p>
                </div>
                <span className="ml-auto text-xs font-bold text-violet-600 bg-violet-50 dark:bg-violet-950 px-2 py-1 rounded-full">{catSummary.filter((c: any) => c.category_name !== 'Uncategorized').length} CATEGORIES</span>
              </div>
            </div>

            {/* Stacked proportion bar */}
            <div className="px-4 sm:px-6 pt-4">
              <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700">
                {catTableData.map((cat: any, i: number) => (
                  <div key={cat.category_name} className="h-full transition-all" style={{ width: `${cat.pct}%`, backgroundColor: COLORS[i % COLORS.length] }} title={`${cat.category_name}: ${cat.pct.toFixed(1)}%`} />
                ))}
              </div>
            </div>

            <div className="overflow-x-auto p-2 sm:p-4">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[500px]">
                <tbody>
                  {catTableData.map((cat: any, idx: number) => {
                    const color = COLORS[idx % COLORS.length];
                    const isExpanded = expandedCats[cat.category_name];
                    return (
                      <React.Fragment key={cat.category_name}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer border-b border-gray-100 dark:border-gray-700" onClick={() => toggleCat(cat.category_name)}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{cat.category_name}</span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{cat.services.length} services</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2 hidden sm:block">
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(cat.pct, 100)}%`, background: color }} />
                              </div>
                              <span className="text-xs text-gray-500 w-12 text-right">{cat.pct.toFixed(1)}%</span>
                              <span className="font-bold font-mono text-gray-900 dark:text-gray-100 w-24 text-right">${cat.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && cat.services.map((svc: any) => {
                          const svcPct = cat.total_cost > 0 ? (svc.service_cost / cat.total_cost) * 100 : 0;
                          return (
                            <tr key={`${cat.category_name}-${svc.service_name}`} className="bg-gray-50/50 dark:bg-gray-900/30 border-b border-gray-50 dark:border-gray-800">
                              <td className="py-2 px-4 pl-16">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, opacity: 0.6 }} />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{svc.service_name}</span>
                                </div>
                              </td>
                              <td className="py-2 px-4 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 hidden sm:block">
                                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(svcPct, 100)}%`, background: color, opacity: 0.7 }} />
                                  </div>
                                  <span className="text-[10px] text-gray-400 w-12 text-right">{svcPct.toFixed(1)}%</span>
                                  <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-24 text-right">${svc.service_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Cost by Organizational Unit ── */}
      {ouSummary.length > 0 && (
        <>
          {/* OU Stacked Bar Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg"><BarChart3 className="w-5 h-5 text-indigo-600" /></div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">OU Cost Trend</h3>
              </div>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <BarChart data={ouStackedData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#374151' : '#E5E7EB'} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#6B7280' }} />
                    <YAxis tick={{ fontSize: 10, fill: isDark ? '#9CA3AF' : '#6B7280' }} tickFormatter={(v: number) => `$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v.toFixed(0)}`} />
                    <RechartsTooltip content={<CustomTooltip />} />
                    {ouNames.map((ou: string, i: number) => (
                      <Bar key={ou} dataKey={ou} stackId="ou" fill={COLORS[i % COLORS.length]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          {/* OU Detail Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg dark:shadow-gray-900/20 border border-gray-100 dark:border-gray-700 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg"><Layers className="w-5 h-5 text-blue-600" /></div>
                <div>
                  <h3 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900 dark:text-gray-100">Cost by Organizational Unit</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Click an OU to see its member accounts</p>
                </div>
                <span className="ml-auto text-xs font-bold text-blue-600 bg-blue-50 dark:bg-blue-950 px-2 py-1 rounded-full">{ouSummary.filter((o: any) => o.ou_name !== 'Uncategorized').length} ACTIVE</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap min-w-[600px]">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">OU / Account</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-right">Cost</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Share</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase">Top Service</th>
                    <th className="py-3 px-6 text-xs font-semibold text-gray-500 uppercase text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {ouTableData.map((ou: any, idx: number) => {
                    const color = COLORS[idx % COLORS.length];
                    const isExpanded = expandedOus[ou.ou_name];
                    return (
                      <React.Fragment key={ou.ou_name}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer" onClick={() => toggleOu(ou.ou_name)}>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-3">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                              <span className="font-semibold text-gray-900 dark:text-gray-100">{ou.ou_name}</span>
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{ou.account_count} accounts</span>
                            </div>
                          </td>
                          <td className="py-3 px-6 text-right font-bold font-mono">${ou.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="py-3 px-6">
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(ou.pct, 100)}%`, background: color }} />
                              </div>
                              <span className="text-xs text-gray-500">{ou.pct.toFixed(1)}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-6 text-sm text-gray-600 dark:text-gray-400">{ou.top_service}</td>
                          <td className="py-3 px-6 text-center">
                            <span className="text-xs text-blue-600">{isExpanded ? 'Hide' : 'Expand'}</span>
                          </td>
                        </tr>
                        {isExpanded && ou.accounts.map((acc: any) => {
                          const accPct = ou.total_cost > 0 ? (acc.account_cost / ou.total_cost) * 100 : 0;
                          return (
                            <tr key={`${ou.ou_name}-${acc.account_id}`} className="bg-gray-50/50 dark:bg-gray-900/30 hover:bg-gray-100 dark:hover:bg-gray-700/30">
                              <td className="py-2.5 px-6 pl-16">
                                <div className="flex items-center gap-2">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, opacity: 0.6 }} />
                                  <span className="text-sm text-gray-700 dark:text-gray-300">{acc.account_name}</span>
                                  <span className="text-[10px] text-gray-400 font-mono">{acc.account_id}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-6 text-right text-sm font-mono">${acc.account_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="py-2.5 px-6">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(accPct, 100)}%`, background: color, opacity: 0.7 }} />
                                  </div>
                                  <span className="text-[10px] text-gray-400">{accPct.toFixed(1)}% of OU</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-6"></td>
                              <td className="py-2.5 px-6 text-center">
                                <button onClick={(e) => { e.stopPropagation(); onDrillDown(String(acc.account_id).trim()); }} className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950 rounded hover:bg-blue-600 hover:text-white transition-colors">
                                  Details <ExternalLink className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}