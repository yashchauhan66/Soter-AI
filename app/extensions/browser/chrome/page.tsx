import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Chrome,
  Download,
  Eye,
  EyeOff,
  Lock,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Install SoterAI for Chrome — AI Security Extension",
  description:
    "Install the SoterAI Browser Guard extension for Google Chrome. Real-time prompt scanning, secret & PII redaction, and organization policy enforcement across 20+ AI tools.",
  alternates: { canonical: "/extensions/browser/chrome" },
  openGraph: {
    title: "SoterAI for Chrome — AI Security Extension",
    description:
      "Guard every AI conversation in Chrome. Scan prompts, redact secrets and PII, and enforce org policy across ChatGPT, Claude, Gemini, and more.",
    url: "/extensions/browser/chrome",
    type: "website",
  },
};

const FEATURES = [
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

// The Chrome Web Store listing is not live yet -- there is no SoterAI listing URL
// anywhere in this repo, and the store flow ("Add to Chrome") cannot be step 1 of a
// working install until there is. These steps therefore describe both routes and lead
// with the one that works today, rather than sending a visitor to a search that
// returns nothing.
const INSTALL_STEPS = [
  {
    step: "1",
    title: "Get the extension",
    copy: "The Chrome Web Store listing is not live yet. Until it is, the manual install below takes about a minute and gives you the same v0.2.0 build.",
  },
  {
    step: "2",
    title: "Load it into Chrome",
    copy: "Open chrome://extensions, turn on Developer mode, then Load unpacked. Once the listing is live this becomes a single Add to Chrome click.",
  },
  {
    step: "3",
    title: "Pin the extension",
    copy: "Click the puzzle icon in the toolbar and pin SoterAI for one-click access to the side panel.",
  },
  {
    step: "4",
    title: "Visit an AI tool",
    copy: "Open ChatGPT, Claude, Gemini, or any supported AI tool. Protection activates automatically.",
  },
];

const ENTERPRISE_STEPS = [
  "Download the extension package from your SoterAI admin console.",
  "Open chrome://extensions in Chrome.",
  "Enable Developer mode (top right toggle).",
  "Click Load unpacked and select the extracted extension folder.",
  "Enroll with your organization code to receive policy.",
];

export default function ChromeExtensionPage() {
  return (
    <main className="bg-[#080f19]">
      {/* ── Hero ── */}
      <section className="border-b border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <nav className="flex items-center gap-2 text-xs font-medium text-slate-300" aria-label="Breadcrumb">
            <Link href="/" className="transition hover:text-slate-300">SoterAI</Link>
            <span aria-hidden="true">/</span>
            <Link href="/extensions/browser" className="transition hover:text-slate-300">Browser Guard</Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-300">Chrome</span>
          </nav>

          <div className="mt-8 flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-slate-700 bg-slate-900 text-cyan shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:h-24 sm:w-24">
              <Chrome className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">Web Store listing soon</span>
                <span className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">v0.2.0</span>
                <span className="border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 text-emerald-300">Free to start</span>
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-5xl">
                SoterAI for Chrome
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Install SoterAI Browser Guard in Google Chrome to get real-time protection while using ChatGPT,
                Claude, Gemini, and 20+ other AI tools. Prompts are scanned locally, secrets and PII are redacted,
                and your organization's policy is enforced — even offline.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="#install" className="button-primary gap-2 text-sm">
                  <Download className="h-4 w-4" aria-hidden="true" /> See install steps <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="#enterprise" className="button-secondary gap-2 text-sm">
                  Enterprise deployment
                </Link>
              </div>
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
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">No account for local scans</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">Enroll only when you need org policy</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── What you get ── */}
      <section className="container-page py-14 sm:py-20">
        <div className="max-w-3xl">
          <p className="eyebrow">What you get</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Enterprise protection while you browse</h2>
          <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
            Protection activates the moment you land on a supported AI tool. No configuration required for local scanning.
          </p>
        </div>
        <div className="mt-8 grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((item) => {
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
      </section>

      {/* ── Install steps ── */}
      <section id="install" className="scroll-mt-24 border-y border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Installation</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Up and running in under a minute</h2>
            <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
              Once the extension is loaded, protection activates automatically on supported AI tools. The
              Chrome Web Store listing is not live yet — the manual route below works today and installs the
              same build.
            </p>
          </div>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {INSTALL_STEPS.map((item) => (
              <li key={item.step} className="rounded-xl border border-slate-800 bg-[#0d1724] p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan/10 text-sm font-bold text-cyan">
                  {item.step}
                </span>
                <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">{item.copy}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Enterprise deployment ── */}
      <section id="enterprise" className="container-page scroll-mt-24 py-14 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <p className="eyebrow">Enterprise deployment</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">Managed workstations</h2>
            <p className="mt-4 text-sm leading-6 text-slate-200">
              For organizations that need controlled deployment, load the unpacked extension and enroll with your
              organization code. Policy is cached locally and enforced even offline.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact-sales" className="button-primary gap-2 text-sm">
                Talk to security engineering <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/docs" className="button-secondary gap-2 text-sm">
                Deployment docs
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-[#0d1724] p-6">
            <h3 className="text-sm font-semibold text-white">Manual install steps</h3>
            <ol className="mt-4 space-y-3">
              {ENTERPRISE_STEPS.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-cyan/10 text-xs font-bold text-cyan">
                    {i + 1}
                  </span>
                  <span className="leading-6">{step}</span>
                </li>
              ))}
            </ol>
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

      {/* ── Back link ── */}
      <section className="container-page py-10">
        <Link href="/extensions/browser" className="group inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-cyan">
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
          Back to Browser Guard
        </Link>
      </section>
    </main>
  );
}