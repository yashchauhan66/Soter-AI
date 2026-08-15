"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  FileText,
  Lock,
  MousePointer2,
  Rocket,
  Settings,
  ShieldCheck,
  Sparkles,
  Waves,
} from "lucide-react";
import { useCallback, useState } from "react";
import { AnimateIn } from "@/components/ui/AnimateIn";

const OPEN_VSX_URL = "https://open-vsx.org/extension/soterai/soterai-ide-guard";
const VSCODE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard";

const IDE_CHOICES = [
  {
    name: "VS Code",
    tagline: "The universal editor",
    icon: Code2,
    accent: "from-[#007ACC] to-[#38BDF8]",
    glow: "group-hover:shadow-[0_0_24px_rgba(56,189,248,0.25)]",
    deepLink: "vscode:extension/soterai.soterai-ide-guard",
    command: "code --install-extension soterai.soterai-ide-guard",
    marketplace: VSCODE_MARKETPLACE_URL,
    marketplaceLabel: "Visual Studio Marketplace",
  },
  {
    name: "Cursor",
    tagline: "AI-native coding",
    icon: MousePointer2,
    accent: "from-[#A78BFA] to-[#C4B5FD]",
    glow: "group-hover:shadow-[0_0_24px_rgba(167,139,250,0.25)]",
    deepLink: "cursor:extension/soterai.soterai-ide-guard",
    command: "cursor --install-extension soterai.soterai-ide-guard",
    marketplace: OPEN_VSX_URL,
    marketplaceLabel: "Open VSX registry",
  },
  {
    name: "Windsurf",
    tagline: "Agentic development",
    icon: Waves,
    accent: "from-[#38BDF8] to-[#22D3EE]",
    glow: "group-hover:shadow-[0_0_24px_rgba(56,189,248,0.25)]",
    deepLink: "windsurf:extension/soterai.soterai-ide-guard",
    command: "windsurf --install-extension soterai.soterai-ide-guard",
    marketplace: OPEN_VSX_URL,
    marketplaceLabel: "Open VSX registry",
  },
  {
    name: "Kiro",
    tagline: "Spec-driven agent IDE",
    icon: Sparkles,
    accent: "from-[#818CF8] to-[#6366F1]",
    glow: "group-hover:shadow-[0_0_24px_rgba(129,140,248,0.25)]",
    deepLink: "kiro:extension/soterai.soterai-ide-guard",
    command: "kiro --install-extension soterai.soterai-ide-guard",
    marketplace: OPEN_VSX_URL,
    marketplaceLabel: "Open VSX registry",
  },
  {
    name: "Antigravity",
    tagline: "Agent-first IDE",
    icon: Rocket,
    accent: "from-[#4285F4] to-[#60A5FA]",
    glow: "group-hover:shadow-[0_0_24px_rgba(66,133,244,0.25)]",
    deepLink: "antigravity:extension/soterai.soterai-ide-guard",
    command: "antigravity --install-extension soterai.soterai-ide-guard",
    marketplace: OPEN_VSX_URL,
    marketplaceLabel: "Open VSX registry",
  },
  {
    name: "VSCodium",
    tagline: "Open-source, telemetry-free",
    icon: ShieldCheck,
    accent: "from-[#2DD4BF] to-[#5EEAD4]",
    glow: "group-hover:shadow-[0_0_24px_rgba(45,212,191,0.25)]",
    deepLink: "vscodium:extension/soterai.soterai-ide-guard",
    command: "codium --install-extension soterai.soterai-ide-guard",
    marketplace: OPEN_VSX_URL,
    marketplaceLabel: "Open VSX registry",
  },
];

const PARITY_MATRIX = [
  { capability: "Agent firewall — authorize or block tool calls before execution", icon: ShieldCheck },
  { capability: "Prompt-injection and jailbreak detection", icon: Lock },
  { capability: "Sensitive data redaction (PII, credentials, tokens)", icon: Lock },
  { capability: "Safe Mode and lockdown recovery", icon: ShieldCheck },
  { capability: "Local AI Broker routing and policy enforcement", icon: Cpu },
  { capability: "MCP tool inspection before connection", icon: Blocks },
  { capability: "Audit ledger and evidence export", icon: FileText },
];

