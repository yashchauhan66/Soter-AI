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

export default function TrustPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Trust</p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">SoterAI Trust Center</h1>
      <div className="mt-6 max-w-3xl space-y-4 leading-7 text-slate-400">
        <p>
          SoterAI is an OWASP LLM Top 10 aligned AI security command layer focused on risk reduction for chatbots, RAG
          apps, and AI agents. This page documents what we test, how we handle data, the controls we run, how you can
          deploy us, and how to report a vulnerability.
        </p>
        <p>
          We do not claim complete protection or certification. Customers remain responsible for secure design, access
          control, monitoring, incident response, and human oversight.
        </p>
      </div>

      {/* Test status */}
      <section className="mt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <FlaskConical className="text-cyan" size={24} aria-hidden="true" /> Test status
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Self-authored regression and adversarial coverage. Independent third-party auditing is recommended and welcomed.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {testStatus.map((t) => (
            <div key={t.label} className="card p-5">
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
      <section className="mt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <Database className="text-cyan" size={24} aria-hidden="true" /> Data handling
        </h2>
        <ul className="mt-6 space-y-3">
          {dataHandling.map((d) => (
            <li key={d} className="flex gap-3 text-sm leading-6 text-slate-400">
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
      <section className="mt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <Lock className="text-cyan" size={24} aria-hidden="true" /> Security controls
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {securityControls.map((c) => (
            <div key={c.title} className="card p-5">
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
      <section className="mt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <Server className="text-cyan" size={24} aria-hidden="true" /> Deployment model
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {deploymentModel.map((d) => (
            <div key={d.mode} className="card p-5">
              <h3 className="font-semibold text-slate-100">{d.mode}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{d.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="mt-14">
        <h2 className="flex items-center gap-3 text-2xl font-bold">
          <Bug className="text-cyan" size={24} aria-hidden="true" /> Responsible disclosure
        </h2>
        <div className="mt-6 card border-amber-400/20 p-6">
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
        <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
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
    </main>
  );
}
