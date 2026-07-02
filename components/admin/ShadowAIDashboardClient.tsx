"use client";

import { useState, useCallback } from "react";
import { Eye, Shield, ShieldOff, AlertTriangle, Globe, Clock, Users, Filter, ExternalLink } from "lucide-react";

interface DiscoveredDestination {
  domain: string;
  destination: string;
  riskLevel: string;
  organizations: string[];
  departments: string[];
  employees: string[];
  firstSeen: string;
  lastSeen: string;
  eventCount: number;
  isKnown: boolean;
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
  organizations: Array<{ id: string; name: string }>;
  initialDestinations: DiscoveredDestination[];
  initialEvents: ShadowEvent[];
}

const RISK_STYLES: Record<string, string> = {
  low: "border-lime/30 bg-lime/10 text-lime",
  medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  high: "border-red-500/30 bg-red-500/10 text-red-400",
  critical: "border-red-600/40 bg-red-600/15 text-red-300",
};

export function ShadowAIDashboardClient({ organizations, initialDestinations, initialEvents }: Props) {
  const [destinations, setDestinations] = useState(initialDestinations);
  const [events, setEvents] = useState(initialEvents);
  const [organizationId, setOrganizationId] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionResult, setActionResult] = useState<{ domain: string; action: string } | null>(null);

  const filteredDestinations = destinations.filter((d) => {
    if (filterRisk && d.riskLevel !== filterRisk) return false;
    return true;
  });

  const unknownDestinations = filteredDestinations.filter((d) => !d.isKnown);
  const knownDestinations = filteredDestinations.filter((d) => d.isKnown);

  const fetchDiscovery = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (organizationId) params.set("organizationId", organizationId);
      const res = await fetch(`/api/admin/shadow-ai/discovery?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDestinations(data.destinations ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [organizationId]);

  const takeAction = useCallback(async (domain: string, action: string) => {
    try {
      const res = await fetch("/api/admin/shadow-ai/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: organizations[0]?.id ?? "", domain, action }),
      });
      if (res.ok) {
        setActionResult({ domain, action });
        setTimeout(() => setActionResult(null), 3000);
        await fetchDiscovery();
      }
    } catch { /* ignore */ }
  }, [organizationId, organizations, fetchDiscovery]);

  return (
    <div>
      {actionResult && (
        <div className="mb-4 rounded-lg border border-lime/30 bg-lime/10 p-3 text-sm text-lime">
          Action applied: {actionResult.action} on {actionResult.domain}
        </div>
      )}

      <label className="mb-4 block max-w-md text-sm text-slate-300">
        Organization
        <select className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
          <option value="">All organizations</option>
          {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-slate-500" />
        <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-300" value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
          <option value="">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button className="button-primary text-xs" onClick={fetchDiscovery} disabled={loading}>
          {loading ? "Scanning..." : "Refresh Discovery"}
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-black text-cyan">{filteredDestinations.length}</p>
          <p className="mt-1 text-xs text-slate-400">Total discovered</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-black text-amber-300">{unknownDestinations.length}</p>
          <p className="mt-1 text-xs text-slate-400">Unknown AI tools</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-black text-lime">{knownDestinations.length}</p>
          <p className="mt-1 text-xs text-slate-400">Known AI services</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-black text-slate-200">{events.length}</p>
          <p className="mt-1 text-xs text-slate-400">Discovery events</p>
        </div>
      </div>

      {/* Unknown destinations */}
      {unknownDestinations.length > 0 && (
        <section className="mb-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-amber-300">
            <AlertTriangle size={18} /> Unknown AI Destinations ({unknownDestinations.length})
          </h2>
          <p className="mt-1 text-xs text-slate-400">These domains were discovered by the extension but are not in the known AI provider list.</p>
          <div className="mt-3 space-y-2">
            {unknownDestinations.map((d) => (
              <div key={d.domain} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-amber-300" />
                    <span className="font-medium text-slate-200">{d.destination}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${RISK_STYLES[d.riskLevel] ?? RISK_STYLES.medium}`}>{d.riskLevel}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{d.domain}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {d.departments.length > 0 && <span className="flex items-center gap-1"><Users size={10} /> {d.departments.join(", ")}</span>}
                    <span className="flex items-center gap-1"><Clock size={10} /> First: {new Date(d.firstSeen).toLocaleDateString()}</span>
                    <span className="flex items-center gap-1"><Clock size={10} /> Last: {new Date(d.lastSeen).toLocaleDateString()}</span>
                    <span>{d.eventCount} events</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button className="rounded bg-lime/10 px-2 py-1 text-[10px] font-bold text-lime hover:bg-lime/20" onClick={() => takeAction(d.domain, "approve")}>Approve</button>
                  <button className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20" onClick={() => takeAction(d.domain, "block")}>Block</button>
                  <button className="rounded bg-cyan/10 px-2 py-1 text-[10px] font-bold text-cyan hover:bg-cyan/20" onClick={() => takeAction(d.domain, "classify_public_ai")}>Public AI</button>
                  <button className="rounded bg-cyan/10 px-2 py-1 text-[10px] font-bold text-cyan hover:bg-cyan/20" onClick={() => takeAction(d.domain, "classify_enterprise_ai")}>Enterprise</button>
                  <button className="rounded bg-cyan/10 px-2 py-1 text-[10px] font-bold text-cyan hover:bg-cyan/20" onClick={() => takeAction(d.domain, "classify_browser_coding")}>Browser Coding</button>
                  <button className="rounded bg-slate-700/50 px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-700" onClick={() => takeAction(d.domain, "ignore")}>Ignore</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Known destinations */}
      <section>
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-300">
          <Shield size={18} className="text-cyan" /> Known AI Destinations ({knownDestinations.length})
        </h2>
        <div className="mt-3 space-y-2">
          {knownDestinations.map((d) => (
            <div key={d.domain} className="card flex items-center justify-between p-4">
              <div>
                <span className="font-medium text-slate-200">{d.destination}</span>
                <span className={`ml-2 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${RISK_STYLES[d.riskLevel] ?? RISK_STYLES.medium}`}>{d.riskLevel}</span>
                <p className="mt-1 text-xs text-slate-500">{d.domain} · {d.eventCount} events</p>
              </div>
              <div className="flex gap-1">
                <button className="rounded bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400 hover:bg-red-500/20" onClick={() => takeAction(d.domain, "block")}>Block</button>
              </div>
            </div>
          ))}
          {knownDestinations.length === 0 && (
            <div className="card p-6 text-center text-slate-500">No known AI destinations in discovery data.</div>
          )}
        </div>
      </section>

      {/* Recent events */}
      {events.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-300">
            <Eye size={18} /> Recent Discovery Events ({events.length})
          </h2>
          <div className="mt-3 space-y-1">
            {events.slice(0, 50).map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-panel/50 px-4 py-2.5 text-sm">
                <div>
                  <span className="text-slate-200">{e.destination}</span>
                  <span className="ml-2 text-xs text-slate-500">{e.domain}</span>
                  {e.employeeId !== "—" && <span className="ml-2 text-xs text-slate-600">by {e.employeeId}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${RISK_STYLES[e.riskLevel] ?? RISK_STYLES.medium}`}>{e.riskLevel}</span>
                  <span className="text-xs text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
