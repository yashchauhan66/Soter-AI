"use client";

import { useState } from "react";
import { History, Shield, Filter, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Organization } from "@prisma/client";

interface ExtensionEvent {
  id: string;
  organizationId: string;
  organizationName: string;
  eventType: string;
  severity: string;
  action: string;
  source: string;
  riskTypes: string[];
  employeeId: string;
  domain: string;
  policyVersion: string;
  browser: string;
  extensionVersion: string;
  redactedPreview: string | null;
  createdAt: string;
}

interface Props {
  organizations: Pick<Organization, "id" | "name">[];
  initialEvents: ExtensionEvent[];
}

export function ExtensionEventsClient({ organizations, initialEvents }: Props) {
  const [search, setSearch] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [selectedEventType, setSelectedEventType] = useState("all");
  const [selectedSeverity, setSelectedSeverity] = useState("all");
  const [showPreview, setShowPreview] = useState<string | null>(null);

  const eventTypes = Array.from(new Set(initialEvents.map((e) => e.eventType))).sort();
  const severities = Array.from(new Set(initialEvents.map((e) => e.severity))).sort();

  const filtered = initialEvents.filter((e) => {
    if (selectedOrg !== "all" && e.organizationId !== selectedOrg) return false;
    if (selectedEventType !== "all" && e.eventType !== selectedEventType) return false;
    if (selectedSeverity !== "all" && e.severity !== selectedSeverity) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.employeeId.toLowerCase().includes(q) && !e.domain.toLowerCase().includes(q) && !e.eventType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const severityColor = (s: string) => {
    switch (s.toUpperCase()) {
      case "CRITICAL": return "text-red-400 bg-red-500/10";
      case "HIGH": return "text-red-300 bg-red-500/10";
      case "MEDIUM": return "text-amber-300 bg-amber-500/10";
      case "LOW": return "text-cyan bg-cyan/10";
      default: return "text-slate-400 bg-slate-500/10";
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-bold">
          <History className="text-cyan" size={24} />
          Extension Events
        </h1>
        <p className="mt-1 text-sm text-slate-400">{initialEvents.length} total events</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-panel/50 p-4">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-slate-500" />
          <select
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
            value={selectedEventType}
            onChange={(e) => setSelectedEventType(e.target.value)}
          >
            <option value="all">All event types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <select
          className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200"
          value={selectedSeverity}
          onChange={(e) => setSelectedSeverity(e.target.value)}
        >
          <option value="all">All severities</option>
          {severities.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

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

        <div className="flex items-center gap-2">
          <Search size={16} className="text-slate-500" />
          <input
            className="rounded-md border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
            placeholder="Search employee, domain, type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="card flex items-center gap-3 p-6 text-slate-400">
            <Shield size={20} />
            No events match the current filters.
          </div>
        ) : (
          filtered.map((event) => (
            <div key={event.id} className="card overflow-hidden p-0">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${severityColor(event.severity)}`}>
                  {event.severity}
                </span>
                <span className="text-sm font-medium text-slate-200">{event.eventType}</span>
                <span className="text-xs text-slate-500">{event.employeeId}</span>
                <span className="text-xs text-slate-500">at {event.domain}</span>
                <span className="ml-auto text-xs text-slate-600">{new Date(event.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 px-4 py-2 text-xs text-slate-500">
                <span>Action: {event.action}</span>
                <span>Browser: {event.browser}</span>
                <span>Extension: v{event.extensionVersion}</span>
                <span>Policy: {event.policyVersion}</span>
                {event.riskTypes.length > 0 && (
                  <span>Data: {event.riskTypes.join(", ")}</span>
                )}
                {event.redactedPreview && (
                  <button
                    className="text-cyan hover:underline"
                    onClick={() => setShowPreview(showPreview === event.id ? null : event.id)}
                  >
                    {showPreview === event.id ? "Hide preview" : "Show preview"}
                  </button>
                )}
              </div>
              {showPreview === event.id && event.redactedPreview && (
                <pre className="border-t border-slate-800 bg-slate-950 p-4 text-xs text-slate-400">{event.redactedPreview}</pre>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
