import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  FlaskConical,
  Database,
  Lock,
  Server,
  Bug,
  CheckCircle2,
  ArrowRight,
  Activity,
  Eye,
  KeyRound,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Trust Center | SoterAI Security",
  description:
    "SoterAI trust center: live test status, data handling, security controls, deployment model, and responsible disclosure. OWASP LLM Top 10 aligned AI security command layer with transparent scope limitations.",
  alternates: { canonical: "/trust" },
  openGraph: {
    title: "Trust Center | SoterAI",
    description:
      "Test status, data handling, security controls, deployment model, and responsible disclosure — transparent AI security aligned to OWASP LLM Top 10.",
  },
};

const testStatus = [
  { label: "Adversarial battery", value: "101 / 101", note: "Comprehensive attack scenarios across 40+ services" },
  { label: "Garak-style benchmark", value: "97 / 97", note: "F1 = 1.0000, 0 / 25 false positives" },
  { label: "Unit + integration suites", value: "60+ files", note: "Guard, agent-firewall, auth, billing, retention" },
  { label: "E2E guard scenarios", value: "Playwright", note: "Real attack flows against a live build" },
];

const dataHandling = [
  "Guard analysis runs inline; request text is evaluated against detection rules and not used to train models.",
  "Sensitive values (PII, secrets) are redacted before logs are persisted — original text is not stored on redaction paths.",
  "Audit logs and reports are scoped per project and per organization with row-level ownership checks on every read.",
  "Data retention is configurable; enterprise workspaces can set automated purge windows for guard logs.",
  "Demo workspace data is synthetic and resettable via an authenticated, confirmation-gated script.",
];

const securityControls = [
  { title: "Defense-in-depth detection", desc: "Layered rules for prompt injection, jailbreaks, encoding/obfuscation, multilingual bypass, PII, secrets, and unsafe output." },
  { title: "Strict transport + headers", desc: "HSTS in production, strict Content-Security-Policy, X-Frame-Options DENY, nosniff, and a locked-down Permissions-Policy." },
  { title: "Authn & authz", desc: "Session-based auth with CSRF protection; per-project API keys are stored only as hashes, never in plaintext." },
  { title: "Signed audit exports", desc: "HMAC-signed JSONL/CSV exports so downstream SIEM and compliance pipelines can verify integrity." },
  { title: "Agent firewall", desc: "Tool-call authorization, agent passports, approvals, and escrow for autonomous workflows before risky actions execute." },
  { title: "Secrets hygiene", desc: "Secrets live in environment configuration (gitignored); the repo is scanned to keep keys and tokens out of source control." },
];

const deploymentModel = [
  { mode: "Managed SaaS", detail: "Hosted guard APIs, dashboard, and audit storage. Fastest path to production." },
  { mode: "Self-hosted (Docker)", detail: "Run the full stack in your own VPC for data residency and isolation requirements." },
  { mode: "Hybrid", detail: "Inline SDK detection at the edge with centralized policy, reporting, and audit." },
];

// Compact, honest posture signals shown in the hero status board.
const posture = [
  { label: "Adversarial benchmark", value: "F1 = 1.0000", meter: 100, tone: "cyan" as const },
  { label: "False-positive rate", value: "0 / 25 safe inputs", meter: 100, tone: "lime" as const },
  { label: "OWASP LLM Top 10", value: "Aligned coverage", meter: 90, tone: "cyan" as const },
];

const guarantees = [
  { Icon: Eye, label: "PII redacted before logging" },
  { Icon: KeyRound, label: "No raw secret storage" },
  { Icon: ShieldCheck, label: "Per-project row-level isolation" },
];

