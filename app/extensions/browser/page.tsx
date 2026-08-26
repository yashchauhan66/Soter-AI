import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Chrome,
  Eye,
  EyeOff,
  Globe,
  Lock,
  MonitorSmartphone,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "SoterAI Browser Guard — Secure AI Browsing for Chrome & Edge",
  description:
    "Install SoterAI Browser Guard for Chrome and Microsoft Edge. Real-time prompt scanning, secret & PII redaction, and organization policy enforcement across 20+ AI tools.",
  alternates: { canonical: "/extensions/browser" },
  openGraph: {
    title: "SoterAI Browser Guard — Secure AI Browsing",
    description:
      "Real-time AI protection in your browser. Scan prompts, redact secrets and PII, and enforce org policy across ChatGPT, Claude, Gemini, Copilot, and more.",
    url: "/extensions/browser",
    type: "website",
  },
};

const CAPABILITIES = [
  {
    icon: ScanSearch,
    title: "Real-time prompt scanning",
    copy: "Every prompt is inspected locally for injection, jailbreaks, and data leakage before it reaches the AI model.",
  },
  {
    icon: EyeOff,
    title: "Automatic redaction",
    copy: "Secrets, API keys, and PII like Aadhaar and PAN are redacted in-place, with a safe rewrite you can copy.",
  },
  {
    icon: Lock,
    title: "Policy enforcement",
    copy: "Organization policies are cached locally and enforced even offline, with approval workflows for risky sends.",
  },
  {
    icon: Eye,
    title: "Shadow AI discovery",
    copy: "Detect unapproved AI tools and track data lineage so you always know where sensitive context flows.",
  },
];

const PRIVACY_PROOF = [
  { label: "Raw prompt to SoterAI", value: "No by default" },
  { label: "Scanning location", value: "In your browser first" },
  { label: "Stored locally", value: "Redacted preview, safe rewrite, hashes, policy cache" },
  { label: "Backend audit event", value: "Metadata, decision, risk score, redacted preview" },
];

export default function BrowserExtensionPage() {
  return (
    <main className="bg-[#080f19]">
      {/* ── Hero ── */}
      <section className="border-b border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-300" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-slate-300">SoterAI</Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-300">Browser Guard</span>
          </nav>

          <div className="mt-8 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span className="border border-cyan/30 bg-cyan/10 px-2 py-1 text-cyan">Local-first scanning</span>
              <span className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Chrome & Edge</span>
              <span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">Free to start</span>
            </div>
            <h1 className="mt-5 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
              Guard every AI conversation in your browser
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              SoterAI Browser Guard protects you while you use ChatGPT, Claude, Gemini, Copilot, and 20+ other
              AI tools. Prompts are scanned locally for injection and data leakage, secrets and PII are redacted
              before they leave your machine, and your organization's policy is enforced — even offline.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link href="/extensions/browser/chrome" className="button-primary gap-2 text-sm">
                <Chrome className="h-4 w-4" aria-hidden="true" /> Install for Chrome <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/extensions/browser/edge" className="button-secondary gap-2 text-sm">
                <Globe className="h-4 w-4" aria-hidden="true" /> Install for Microsoft Edge
              </Link>
            </div>
          </div>

          <div className="mt-10 grid border border-slate-800 bg-[#08101a] sm:grid-cols-3">
            <div className="flex items-start gap-3 border-b border-slate-800 p-4 sm:border-b-0 sm:border-r">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">20+ AI tools covered</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">ChatGPT, Claude, Gemini, Copilot & more</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-slate-800 p-4 sm:border-b-0 sm:border-r">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">Raw prompts stay local</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">No raw text sent to SoterAI by default</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4">
              <MonitorSmartphone className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">Side panel control plane</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Scan history, policy status, self-test</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Choose browser ── */}
      <section className="container-page py-14 sm:py-20">
        <div className="max-w-3xl">
          <p className="eyebrow">Pick your browser</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">One extension, both browsers</h2>
          <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
            The same guarded experience ships for Chrome and Microsoft Edge. Choose your browser to open the
            install guide and store listing.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Link
            href="/extensions/browser/chrome"
            className="group flex flex-col rounded-2xl border border-slate-800 bg-[#0d1724] p-6 transition-all duration-200 hover:border-cyan/45 hover:shadow-lg hover:shadow-cyan/5"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                <Chrome className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan">Google Chrome</h3>
                <p className="text-xs text-slate-300">Chrome Web Store</p>
              </div>
            </div>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">
              Install from the Chrome Web Store or load the unpacked extension for enterprise deployment.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              Install for Chrome <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>

          <Link
            href="/extensions/browser/edge"
            className="group flex flex-col rounded-2xl border border-slate-800 bg-[#0d1724] p-6 transition-all duration-200 hover:border-cyan/45 hover:shadow-lg hover:shadow-cyan/5"
          >
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan/10 text-cyan">
                <Globe className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-lg font-semibold text-white group-hover:text-cyan">Microsoft Edge</h3>
                <p className="text-xs text-slate-300">Edge Add-ons</p>
              </div>
            </div>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-300">
              Install from Edge Add-ons or load the unpacked extension for managed workstations.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              Install for Edge <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {/* ── Capabilities ── */}
      <section className="border-y border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">What you get</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Enterprise protection while you browse</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
              Protection activates the moment you land on a supported AI tool. No configuration required for local scanning.
            </p>
          </div>
          <div className="mt-8 grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="bg-[#0d1724] p-5">
                  <Icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-slate-200">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Privacy proof ── */}
      <section className="container-page py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">Privacy model</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">What leaves your browser?</h2>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              Prompt scanning happens in the browser first, and extension storage avoids keeping raw prompt text
              by default. This is the same contract surfaced inside the extension's side panel.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/privacy" className="button-secondary gap-2 text-sm">
                Read privacy policy <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0d1724] p-6">
            <dl className="divide-y divide-slate-800">
              {PRIVACY_PROOF.map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                  <dt className="text-sm text-slate-300">{row.label}</dt>
                  <dd className="max-w-[55%] text-right text-sm font-semibold text-white">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ── Cross-surface CTA ── */}
      <section className="border-t border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-16">
          <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-cyan" aria-hidden="true" />
                <h2 className="text-xl font-bold text-white sm:text-2xl">Protect every surface, not just the browser</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Pair Browser Guard with IDE Guard, workflow automation, and the REST API for complete coverage.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/extensions/ide" className="button-secondary gap-2 text-sm">
                IDE Guard <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/integrations" className="button-secondary gap-2 text-sm">
                <Workflow className="h-4 w-4" aria-hidden="true" /> Integrations
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2 text-sm">
                REST API
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}