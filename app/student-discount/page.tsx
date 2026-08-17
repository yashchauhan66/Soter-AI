import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Download,
  GraduationCap,
  Heart,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Zap,
} from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  DIRECT_VSIX_URL,
  EDITOR_OPTIONS,
  OPEN_VSX_URL,
  VSCODE_MARKETPLACE_URL,
} from "@/app/extensions/ide/extensionData";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.in";

export const metadata: Metadata = {
  title: "Student Offer: Free SoterAI IDE Guard Forever | SoterAI",
  description:
    "SoterAI IDE Guard is free for everyone — no credit card, no trial clock. Scan AI coding context for secrets, PII, and prompt injection before it reaches ChatGPT, Claude, Cursor, or Copilot.",
  keywords: [
    "free ai security extension",
    "free ide extension",
    "free prompt injection protection",
    "ai safety for developers",
    "free ai security tool",
  ],
  alternates: { canonical: "/student-discount" },
  openGraph: {
    title: "SoterAI IDE Guard — Free for Everyone",
    description:
      "SoterAI IDE Guard is free for everyone. Your AI coding assistant stops leaking your code and data. No credit card, no trial, no catch.",
    url: "/student-discount",
    type: "website",
  },
};

const studentSchema = {
  "@context": "https://schema.org",
  "@type": "Offer",
  name: "SoterAI Free IDE Guard",
  description:
    "Free SoterAI IDE Guard extension for everyone. Local-first AI security for VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium.",
  url: `${siteUrl}/student-discount`,
  category: "https://schema.org/Free",
  price: "0",
  priceCurrency: "INR",
  eligibleRegion: { "@type": "Place", name: "Worldwide" },
  seller: { "@type": "Organization", name: "SoterAI" },
  itemOffered: {
    "@type": "Service",
    name: "SoterAI IDE Guard",
    url: `${siteUrl}/extensions/ide`,
    serviceType: "AI Security Extension",
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: VSCODE_MARKETPLACE_URL,
      availableLanguage: ["en", "hi"],
    },
  },
};

const PERKS = [
  {
    icon: ShieldCheck,
    title: "Free forever",
    copy: "Free for everyone, forever. No trial clock, no credit card, no hidden upgrade nag.",
  },
  {
    icon: Sparkles,
    title: "Your code stays private",
    copy: "Scanning runs 100% local. Your files, selections, and prompts never leave your machine on the detection path.",
  },
  {
    icon: Zap,
    title: "Works with every AI IDE",
    copy: "VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium. If you code with an AI assistant, IDE Guard protects it.",
  },
  {
    icon: TerminalSquare,
    title: "Blocks prompt injection",
    copy: "Catches hidden instructions, obfuscated payloads, and secret exfiltration attempts before they reach ChatGPT, Claude, or Copilot.",
  },
  {
    icon: BadgeCheck,
    title: "Benchmarked, not vibes",
    copy: "3,200 public test cases. 100% recall. 0% false positives. 9.3ms median latency. Numbers you can check yourself.",
  },
  {
    icon: GraduationCap,
    title: "Built for learners",
    copy: "Learn AI security the right way — redacted findings, safe-mode controls, and honest detection labels on every decision.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Install IDE Guard",
    copy: "Open VS Code (or your editor), go to Extensions, search “SoterAI IDE Guard”, and click Install.",
  },
  {
    step: "2",
    title: "Turn on Safe Mode",
    copy: "One click applies a local protection profile — secrets and prompt injections get blocked before they reach your AI assistant.",
  },
  {
    step: "3",
    title: "Code with confidence",
    copy: "Send code to ChatGPT, Claude, or Cursor knowing every paste is checked first.",
  },
  {
    step: "4",
    title: "Share it with your team",
    copy: "IDE Guard is free for everyone — your teammates, classmates, and co-founders can install it too.",
  },
];

