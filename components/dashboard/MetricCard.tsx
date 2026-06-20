/** Shared dashboard UI components — MetricCard, StatusBadge, and PayloadViewer */

// ── MetricCard ──────────────────────────────────────────────────────────
export function MetricCard({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: string | number;
  tone?: "yellow" | "red" | "gray" | "cyan" | "blue" | "green";
}) {
  const tones: Record<string, string> = {
    yellow: "text-yellow-300",
    red: "text-red-300",
    gray: "text-slate-300",
    cyan: "text-cyan",
    blue: "text-blue-300",
    green: "text-emerald-300",
  };
  return (
    <section className="card p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone] ?? "text-slate-300"}`}>{value}</p>
    </section>
  );
}

// ── StatusBadge ─────────────────────────────────────────────────────────
const BADGE_TONES: Record<string, string> = {
  // Decision tones
  ALLOW: "bg-emerald-400/10 text-emerald-300",
  ALLOW_WITH_REDACTION: "bg-blue-400/10 text-blue-300",
  REDACT: "bg-blue-400/10 text-blue-300",
  REWRITE: "bg-blue-400/10 text-blue-300",
  ASK_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  REVIEW: "bg-blue-400/10 text-blue-300",
  BLOCK: "bg-red-400/10 text-red-300",
  DENIED: "bg-red-400/10 text-red-300",
  DENY: "bg-red-400/10 text-red-300",
  TAKEOVER_REQUIRED: "bg-orange-400/10 text-orange-300",
  // Status tones
  ACTIVE: "bg-emerald-400/10 text-emerald-300",
  PASS: "bg-emerald-400/10 text-emerald-300",
  QUARANTINED: "bg-red-400/10 text-red-300",
  NEEDS_REVIEW: "bg-yellow-400/10 text-yellow-300",
  PENDING: "bg-yellow-400/10 text-yellow-300",
  APPROVED: "bg-emerald-400/10 text-emerald-300",
  EXECUTED: "bg-cyan/10 text-cyan",
  CANCELLED: "bg-slate-500/10 text-slate-300",
  EXPIRED: "bg-slate-500/10 text-slate-300",
  EXPORTED: "bg-cyan/10 text-cyan",
  DRAFT: "bg-slate-600/20 text-slate-300",
  GENERATED: "bg-emerald-400/10 text-emerald-300",
  RESOLVED: "bg-blue-400/10 text-blue-300",
  FAIL: "bg-red-400/10 text-red-300",
  WARNING: "bg-yellow-400/10 text-yellow-300",
  DISABLED: "bg-slate-700 text-slate-400",
  DELETED: "bg-slate-700 text-slate-400",
  SAFE_TO_EXECUTE: "bg-emerald-400/10 text-emerald-300",
  REQUIRE_APPROVAL: "bg-yellow-400/10 text-yellow-300",
  EDITED_AND_APPROVED: "bg-cyan/10 text-cyan",
  ALERT: "bg-yellow-400/10 text-yellow-300",
  // MCP drift
  PROMPT_INJECTION_DETECTED: "bg-red-400/10 text-red-300",
  CAPABILITY_ADDED: "bg-orange-400/10 text-orange-300",
  RISK_INCREASED: "bg-red-400/10 text-red-300",
  ENDPOINT_CHANGED: "bg-yellow-400/10 text-yellow-300",
  SCHEMA_CHANGED: "bg-blue-400/10 text-blue-300",
  DESCRIPTION_CHANGED: "bg-blue-400/10 text-blue-300",
  CAPABILITY_REMOVED: "bg-slate-700 text-slate-300",
};

export function StatusBadge({ value }: { value: string }) {
  const tone = BADGE_TONES[value] ?? "bg-slate-700 text-slate-300";
  return <span className={`rounded px-2 py-1 text-xs font-medium ${tone}`}>{value}</span>;
}

// ── RiskLevel ───────────────────────────────────────────────────────────
export function RiskLevel({ level }: { level: string }) {
  const tones: Record<string, string> = {
    LOW: "text-emerald-300",
    MEDIUM: "text-amber-300",
    HIGH: "text-orange-300",
    CRITICAL: "text-red-300",
  };
  return <span className={`text-xs font-bold ${tones[level] ?? "text-slate-400"}`}>{level}</span>;
}

// ── PayloadViewer ───────────────────────────────────────────────────────
export function PayloadViewer({
  title,
  value,
}: {
  title: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-slate-500">{title}</p>
      <pre className="mt-1 max-h-36 overflow-auto rounded bg-slate-950/70 p-2 text-xs text-slate-300">
        {value ?? "No data supplied."}
      </pre>
    </div>
  );
}

// ── EmptyRow (for table empty states) ───────────────────────────────────
export function EmptyRow({ colSpan, message }: { colSpan: number; message: string }) {
  return (
    <tr>
      <td className="py-8 text-center text-sm text-slate-500" colSpan={colSpan}>
        {message}
      </td>
    </tr>
  );
}

// ── SafeJson helper ─────────────────────────────────────────────────────
export function safeJson(value: unknown, fallback = "No data."): string {
  if (!value || (Array.isArray(value) && value.length === 0)) return fallback;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "Data could not be formatted.";
  }
}