const INSTALL_STEPS = [
  {
    step: "01",
    title: "Pick your editor",
    copy: "Choose from six supported IDEs — every editor runs the identical SoterAI runtime, so behavior is byte-for-byte consistent across your team.",
  },
  {
    step: "02",
    title: "Install in one click",
    copy: "The deep link opens your editor and triggers the native install prompt. No VSIX files, no manual downloads, no registry hopping.",
  },
  {
    step: "03",
    title: "Policies apply instantly",
    copy: "Guard rules sync from your workspace settings or company policy server, and every AI interaction starts landing in the audit ledger immediately.",
  },
];

const ENTERPRISE_BENEFITS = [
  {
    icon: Settings,
    title: "Centrally governed",
    copy: "Push department policies from a single source. Engineering, finance, and support each get their own AI rules.",
  },
  {
    icon: FileText,
    title: "Audit-ready evidence",
    copy: "Signed, redacted logs of every AI decision — ready for SOC 2, ISO 27001, and internal review with no raw secrets stored.",
  },
  {
    icon: Lock,
    title: "Private by default",
    copy: "Detection runs locally on-device. Prompts and files never leave the developer machine unless you configure a broker.",
  },
];

function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [command]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-[#0d1117] px-3 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs text-slate-300">{command}</code>
      <button
        onClick={handleCopy}
        className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
        aria-label={copied ? "Command copied" : "Copy install command"}
      >
        {copied ? (
          <>
            <Check size={12} className="text-lime" aria-hidden="true" />
            <span className="text-lime">Copied</span>
          </>
        ) : (
          <>
            <Copy size={12} aria-hidden="true" />
            <span>Copy</span>
          </>
        )}
      </button>
    </div>
  );
}

