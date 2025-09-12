// src/components/RecommendationsPanel.tsx
import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Server,
  Database,
  HardDrive,
  CheckCircle,
  TrendingUp,
  Settings,
  Trash2,
  Eye,
  Copy,
  BarChart2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

interface Recommendation {
  id: string;
  type?: string | null;
  severity?: "high" | "medium" | "low" | string | null;
  resource?: string | null;
  description?: string | null;
  potentialSavings?: number | null;
  estimatedCost?: number | null;
  lastActivity?: string | null;
  action?: string | null;
  __raw?: Record<string, any> | null;
}

interface RecommendationsPanelProps {
  data?: Recommendation[] | null;
}

/* ---------- Helpers (same as earlier, slightly trimmed) ---------- */
const formatCurrency = (v?: number | null) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "N/A";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(value);
  }
};

const parseJSONSafe = (text?: string | null) => {
  if (!text) return null;
  try {
    if (typeof text !== "string") return text;
    const trimmed = text.trim();
    if (!trimmed) return null;
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const getSeverityClass = (s?: string | null) => {
  switch ((s || "").toLowerCase()) {
    case "high":
      return "bg-red-50 text-red-800 border-red-100";
    case "medium":
      return "bg-amber-50 text-amber-800 border-amber-100";
    case "low":
      return "bg-sky-50 text-sky-800 border-sky-100";
    default:
      return "bg-gray-50 text-gray-800 border-gray-100";
  }
};

const getTypeIcon = (type?: string | null) => {
  const t = (type || "").toLowerCase();
  if (t.includes("savingsplans")) return <TrendingUp className="w-4 h-4" />;
  if (t.includes("reservedinstances") || t.includes("reserved")) return <Database className="w-4 h-4" />;
  if (t.includes("ebs") || t.includes("volume")) return <HardDrive className="w-4 h-4" />;
  if (t.includes("ec2") || t.includes("instance")) return <Server className="w-4 h-4" />;
  if (t.includes("graviton")) return <Settings className="w-4 h-4" />;
  return <AlertTriangle className="w-4 h-4" />;
};

const summarizeDetails = (parsed: any) => {
  if (!parsed) return null;
  if (typeof parsed === "string" || typeof parsed === "number") return String(parsed);

  const keys = Object.keys(parsed || {});
  const ebsKey = keys.find((k) => /ebs|volume/i.test(k));
  if (ebsKey) {
    const payload = parsed[ebsKey] || parsed;
    const storage = payload?.configuration?.storage || payload?.storage || payload?.configuration || payload;
    const type = storage?.type || storage?.storageType || null;
    const size = storage?.sizeInGb || storage?.volumeSize || storage?.size || null;
    const iops = storage?.performance?.iops || storage?.iops || null;
    const throughput = storage?.performance?.throughput || storage?.throughput || null;
    const parts = [];
    if (type) parts.push(type);
    if (size) parts.push(`${size} GiB`);
    if (iops) parts.push(`${iops} IOPS`);
    if (throughput) parts.push(`${throughput} MB/s`);
    return parts.join(" · ") || JSON.stringify(parsed).slice(0, 240);
  }

  const riKey = keys.find((k) => /reserved|reservation|reservedinstances/i.test(k));
  if (riKey) {
    const obj = parsed[riKey] || parsed;
    const conf = obj.configuration || obj;
    const count = conf?.numberOfInstancesToPurchase ?? conf?.numberOfInstances ?? obj?.numberOfInstances ?? null;
    const instance = conf?.instance?.type || conf?.instanceType || conf?.instance || obj?.instanceType || null;
    const term = conf?.term || obj?.term || null;
    const region = conf?.reservedInstancesRegion ?? obj?.region ?? null;
    const parts = [];
    if (count) parts.push(`${count} × ${instance ?? "instance"}`);
    if (term) parts.push(term);
    if (region) parts.push(region);
    return parts.join(" · ") || JSON.stringify(parsed).slice(0, 240);
  }

  const ec2Key = keys.find((k) => /ec2|instance/i.test(k));
  if (ec2Key) {
    const obj = parsed[ec2Key] || parsed;
    const it = obj?.configuration?.instance?.type || obj?.instanceType || obj?.instance || null;
    const parts = [];
    if (it) parts.push(`${it}`);
    if (obj?.region) parts.push(obj.region);
    return parts.join(" · ") || JSON.stringify(parsed).slice(0, 240);
  }

  const pairs = Object.entries(parsed).slice(0, 6).map(([k, v]) => {
    if (typeof v === "object") return `${k}: ${JSON.stringify(v).slice(0, 60)}`;
    return `${k}: ${String(v)}`.slice(0, 60);
  });
  return pairs.join(" · ");
};

const detectEbsUpgrade = (parsed: any) => {
  if (!parsed) return null;
  const keys = Object.keys(parsed);
  const ebsKey = keys.find((k) => /ebs|volume/i.test(k));
  const candidate = parsed[ebsKey] || parsed;
  const storage = candidate?.configuration?.storage || candidate?.storage || candidate?.configuration || candidate;
  const currentType = storage?.type || storage?.storageType || null;
  if (currentType && typeof currentType === "string") {
    const cur = currentType.toLowerCase();
    if (cur.includes("gp2")) {
      return {
        recommended: true,
        from: "gp2",
        to: "gp3",
        message: `Upgrade volume from gp2 → gp3 for improved IOPS/throughput and potential cost benefits.`,
      };
    }
    if (cur.includes("gp3")) {
      return {
        recommended: false,
        from: "gp3",
        to: null,
        message: `Volume already gp3 — consider tuning provisioning.`,
      };
    }
  }
  return null;
};

/* ---------- Grouping logic ---------- */
/**
 * Determine which section a recommendation belongs to.
 * Priority:
 *  - If record has explicit recommendation_source in raw: use it
 *  - Else deduce from type / action / raw keys
 * Returns one of: "Compute Optimizer", "Billing & Cost Management", "Other"
 */
const classifySource = (rec: Recommendation) => {
  const rawSource = (rec.__raw && (rec.__raw.recommendation_source || rec.__raw.recommendationSource)) as string | undefined;
  if (rawSource) {
    const s = rawSource.toLowerCase();
    if (s.includes("compute") || s.includes("optimizer") || s.includes("computeoptimizer")) return "Compute Optimizer";
    if (s.includes("billing") || s.includes("cost") || s.includes("management") || s.includes("billingandcostmanagement")) return "Billing & Cost Management";
  }

  const type = (rec.type || rec.action || "").toLowerCase();
  if (type.includes("ec2") || type.includes("instance") || type.includes("migrate") || type.includes("graviton") || type.includes("rightsizing") || type.includes("compute")) {
    return "Compute Optimizer";
  }
  if (type.includes("ebs") || type.includes("volume") || type.includes("delete") || type.includes("reserved") || type.includes("purchase") || type.includes("savings") || type.includes("cost")) {
    return "Billing & Cost Management";
  }

  // fallback to checking raw JSON keys
  const raw = rec.__raw || {};
  const keys = Object.keys(raw).join(" ").toLowerCase();
  if (keys.includes("ebs") || keys.includes("volume") || keys.includes("reserved") || keys.includes("savings")) return "Billing & Cost Management";
  if (keys.includes("cpu") || keys.includes("rightsizing") || keys.includes("recommendation")) return "Compute Optimizer";

  return "Other";
};

/* ---------- Component ---------- */
const RecommendationsPanel: React.FC<RecommendationsPanelProps> = ({ data }) => {
  const items: Recommendation[] = Array.isArray(data) ? data : [];

  // UI state
  const [priorityFilter, setPriorityFilter] = useState<"all" | "high" | "medium" | "low">("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [modalItem, setModalItem] = useState<Recommendation | null>(null);
  const [copied, setCopied] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({
    "Compute Optimizer": false,
    "Billing & Cost Management": false,
    Other: false,
  });

  // totals
  const totalSavings = items.reduce((s, it) => s + Number(it?.potentialSavings ?? 0), 0);

  // computed filtered items
  const filtered = useMemo(() => {
    if (priorityFilter === "all") return items;
    return items.filter((it) => (it.severity || "").toLowerCase() === priorityFilter);
  }, [items, priorityFilter]);

  // group by source
  const grouped = useMemo(() => {
    const map: Record<string, Recommendation[]> = {
      "Compute Optimizer": [],
      "Billing & Cost Management": [],
      Other: [],
    };
    for (const rec of filtered) {
      const group = classifySource(rec);
      if (group === "Compute Optimizer") map["Compute Optimizer"].push(rec);
      else if (group === "Billing & Cost Management") map["Billing & Cost Management"].push(rec);
      else map["Other"].push(rec);
    }
    return map;
  }, [filtered]);

  const copyToClipboard = async (text: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      if (id) {
        setCopied((p) => ({ ...p, [id]: true }));
        setTimeout(() => setCopied((p) => ({ ...p, [id]: false })), 1400);
      }
    } catch {
      // ignore
    }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((s) => ({ ...s, [group]: !s[group] }));
  };

  return (
    <div className="space-y-8">
      {/* Header area with priority filter */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 text-white shadow">
            <div className="text-sm">Potential Monthly Savings</div>
            <div className="text-xl font-semibold">{formatCurrency(totalSavings)}</div>
          </div>

          <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 shadow-sm">
            <span className="text-sm font-medium text-gray-700 mr-2">Priority</span>
            {(["all", "high", "medium", "low"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-3 py-1 rounded-md text-sm ${priorityFilter === p ? "bg-blue-600 text-white" : "text-gray-700 hover:bg-gray-50"}`}
                aria-pressed={priorityFilter === p}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="text-sm text-gray-600">Showing <strong>{filtered.length}</strong> of <strong>{items.length}</strong> recommendations</div>
      </div>

      {/* For each group: header and list */}
      {(["Compute Optimizer", "Billing & Cost Management", "Other"] as const).map((groupName) => {
        const list = grouped[groupName] || [];
        const collapsed = !!collapsedGroups[groupName];

        return (
          <section key={groupName} className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
            <div className="p-4 flex items-center justify-between border-b">
              <div className="flex items-center gap-3">
                <button onClick={() => toggleGroup(groupName)} aria-expanded={!collapsed} className="p-1 rounded hover:bg-gray-50">
                  {collapsed ? <ChevronRight className="w-5 h-5 text-gray-600" /> : <ChevronDown className="w-5 h-5 text-gray-600" />}
                </button>
                <h3 className="text-lg font-semibold text-gray-900">{groupName}</h3>
                <div className="text-sm text-gray-500">({list.length})</div>
                <div className="text-sm text-gray-500 ml-3">Recommendations from {groupName === "Other" ? "various sources" : groupName}</div>
              </div>

              <div className="text-sm text-gray-600">{list.length > 0 ? `Top savings: ${formatCurrency(list.reduce((s, r) => s + Number(r?.potentialSavings ?? 0), 0))}` : "No recommendations"}</div>
            </div>

            {/* collapsed state */}
            {collapsed ? null : (
              <div>
                {list.length === 0 ? (
                  <div className="p-8 text-center text-gray-600">No recommendations in this category.</div>
                ) : (
                  <div className="divide-y">
                    {list.map((rec) => {
                      const title = rec.resource ?? rec.id ?? "Recommendation";
                      const savings = Number(rec.potentialSavings ?? 0);
                      const cost = Number(rec.estimatedCost ?? 0);
                      const parsed = parseJSONSafe(rec.description ?? rec.__raw?.recommended_resource_details ?? null);
                      const summary = parsed ? summarizeDetails(parsed) : (rec.description ?? "").slice(0, 600);
                      const isLong = (typeof summary === "string" && summary.length > 300) || !!parsed;
                      const isExpanded = !!expanded[rec.id];

                      const ebsUpgrade = parsed ? detectEbsUpgrade(parsed) : null;
                      const showUpgradeMessage = ebsUpgrade && ebsUpgrade.recommended && ebsUpgrade.from === "gp2" && ebsUpgrade.to === "gp3";

                      return (
                        <div key={rec.id} className="p-6 flex gap-4 items-start hover:bg-gray-50 transition-colors">
                          <div className="flex-shrink-0 mt-1">
                            <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center">
                              {getTypeIcon(rec.type)}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-3">
                                  <h4 className="text-base font-semibold text-gray-900 truncate">{title}</h4>
                                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${getSeverityClass(rec.severity)}`}>{(rec.severity || "low").toUpperCase()} PRIORITY</span>
                                </div>

                                <div className="text-sm text-gray-600 mt-2 max-w-3xl">
                                  {showUpgradeMessage ? (
                                    <div className="text-sm text-gray-700">
                                      <strong>Recommendation:</strong> Upgrade volume from <code className="bg-gray-100 px-1 rounded">gp2</code> → <code className="bg-gray-100 px-1 rounded">gp3</code>. This improves IOPS/throughput and may reduce costs.
                                    </div>
                                  ) : (
                                    isExpanded ? summary : (typeof summary === "string" ? (summary.length > 340 ? `${summary.slice(0, 340)}...` : summary) : summary)
                                  )}
                                </div>

                                <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
                                  {isLong && !showUpgradeMessage && (
                                    <button onClick={() => setExpanded((p) => ({ ...p, [rec.id]: !p[rec.id] }))} className="text-sky-600 hover:underline flex items-center gap-1">
                                      <Eye className="w-4 h-4" /> {isExpanded ? "Show less" : "Show more"}
                                    </button>
                                  )}

                                  {parsed && (
                                    <button onClick={() => setModalItem(rec)} className="text-sky-600 hover:underline flex items-center gap-1">
                                      <BarChart2 className="w-4 h-4" /> Details
                                    </button>
                                  )}

                                  <button onClick={() => copyToClipboard(JSON.stringify(rec.__raw ?? rec, null, 2), rec.id)} className="text-gray-500 hover:text-gray-700 flex items-center gap-1">
                                    <Copy className="w-4 h-4" /> {copied[rec.id] ? <span className="text-xs text-green-600">Copied!</span> : <span className="text-xs">Copy raw</span>}
                                  </button>
                                </div>

                                <div className="text-xs text-gray-400 mt-3">Last refreshed: {formatDate(rec.lastActivity)}</div>
                              </div>

                              <div className="flex-shrink-0 text-right">
                                <div className="text-green-600 font-semibold text-xl">{formatCurrency(savings)}</div>
                                {cost > 0 && <div className="text-xs text-gray-500">out of {formatCurrency(cost)} monthly cost</div>}

                                {cost > 0 && (
                                  <div className="mt-3 w-40 bg-gray-100 rounded-full h-2 overflow-hidden">
                                    <div className="h-2 bg-gradient-to-r from-green-400 to-green-500 transition-all" style={{ width: `${Math.min(100, (savings / cost) * 100)}%` }} aria-hidden />
                                  </div>
                                )}

                                <div className="mt-4 flex flex-col gap-2 items-end">
                                  {showUpgradeMessage ? (
                                    <button onClick={() => console.info("upgrade", rec.id)} className="text-sm px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
                                      <HardDrive className="w-4 h-4" /> Upgrade
                                    </button>
                                  ) : (
                                    <button onClick={() => console.info("action", rec.id)} className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                                      <CheckCircle className="w-4 h-4" /> {rec.action ?? "Apply"}
                                    </button>
                                  )}

                                  <button onClick={() => copyToClipboard(rec.id, rec.id)} className="text-xs text-gray-500 hover:underline mt-1">Copy recommendation id</button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {/* Modal for JSON details */}
      {modalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-lg text-gray-900">Details — {modalItem.resource ?? modalItem.id}</h3>
                <div className="text-sm text-gray-500">Last refreshed: {formatDate(modalItem.lastActivity)}</div>
              </div>
              <div>
                <button onClick={() => setModalItem(null)} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Close</button>
              </div>
            </div>

            <div className="p-4 max-h-[60vh] overflow-auto">
              <pre className="whitespace-pre-wrap text-xs text-gray-800">{JSON.stringify(modalItem.__raw ?? parseJSONSafe(modalItem.description) ?? modalItem, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsPanel;
