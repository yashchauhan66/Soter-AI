import type { Metadata } from "next";
import { Activity, CheckCircle2, AlertTriangle, Boxes, History } from "lucide-react";
import { db } from "@/lib/db";

export const metadata: Metadata = {
  title: "Service Status | SoterAI",
  description:
    "SoterAI real-time service status and incident history. Check API, Guard API, Dashboard, and worker availability.",
  alternates: { canonical: "/status" },
};

export const dynamic = "force-dynamic";

const components = ["API", "Guard API", "Dashboard", "Webhook worker", "Report worker", "Billing"];
const integrations = [
  { name: "n8n Community Node", status: "npm-ready" },
  { name: "Dify Plugin", status: "Ready for Marketplace PR" },
  { name: "Zapier App", status: "Ready for Review" },
  { name: "Make.com App", status: "Ready for Review" },
  { name: "Botpress Integration", status: "Ready for Hub Submission" },
  { name: "Flowise Nodes", status: "Local Installable" },
  { name: "Langflow Components", status: "Local Installable" },
  { name: "Voiceflow Templates", status: "API Templates" },
];

export default async function StatusPage() {
  const incidents = await db.incident.findMany({
    where: { public: true },
    include: { updates: { where: { public: true }, orderBy: { createdAt: "desc" } } },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const active = incidents.filter((i) => i.status !== "RESOLVED");
  const allOperational = active.length === 0;

  return (
    <main>
      {/* ── Live status hero ──────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(49,215,200,0.1),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0))] py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 grid-fade-anim opacity-40" />
        <div className="container-page">
          <p className="eyebrow">Service status</p>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-3xl font-bold sm:text-4xl">
              {allOperational ? "All published systems operational" : "Service advisory in effect"}
            </h1>
            <span
              className={`inline-flex w-fit items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${
                allOperational
                  ? "border-lime/30 bg-lime/10 text-lime"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-300"
              }`}
            >
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${
                    allOperational ? "bg-lime" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    allOperational ? "bg-lime" : "bg-amber-400"
                  }`}
                />
              </span>
              {allOperational ? "OPERATIONAL" : `${active.length} ACTIVE`}
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-slate-400">
            Only public-safe operational information appears here. Customer logs and internal security details are never
            published.
          </p>
        </div>
      </section>

      <div className="container-page py-14">
        {/* Components */}
        <section>
          <h2 className="flex items-center gap-3 text-xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <Activity className="text-cyan" size={18} aria-hidden="true" />
            </span>
            System components
          </h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {components.map((component) => {
              const advisory = active.some((i) => i.affectedComponents.includes(component));
              return (
                <div
                  key={component}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-panel/50 px-4 py-3.5"
                >
                  <span className="font-medium text-slate-200">{component}</span>
                  <span
                    className={`flex items-center gap-2 text-sm font-semibold ${
                      advisory ? "text-amber-300" : "text-lime"
                    }`}
                  >
                    {advisory ? <AlertTriangle size={15} /> : <CheckCircle2 size={15} />}
                    {advisory ? "Advisory" : "Operational"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Integration readiness */}
        <section className="mt-14">
          <h2 className="flex items-center gap-3 text-xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <Boxes className="text-cyan" size={18} aria-hidden="true" />
            </span>
            Integration status
          </h2>
          <p className="mt-2 text-sm text-slate-400">Marketplace readiness for SoterAI platform integrations.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {integrations.map((i) => (
              <div
                key={i.name}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-panel/50 px-4 py-3.5"
              >
                <span className="text-slate-200">{i.name}</span>
                <span className="rounded-full border border-cyan/20 bg-cyan/10 px-2.5 py-1 text-xs font-medium text-cyan">
                  {i.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Incident history */}
        <section className="mt-14">
          <h2 className="flex items-center gap-3 text-xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <History className="text-cyan" size={18} aria-hidden="true" />
            </span>
            Incident history
          </h2>
          <div className="mt-5 space-y-4">
            {incidents.length ? (
              incidents.map((incident) => (
                <article className="card p-5" key={incident.id}>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">{incident.title}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        incident.status === "RESOLVED"
                          ? "border border-lime/30 bg-lime/10 text-lime"
                          : "border border-amber-400/30 bg-amber-400/10 text-amber-300"
                      }`}
                    >
                      {incident.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{incident.summary}</p>
                  {incident.updates.map((update) => (
                    <p className="mt-3 border-t border-slate-800 pt-3 text-sm text-slate-400" key={update.id}>
                      <span className="font-mono text-xs text-slate-500">
                        {update.createdAt.toLocaleString()}
                      </span>{" "}
                      — {update.message}
                    </p>
                  ))}
                </article>
              ))
            ) : (
              <div className="card flex items-center gap-3 p-6 text-slate-400">
                <CheckCircle2 className="text-lime" size={20} aria-hidden="true" />
                No public incidents reported.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