export default function TrustPage() {
  return (
    <main>
      {/* ── Futuristic hero ───────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-[radial-gradient(ellipse_at_top,rgba(49,215,200,0.12),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.6),rgba(2,6,23,0))] py-16 sm:py-20">
        <div className="pointer-events-none absolute inset-0 -z-10 grid-fade-anim opacity-50" />
        <div className="pointer-events-none absolute -right-40 -top-40 -z-10 h-[460px] w-[460px] rounded-full bg-cyan/10 blur-[120px]" />

        <div className="container-page grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-xs font-semibold text-cyan">
              <ShieldCheck size={14} aria-hidden="true" />
              Trust Center · transparent by design
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
              Security you can{" "}
              <span className="bg-gradient-to-r from-cyan to-lime bg-clip-text text-transparent">verify</span>,
              not just trust.
            </h1>
            <div className="mt-6 max-w-2xl space-y-4 leading-7 text-slate-400">
              <p>
                SoterAI is an OWASP LLM Top 10 aligned AI security command layer focused on risk reduction for
                chatbots, RAG apps, and AI agents. This page documents what we test, how we handle data, the controls
                we run, how you can deploy us, and how to report a vulnerability.
              </p>
              <p>
                We do not claim complete protection or certification. Customers remain responsible for secure design,
                access control, monitoring, incident response, and human oversight.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/benchmarks" className="button-primary gap-2">
                View the benchmark <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/status" className="button-secondary gap-2">
                Live system status
              </Link>
            </div>
          </div>

          {/* Posture status board */}
          <div className="card animate-pulse-glow overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3.5">
              <p className="font-mono text-xs text-slate-400">soterai · security posture</p>
              <span className="flex items-center gap-2 rounded-md border border-lime/30 bg-lime/10 px-2.5 py-1 text-[11px] font-bold text-lime">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lime opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-lime" />
                </span>
                OPERATIONAL
              </span>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {posture.map((p) => (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{p.label}</span>
                    <span className={`font-mono font-semibold ${p.tone === "lime" ? "text-lime" : "text-cyan"}`}>
                      {p.value}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${p.tone === "lime" ? "bg-lime" : "bg-cyan"} transition-all duration-700`}
                      style={{ width: `${p.meter}%` }}
                    />
                  </div>
                </div>
              ))}

              <div className="grid gap-2 border-t border-slate-800 pt-4">
                {guarantees.map((g) => (
                  <div key={g.label} className="flex items-center gap-2.5 text-sm text-slate-300">
                    <g.Icon size={16} className="shrink-0 text-cyan" aria-hidden="true" />
                    {g.label}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-slate-800 bg-slate-950/60 px-5 py-3 font-mono text-[11px] text-slate-500">
              <Activity size={12} className="text-cyan" aria-hidden="true" />
              Honest scope · self-authored evidence · independent audit welcomed
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-16">
        {/* Test status */}
        <section>
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <FlaskConical className="text-cyan" size={20} aria-hidden="true" />
            </span>
            Test status
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Self-authored regression and adversarial coverage. Independent third-party auditing is recommended and welcomed.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {testStatus.map((t) => (
              <div key={t.label} className="card p-5 transition hover:border-cyan/40">
                <div className="text-3xl font-black text-cyan">{t.value}</div>
                <p className="mt-2 text-sm font-medium text-slate-200">{t.label}</p>
                <p className="mt-1 text-xs text-slate-500">{t.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Full benchmark data:{" "}
            <Link href="/benchmarks" className="text-cyan underline underline-offset-2 hover:text-cyan/80">
              /benchmarks
            </Link>{" "}
            · live system status:{" "}
            <Link href="/status" className="text-cyan underline underline-offset-2 hover:text-cyan/80">
              /status
            </Link>
          </p>
        </section>

        {/* Data handling */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <Database className="text-cyan" size={20} aria-hidden="true" />
            </span>
            Data handling
          </h2>
          <ul className="mt-6 space-y-3">
            {dataHandling.map((d) => (
              <li key={d} className="flex gap-3 rounded-lg border border-slate-800 bg-panel/40 p-4 text-sm leading-6 text-slate-300">
                <CheckCircle2 className="mt-0.5 shrink-0 text-lime" size={18} aria-hidden="true" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            See also our{" "}
            <Link href="/privacy" className="text-cyan underline underline-offset-2 hover:text-cyan/80">privacy policy</Link>,{" "}
            <Link href="/subprocessors" className="text-cyan underline underline-offset-2 hover:text-cyan/80">subprocessors</Link>, and{" "}
            <Link href="/data-retention" className="text-cyan underline underline-offset-2 hover:text-cyan/80">data retention</Link>.
          </p>
        </section>

        {/* Security controls */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <Lock className="text-cyan" size={20} aria-hidden="true" />
            </span>
            Security controls
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {securityControls.map((c) => (
              <div key={c.title} className="card p-5 transition hover:border-cyan/40">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="shrink-0 text-cyan" size={18} aria-hidden="true" />
                  <h3 className="font-semibold">{c.title}</h3>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Control details and posture:{" "}
            <Link href="/security" className="text-cyan underline underline-offset-2 hover:text-cyan/80">/security</Link>{" "}
            ·{" "}
            <Link href="/compliance" className="text-cyan underline underline-offset-2 hover:text-cyan/80">/compliance</Link>
          </p>
        </section>

        {/* Deployment model */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg border border-cyan/20 bg-cyan/10 p-2">
              <Server className="text-cyan" size={20} aria-hidden="true" />
            </span>
            Deployment model
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {deploymentModel.map((d) => (
              <div key={d.mode} className="card p-5 transition hover:border-cyan/40">
                <h3 className="font-semibold text-slate-100">{d.mode}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{d.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Responsible disclosure */}
        <section className="mt-16">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-2">
              <Bug className="text-amber-300" size={20} aria-hidden="true" />
            </span>
            Responsible disclosure
          </h2>
          <div className="card mt-6 border-amber-400/20 p-6">
            <p className="text-sm leading-7 text-slate-400">
              Report suspected vulnerabilities to the security contact listed in your enterprise agreement or deployment
              runbook. Include affected URLs, impact, reproduction steps, and whether any data was accessed. Only test
              systems you own or are authorized to assess — do not access, modify, delete, or exfiltrate data that is not
              yours.
            </p>
            <Link
              href="/responsible-disclosure"
              className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-cyan hover:text-cyan/80"
            >
              Read the full disclosure policy <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16">
          <div className="relative overflow-hidden rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Security questions before you ship?</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Try the live playground, review the benchmark, or talk to us about self-hosting.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/playground" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
                Try the playground <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <Link href="/contact-sales" className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink">
                Talk to us
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
