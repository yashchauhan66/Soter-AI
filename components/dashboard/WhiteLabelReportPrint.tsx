"use client";

import { Printer } from "lucide-react";

interface Metrics {
  totalRequests: number;
  blockedRequests: number;
  redactedRequests: number;
  piiRedactions: number;
  secretsBlocked: number;
  unsafeBlocked: number;
  avgRiskScore: number;
}

interface Props {
  agency: { name: string; logoUrl: string | null; contactEmail: string | null; footer: string | null; brandColor: string };
  project: { name: string; clientName: string | null };
  period: { month: number; year: number };
  metrics: Metrics;
  topRiskTypes: { type: string; count: number }[];
  recommendations: string[];
}

const OWASP = [
  ["LLM01", "Prompt injection"],
  ["LLM02", "Sensitive information disclosure"],
  ["LLM05", "Improper output handling"],
  ["LLM10", "Unbounded consumption"],
];

export function WhiteLabelReportPrint(props: Props) {
  const { agency, project, period, metrics, topRiskTypes, recommendations } = props;
  const monthName = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(
    new Date(Date.UTC(period.year, period.month - 1, 1)),
  );

  return (
    <div className="mt-7 rounded-3xl border border-slate-800 bg-slate-100 p-8 text-slate-900 shadow-glow print:rounded-none print:border-0 print:bg-white print:p-0">
      <div className="flex justify-end print:hidden">
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
          <Printer size={16} /> Print / Save PDF
        </button>
      </div>

      <header className="mt-2 flex flex-wrap items-start justify-between gap-6 border-b-4 pb-6" style={{ borderColor: agency.brandColor }}>
        <div className="flex items-center gap-4">
          {agency.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agency.logoUrl} alt={agency.name} className="h-12 max-w-40 object-contain" />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-xl text-white" style={{ background: agency.brandColor }}>
              <span className="text-lg font-bold">{agency.name.slice(0, 1).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Prepared by</p>
            <p className="text-lg font-bold">{agency.name}</p>
            {agency.contactEmail && <p className="text-xs text-slate-500">{agency.contactEmail}</p>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-500">Security report</p>
          <p className="text-2xl font-black">{monthName}</p>
          <p className="text-sm text-slate-500">OWASP LLM Top 10 aligned</p>
        </div>
      </header>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-wider text-slate-500">Project</p>
        <h2 className="text-3xl font-bold">{project.name}</h2>
        {project.clientName && <p className="mt-1 text-sm text-slate-500">Client: {project.clientName}</p>}
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          ["Total requests", metrics.totalRequests],
          ["Blocked requests", metrics.blockedRequests],
          ["PII redactions", metrics.piiRedactions],
          ["Secrets prevented", metrics.secretsBlocked],
          ["Unsafe outputs blocked", metrics.unsafeBlocked],
          ["Average risk score", metrics.avgRiskScore],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-300 bg-white p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-black" style={{ color: agency.brandColor }}>{value}</p>
          </div>
        ))}
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-300 bg-white p-5">
          <h3 className="text-lg font-bold">Top risk types</h3>
          {topRiskTypes.length ? (
            <ul className="mt-4 space-y-2 text-sm">
              {topRiskTypes.map((item) => (
                <li key={item.type} className="flex justify-between rounded-lg bg-slate-50 p-3">
                  <span>{item.type.replaceAll("_", " ")}</span>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No material risks recorded this month.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-300 bg-white p-5">
          <h3 className="text-lg font-bold">Recommendations</h3>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm leading-6 text-slate-700">
            {recommendations.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="mt-8 rounded-xl border border-slate-300 bg-white p-5">
        <h3 className="text-lg font-bold">OWASP LLM Top 10 alignment</h3>
        <p className="mt-2 text-sm text-slate-600">CyberRakshak Guard Phase 2 reduces risk for the categories below. Alignment supports defence in depth and is not a certification or claim of complete coverage.</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {OWASP.map(([id, label]) => (
            <li key={id} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm">
              <span className="rounded-md px-2 py-1 text-xs font-bold text-white" style={{ background: agency.brandColor }}>{id}</span>
              {label}
            </li>
          ))}
        </ul>
      </section>

      <footer className="mt-8 border-t pt-5 text-xs leading-6 text-slate-500" style={{ borderColor: agency.brandColor }}>
        {agency.footer ?? "This report summarises observed defensive activity for the period above. Pattern detection can produce false positives or false negatives. Use alongside secure development practices."}
      </footer>
    </div>
  );
}