export default function IdeExtensionPage() {
  return (
    <main className="relative overflow-hidden">
      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0 grid-fade" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-cyan/10 blur-[140px]"
        aria-hidden="true"
      />

      {/* Hero */}
      <header className="container-page relative py-20 text-center sm:py-24">
        <AnimateIn variant="slide-down">
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan/25 bg-cyan/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-cyan">
            <ShieldCheck size={13} aria-hidden="true" />
            IDE Guard · 6 platforms · 1 runtime
          </span>
        </AnimateIn>
        <AnimateIn delay={1}>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
            One guard.{" "}
            <span className="bg-gradient-to-r from-cyan via-teal-300 to-cyan bg-clip-text text-transparent">
              Every editor you ship in.
            </span>
          </h1>
        </AnimateIn>
        <AnimateIn delay={2}>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-400">
            SoterAI IDE Guard runs the same engine natively inside VS Code, Cursor, Windsurf, Kiro,
            Antigravity, and VSCodium. Install in your editor — the protection is identical everywhere.
          </p>
        </AnimateIn>
        <AnimateIn delay={3}>
          <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-lime" aria-hidden="true" /> Verified on every platform
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-lime" aria-hidden="true" /> No VSIX downloads
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-lime" aria-hidden="true" /> Policies apply instantly
            </span>
          </div>
        </AnimateIn>
      </header>

      {/* IDE cards */}
      <section id="editors" className="container-page relative scroll-mt-24 pb-8">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {IDE_CHOICES.map((ide, i) => {
            const Icon = ide.icon;
            return (
              <AnimateIn key={ide.name} delay={(i % 3) + 1} className="h-full">
                <article
                  className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-800 bg-panel/80 p-6 shadow-glow backdrop-blur transition duration-300 hover:-translate-y-1 hover:border-slate-600 ${ide.glow}`}
                >
                  {/* Brand accent bar */}
                  <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${ide.accent}`} aria-hidden="true" />

                  <div className="flex items-center gap-4">
                    <span
                      className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${ide.accent} text-slate-950 shadow-lg`}
                    >
                      <Icon size={22} strokeWidth={2.2} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                        {ide.name}
                        <span className="rounded-md border border-lime/30 bg-lime/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime">
                          Live
                        </span>
                      </h2>
                      <p className="text-xs text-slate-500">{ide.tagline}</p>
                    </div>
                  </div>

                  <div className="mt-5 flex-1 space-y-3">
                    <a
                      href={ide.deepLink}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Install in {ide.name}
                      <ArrowRight size={15} aria-hidden="true" />
                    </a>

                    <CopyCommand command={ide.command} />

                    <Link
                      href={ide.marketplace}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 underline decoration-slate-700 underline-offset-2 transition hover:text-cyan"
                    >
                      {ide.marketplaceLabel}
                      <ArrowUpRight size={12} aria-hidden="true" />
                    </Link>
                  </div>
                </article>
              </AnimateIn>
            );
          })}
        </div>
      </section>

      {/* Parity matrix */}
      <section className="container-page relative py-20">
        <AnimateIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Feature parity</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              The same protection, everywhere
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-400">
              Every capability ships identically in every editor — runtime-verified against the same
              packaged release on each platform.
            </p>
          </div>
        </AnimateIn>

        <AnimateIn delay={2}>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-800 bg-panel/60 shadow-glow backdrop-blur">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Capability
                  </th>
                  {IDE_CHOICES.map((ide) => (
                    <th key={ide.name} className="px-4 py-4 text-center">
                      <span className="text-xs font-bold text-slate-200">{ide.name}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PARITY_MATRIX.map((row, i) => {
                  const RowIcon = row.icon;
                  return (
                    <tr key={row.capability} className={i % 2 ? "bg-slate-950/30" : ""}>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center gap-2 text-slate-300">
                          <RowIcon size={14} className="text-cyan" aria-hidden="true" />
                          {row.capability}
                        </span>
                      </td>
                      {IDE_CHOICES.map((ide) => (
                        <td key={ide.name} className="px-4 py-3.5 text-center">
                          <Check size={15} className="mx-auto text-lime" aria-hidden="true" />
                          <span className="sr-only">Supported in {ide.name}</span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AnimateIn>
      </section>

      {/* How it works */}
      <section className="container-page relative pb-20">
        <AnimateIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Getting started</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Live in under a minute</h2>
          </div>
        </AnimateIn>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {INSTALL_STEPS.map((s, i) => (
            <AnimateIn key={s.step} delay={i + 1}>
              <article className="h-full rounded-2xl border border-slate-800 bg-panel/60 p-6 shadow-glow backdrop-blur">
                <span className="font-mono text-sm font-bold text-cyan">{s.step}</span>
                <h3 className="mt-3 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{s.copy}</p>
              </article>
            </AnimateIn>
          ))}
        </div>
      </section>

      {/* Enterprise trust */}
      <section className="container-page relative pb-24">
        <AnimateIn>
          <div className="mx-auto max-w-3xl text-center">
            <p className="eyebrow">Built for teams</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Enterprise-ready by design</h2>
          </div>
        </AnimateIn>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {ENTERPRISE_BENEFITS.map((b, i) => {
            const Icon = b.icon;
            return (
              <AnimateIn key={b.title} delay={i + 1}>
                <article className="h-full rounded-2xl border border-slate-800 bg-panel/60 p-6 shadow-glow backdrop-blur">
                  <span className="inline-flex rounded-lg border border-cyan/20 bg-cyan/10 p-2.5 text-cyan">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-white">{b.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{b.copy}</p>
                </article>
              </AnimateIn>
            );
          })}
        </div>

        <AnimateIn delay={2}>
          <div className="mt-10 rounded-2xl border border-slate-800 bg-slate-950/50 p-6 text-sm leading-6 text-slate-400">
            <p>
              <strong className="text-slate-200">One-click button not responding?</strong> Browsers sometimes
              block the “Open {`{editor}`}?” prompt — that is a browser setting, not a broken link. Your
              editor must also be installed on the machine you are browsing from. The terminal command works
              in every case, and the marketplace link always opens a listing you can install from.
            </p>
            <p className="mt-3">
              <strong className="text-slate-200">JetBrains IDEs</strong> (IntelliJ, PyCharm, WebStorm) are in
              early development and will appear here once the plugin passes its verification gates.
            </p>
          </div>
        </AnimateIn>
      </section>
    </main>
  );
}