export default function StudentDiscountPage() {
  return (
    <main className="bg-[#080f19]">
      <JsonLd data={studentSchema} />

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800 bg-gradient-to-b from-[#0b1420] via-[#080f19] to-[#080f19]">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(34,211,238,0.15),transparent)]"
        />
        <div className="container-page relative py-16 sm:py-20 lg:py-24">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan/30 bg-cyan/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-cyan">
              <ShieldCheck size={14} aria-hidden="true" />
              Free for everyone · Worldwide
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Your AI coding assistant&apos;s{" "}
              <span className="bg-gradient-to-r from-cyan to-emerald-300 bg-clip-text text-transparent">
                security blanket
              </span>{" "}
              — free for everyone
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              SoterAI IDE Guard scans your code, selections, and prompts for secrets, PII, and
              prompt injection — <strong className="text-white">100% locally</strong> — before they
              reach ChatGPT, Claude, Cursor, or Copilot. <strong className="text-white">100% free</strong>{" "}
              for every developer.
            </p>
            <p className="mt-4 inline-flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-base font-semibold text-white">
              <Zap size={18} className="text-emerald-300" aria-hidden="true" />
              <span>
                Risk-free <span className="text-emerald-300">vibe coding</span> — your secrets never
                get revealed to the AI
              </span>
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
              <Link
                href="#editors"
                className="inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3.5 text-base font-bold text-slate-950 transition hover:bg-cyan/90"
              >
                <Download size={18} aria-hidden="true" />
                Install free — no signup needed
              </Link>
              <Link
                href="/extensions/ide"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3.5 text-base font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Learn more about IDE Guard
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-cyan" aria-hidden="true" />
                No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <BadgeCheck size={15} className="text-cyan" aria-hidden="true" />
                No trial clock
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Heart size={15} className="text-cyan" aria-hidden="true" />
                Free forever
              </span>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {EDITOR_OPTIONS.map((editor) => (
                <a
                  key={editor.name}
                  href={editor.deepLink}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-sm font-semibold text-white transition hover:border-cyan/50 hover:bg-cyan/10"
                >
                  <Download size={13} className="text-cyan" aria-hidden="true" />
                  {editor.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="border-b border-slate-800">
        <div className="container-page py-16 lg:py-20">
          <h2 className="text-center text-3xl font-bold text-white">
            Everything a developer needs
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
            The same protection teams pay for — free for the next generation of builders.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk) => (
              <div
                key={perk.title}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-700"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-cyan/10">
                  <perk.icon size={22} className="text-cyan" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">{perk.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{perk.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How to claim */}
      <section className="border-b border-slate-800 bg-[#0b1420]">
        <div className="container-page py-16 lg:py-20">
          <h2 className="text-center text-3xl font-bold text-white">
            Get it in 4 steps, under 3 minutes
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.step} className="relative rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan to-emerald-300 text-lg font-extrabold text-slate-950">
                  {s.step}
                </span>
                <h3 className="mt-4 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{s.copy}</p>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-3 rounded-2xl border border-cyan/20 bg-cyan/5 p-6 text-center">
            <p className="text-sm leading-6 text-slate-300">
              <strong className="text-white">Docs-first:</strong> follow the official integration
              guide to verify installs, understand scan coverage, and tune Safe Mode for your
              workflow.
            </p>
            <Link
              href="/docs/quickstart"
              className="inline-flex items-center gap-1.5 font-semibold text-cyan underline underline-offset-4 hover:text-cyan/80"
            >
              Read the getting-started docs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Supported editors */}
      <section id="editors" className="border-b border-slate-800">
        <div className="container-page py-16 lg:py-20">
          <h2 className="text-center text-3xl font-bold text-white">
            Works in every editor you love
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-slate-300">
            One extension, six editors. Click <strong className="text-white">Install now</strong> —
            it opens the extension page directly inside your IDE.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {EDITOR_OPTIONS.map((editor) => (
              <div
                key={editor.name}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-6 transition hover:border-slate-600"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-lg font-semibold text-white">{editor.name}</p>
                    <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      {editor.status === "runtime-verified" ? "Verified" : "Available"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{editor.summary}</p>
                  <p className="mt-3 text-xs text-slate-500">{editor.statusDetail}</p>
                </div>
                <div className="mt-5 flex flex-col gap-2">
                  <a
                    href={editor.deepLink}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan/90"
                  >
                    <Download size={16} aria-hidden="true" />
                    Install in {editor.name}
                  </a>
                  <a
                    href={editor.listingUrl}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
                  >
                    View {editor.listingLabel} listing
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div className="mx-auto mt-10 flex max-w-3xl flex-col items-center gap-4 text-center">
            <p className="text-sm leading-6 text-slate-300">
              Or install manually from the VS Marketplace, Open VSX, or a direct VSIX with published
              SHA-256 checksums.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <a
                href={VSCODE_MARKETPLACE_URL}
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                VS Marketplace
              </a>
              <a
                href={OPEN_VSX_URL}
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Open VSX
              </a>
              <a
                href={DIRECT_VSIX_URL}
                className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
              >
                Direct VSIX + SHA-256
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Why now */}
      <section className="border-b border-slate-800 bg-[#0b1420]">
        <div className="container-page py-16 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold text-white">Why every developer needs this now</h2>
            <p className="mt-4 text-lg leading-8 text-slate-300">
              68% of developers use AI assistants today. Your assignments, projects, and side
              projects flow through ChatGPT and Cursor — and with them, your API keys, database
              strings, and personal data. IDE Guard is the seatbelt for the AI era of coding.
            </p>
            <p className="mx-auto mt-5 inline-flex max-w-2xl flex-wrap items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-base font-semibold text-white">
              <Zap size={18} className="text-emerald-300" aria-hidden="true" />
              <span>
                <span className="text-emerald-300">Vibe code freely</span> — API keys, secrets &
                personal data stay redacted before they reach the AI.{" "}
                <Link
                  href="/docs/quickstart"
                  className="text-cyan underline underline-offset-4 hover:text-cyan/80"
                >
                  Read the docs
                </Link>
              </span>
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <p className="text-3xl font-extrabold text-cyan">100%</p>
                <p className="mt-1 text-sm text-slate-300">Recall on 3,200 benchmark cases</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <p className="text-3xl font-extrabold text-cyan">0%</p>
                <p className="mt-1 text-sm text-slate-300">False positives on benign code</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
                <p className="text-3xl font-extrabold text-cyan">9.3ms</p>
                <p className="mt-1 text-sm text-slate-300">Median detection latency</p>
              </div>
            </div>
            <p className="mt-6 text-sm text-slate-400">
              Methodology and raw results are public — verify them yourself in the{" "}
              <Link href="/benchmark" className="text-cyan underline underline-offset-4 hover:text-cyan/80">
                benchmark report
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-slate-800">
        <div className="container-page py-16 lg:py-20">
          <h2 className="text-center text-3xl font-bold text-white">Free offer FAQ</h2>
          <div className="mx-auto mt-10 max-w-3xl space-y-4">
            {[
              {
                q: "Is IDE Guard really free for everyone?",
                a: "Yes. No verification, no credit card, no trial clock. Install it from the marketplace and start protecting your code within minutes — free for every developer, forever.",
              },
              {
                q: "Do I need a credit card?",
                a: "No. The extension installs directly from the VS Marketplace or Open VSX with no payment method required.",
              },
              {
                q: "Is the extension really free, or just a trial?",
                a: "Really free. There is no trial clock, no watermark, and no usage cap on local scanning. The same detection engine powers our paid API Guard for teams.",
              },
              {
                q: "Does it slow down my editor?",
                a: "No. Scanning is staged — fast local heuristics handle most traffic in milliseconds, and the heavier classifier only runs on the small residual. Median latency on the public benchmark is 9.3ms.",
              },
              {
                q: "Does my code leave my machine?",
                a: "Local scanning runs entirely on your machine. No prompts, files, or secrets are uploaded on the detection path. Cloud features are opt-in and clearly labeled.",
              },
              {
                q: "How does SoterAI make money if this is free?",
                a: "IDE Guard stays free as our way of protecting every developer. Businesses pay for the API Guard, browser guard, and n8n/Make/Zapier integrations that teams deploy at scale.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-slate-800 bg-slate-900/50 p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-white">
                  {item.q}
                  <span className="text-cyan transition group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_100%,rgba(16,185,129,0.12),transparent)]"
        />
        <div className="container-page relative py-16 text-center lg:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">
            Your future self will thank you
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">
            Ship your next project without leaking your secrets. Install free — it takes one minute.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="#editors"
              className="inline-flex items-center gap-2 rounded-lg bg-cyan px-6 py-3.5 text-base font-bold text-slate-950 transition hover:bg-cyan/90"
            >
              <Download size={18} aria-hidden="true" />
              Install free — no signup needed
            </Link>
            <Link
              href="/extensions/ide"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700 px-6 py-3.5 text-base font-semibold text-white transition hover:border-slate-500 hover:bg-slate-900"
            >
              Learn more about IDE Guard
            </Link>
          </div>
          <p className="mt-6 text-xs text-slate-500">
            Share this offer with your team — good security is better in groups.
          </p>
        </div>
      </section>
    </main>
  );
}