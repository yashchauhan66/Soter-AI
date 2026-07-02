"use client";

import { useState } from "react";
import { Shield, AlertTriangle, CheckCircle2, Ban, Search, Filter, Globe, Layers } from "lucide-react";
import type { Organization } from "@prisma/client";

interface Provider {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  providerType: string;
  status: string;
  riskLevel: string;
  dataRegion: string;
  createdAt: string;
}

interface Model {
  id: string;
  organizationId: string;
  providerName: string;
  name: string;
  modality: string;
  riskLevel: string;
  approved: boolean;
  createdAt: string;
}

interface Scan {
  id: string;
  organizationId: string;
  organizationName: string;
  scanType: string;
  status: string;
  providerCount: number;
  modelCount: number;
  findingCount: number;
  createdAt: string;
}

interface ShadowEvent {
  id: string;
  organizationId: string;
  organizationName: string;
  domain: string;
  destination: string;
  employeeId: string;
  riskLevel: string;
  createdAt: string;
}

interface Props {
  organizations: Pick<Organization, "id" | "name">[];
  initialProviders: Provider[];
  initialModels: Model[];
  initialScans: Scan[];
  initialShadowEvents: ShadowEvent[];
}

type Tab = "providers" | "events" | "models" | "scans";

export function ShadowAIClient({ organizations, initialProviders, initialModels, initialScans, initialShadowEvents }: Props) {
  const [tab, setTab] = useState<Tab>("providers");
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [loading, setLoading] = useState<string | null>(null);

  const [providers, setProviders] = useState(initialProviders);

  const filteredProviders = providers.filter((p) => {
    if (selectedOrg !== "all" && p.organizationId !== selectedOrg) return false;
    if (selectedStatus !== "all" && p.status !== selectedStatus) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleProviderAction = async (providerId: string, action: "approve" | "block" | "review") => {
    setLoading(providerId);
    try {
      const res = await fetch("/api/admin/shadow-ai", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId, action }),
      });
      if (res.ok) {
        const statusMap: Record<string, string> = { approve: "APPROVED", block: "BLOCKED", review: "REVIEW" };
        setProviders((prev) =>
          prev.map((p) => (p.id === providerId ? { ...p, status: statusMap[action] ?? p.status } : p))
        );
      }
    } catch {
      // Handle error
    } finally {
      setLoading(null);
    }
  };

  // Keep providers in sync if initialProviders changes (e.g. on page navigation)
  // Using a ref to track the latest initialProviders is not needed here since
  // the component is mounted once per page visit.

  const riskColor = (level: string) => {
    switch (level.toUpperCase()) {
      case "CRITICAL": return "text-red-400 bg-red-500/10";
      case "HIGH": return "text-red-300 bg-red-500/10";
      case "MEDIUM": return "text-amber-300 bg-amber-500/10";
      case "LOW": return "text-lime bg-lime/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "APPROVED": return "text-lime bg-lime/10";
      case "BLOCKED": return "text-red-300 bg-red-500/10";
      case "REVIEW": return "text-amber-300 bg-amber-500/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  const tabs: Array<{ key: Tab; label: string; icon: typeof Shield; count: number }> = [
    { key: "providers", label: "AI Providers", icon: Globe, count: initialProviders.length },
    { key: "events", label: "Shadow Events", icon: AlertTriangle, count: initialShadowEvents.length },
    { key: "models", label: "Models", icon: Layers, count: initialModels.length },
    { key: "scans", label: "Scan History", icon: Search, count: initialScans.length },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <Shield className="text-cyan" size={24} />
          Shadow AI Discovery
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Discover and manage AI tools being used across your organization.
          {initialProviders.length > 0 && ` ${initialProviders.length} providers detected.`}
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "border-cyan bg-cyan/10 text-cyan"
                : "border-slate-800 text-slate-400 hover:border-slate-700"
            }`}
            onClick={() => setTab(t.key)}
          >
            <t.icon size={16} />
            {t.label}
            <span className="ml-1 rounded-full bg-slate-800 px-2 py-0.5 text-xs">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-panel/50 p-4">
        <select
          className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
          value={selectedOrg}
          onChange={(e) => setSelectedOrg(e.target.value)}
        >
          <option value="all">All organizations</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>

        {tab === "providers" && (
          <select
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="REVIEW">Needs Review</option>
            <option value="APPROVED">Approved</option>
            <option value="BLOCKED">Blocked</option>
          </select>
        )}

        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-500" />
          <input
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder={tab === "providers" ? "Search providers..." : "Search domains..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tab Content */}
      {tab === "providers" && (
        <div className="space-y-3">
          {filteredProviders.length === 0 ? (
            <div className="card flex items-center gap-3 p-6 text-slate-400">
              <Shield size={20} />
              No AI providers discovered. Connect the Soter extension to detect shadow AI usage.
            </div>
          ) : (
            filteredProviders.map((provider) => (
              <div key={provider.id} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`rounded-full p-2 ${
                      provider.status === "APPROVED" ? "bg-lime/10" :
                      provider.status === "BLOCKED" ? "bg-red-500/10" : "bg-amber-500/10"
                    }`}>
                      {provider.status === "APPROVED" ? <CheckCircle2 className="text-lime" size={18} /> :
                       provider.status === "BLOCKED" ? <Ban className="text-red-300" size={18} /> :
                       <AlertTriangle className="text-amber-300" size={18} />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-200">{provider.name}</p>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs">
                        <span className="text-slate-500">{provider.providerType}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-500">{provider.dataRegion}</span>
                        <span className="text-slate-500">·</span>
                        <span className="text-slate-500">{provider.organizationName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${riskColor(provider.riskLevel)}`}>
                      {provider.riskLevel}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor(provider.status)}`}>
                      {provider.status}
                    </span>
                    {provider.status !== "APPROVED" && (
                      <button
                        className="rounded-md bg-lime px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-lime/80 disabled:opacity-50"
                        disabled={loading === provider.id}
                        onClick={() => handleProviderAction(provider.id, "approve")}
                      >
                        Approve
                      </button>
                    )}
                    {provider.status !== "BLOCKED" && (
                      <button
                        className="rounded-md bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                        disabled={loading === provider.id}
                        onClick={() => handleProviderAction(provider.id, "block")}
                      >
                        Block
                      </button>
                    )}
                    {provider.status === "APPROVED" && (
                      <button
                        className="rounded-md border border-amber-500/50 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
                        disabled={loading === provider.id}
                        onClick={() => handleProviderAction(provider.id, "review")}
                      >
                        Review
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "events" && (
        <div className="space-y-2">
          {initialShadowEvents.length === 0 ? (
            <div className="card flex items-center gap-3 p-6 text-slate-400">
              <AlertTriangle size={20} />
              No shadow AI events detected. When an employee visits an unknown AI tool, the extension logs a SHADOW_AI_DISCOVERED event.
            </div>
          ) : (
            initialShadowEvents.map((event) => (
              <div key={event.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle size={16} className="text-amber-400" />
                  <div>
                    <p className="font-medium text-slate-200">{event.destination}</p>
                    <p className="text-xs text-slate-500">{event.domain} · {event.employeeId} · {event.organizationName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskColor(event.riskLevel)}`}>
                    {event.riskLevel}
                  </span>
                  <span className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "models" && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Modality</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Discovered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {initialModels.map((model) => (
                <tr key={model.id}>
                  <td className="px-4 py-3 font-medium text-slate-200">{model.name}</td>
                  <td className="px-4 py-3 text-slate-400">{model.providerName}</td>
                  <td className="px-4 py-3 text-slate-400">{model.modality}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${riskColor(model.riskLevel)}`}>
                      {model.riskLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={model.approved ? "text-lime" : "text-amber-300"}>
                      {model.approved ? "Approved" : "Review"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{new Date(model.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "scans" && (
        <div className="space-y-3">
          {initialScans.length === 0 ? (
            <div className="card flex items-center gap-3 p-6 text-slate-400">
              <Search size={20} />
              No shadow scans have been run yet.
            </div>
          ) : (
            initialScans.map((scan) => (
              <div key={scan.id} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                  <Search size={16} className="text-cyan" />
                  <div>
                    <p className="font-medium text-slate-200">{scan.scanType} Scan</p>
                    <p className="text-xs text-slate-500">{scan.organizationName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span>{scan.providerCount} providers</span>
                  <span>{scan.modelCount} models</span>
                  <span>{scan.findingCount} findings</span>
                  <span>{scan.status}</span>
                  <span className="text-xs text-slate-500">{new Date(scan.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
