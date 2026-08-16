"use client";

import { useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { StatusBadge, EmptyRow } from "@/components/dashboard/MetricCard";

interface EventRow {
  id: string;
  eventType: string;
  severity: string;
  action: string;
  riskTypes: string[];
  domain: string | null;
  createdAt: string;
}

const SEVERITIES = ["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export function ExtensionActivityPanel({ events }: { events: EventRow[] }) {
  const [severity, setSeverity] = useState("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (severity !== "ALL" && e.severity.toUpperCase() !== severity) return false;
      if (!q) return true;
      return (
        e.eventType.toLowerCase().includes(q) ||
        (e.domain ?? "").toLowerCase().includes(q) ||
        e.riskTypes.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [events, severity, query]);

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-cyan" />
          <h2 className="text-lg font-semibold">Live activity</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search type, tool, risk…"
            className="input !w-56 !px-3 !py-1.5 text-sm"
          />
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="input !w-36 !px-3 !py-1.5 text-sm"
          >
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s === "ALL" ? "All severities" : s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="mt-1 text-sm text-slate-200">
        Recent scans and blocked leaks reported by enrolled browsers. No raw sensitive text is ever stored.
      </p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-300">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">AI tool</th>
              <th className="py-2 pr-4">Risk types</th>
              <th className="py-2 pr-4">Severity</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6} message="No extension activity yet." />
            ) : (
              filtered.map((e) => (
                <tr key={e.id} className="border-b border-slate-900 text-slate-300">
                  <td className="py-2 pr-4 text-slate-200">{new Date(e.createdAt).toLocaleString()}</td>
                  <td className="py-2 pr-4 text-xs text-slate-300">{e.eventType.replace(/^EXTENSION_/, "").replace(/_/g, " ")}</td>
                  <td className="py-2 pr-4 text-slate-200">{e.domain ?? "—"}</td>
                  <td className="py-2 pr-4 text-xs text-slate-200">{e.riskTypes.slice(0, 3).join(", ") || "—"}</td>
                  <td className="py-2 pr-4"><StatusBadge value={e.severity.toUpperCase()} /></td>
                  <td className="py-2 pr-4"><StatusBadge value={e.action.toUpperCase()} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
