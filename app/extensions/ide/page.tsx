import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Blocks,
  Check,
  CheckCircle2,
  Code2,
  Download,
  FileCheck2,
  Fingerprint,
  Github,
  KeyRound,
  LockKeyhole,
  MousePointer2,
  Network,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Waves,
} from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { CopyInstallCommand } from './CopyInstallCommand';
import {
  DIRECT_VSIX_URL,
  EDITOR_OPTIONS,
  EXTENSION_ID,
  EXTENSION_VERSION,
  ISSUE_URL,
  OPEN_VSX_URL,
  SOURCE_URL,
  VSCODE_MARKETPLACE_URL,
  VSIX_SHA256_URL,
  type EditorIconName,
} from './extensionData';

export const metadata: Metadata = {
  title: 'SoterAI IDE Guard Extension',
  description:
    'Install SoterAI IDE Guard for VS Code, Cursor, Windsurf, Kiro, Antigravity, and VSCodium. Scan AI coding context locally for secrets, PII, prompt injection, and risky tools.',
  alternates: { canonical: '/extensions/ide' },
  openGraph: {
    title: 'SoterAI IDE Guard - Local AI Security for Developers',
    description:
      'Install the verified SoterAI IDE Guard release from the VS Marketplace or Open VSX.',
    url: '/extensions/ide',
    type: 'website',
  },
};

const ICONS: Record<EditorIconName, LucideIcon> = {
  code: Code2,
  cursor: MousePointer2,
  windsurf: Waves,
  kiro: Sparkles,
  antigravity: Rocket,
  vscodium: ShieldCheck,
};

const PROTECTION_LAYERS = [
  {
    icon: KeyRound,
    title: 'Secrets and PII',
    copy: 'Scan files, selections, git changes, and prompts locally. Create a redacted copy before content reaches an AI workflow.',
  },
  {
    icon: Fingerprint,
    title: 'Prompt integrity',
    copy: 'Detect prompt injection, hidden instruction patterns, and obfuscated content with explicit allow, redact, ask, or block decisions.',
  },
  {
    icon: Blocks,
    title: 'MCP and tools',
    copy: 'Review MCP configuration and tool permissions before connection, with honest detection-only coverage labels where mediation is unavailable.',
  },
  {
    icon: TerminalSquare,
    title: 'Command review',
    copy: 'Preflight risky terminal commands and use the controlled terminal route for fixed-argument, allowlisted operations.',
  },
];

const SCREENSHOTS = [
  {
    src: '/marketplace/screenshots/secret-scan-result.png',
    title: 'Redacted secret finding',
    copy: 'A local scan reports the risk without exposing the detected value in the result.',
  },
  {
    src: '/marketplace/screenshots/scan-selection-result.png',
    title: 'Pre-send selection scan',
    copy: 'Review selected context and produce a safer copy before sharing it with an AI assistant.',
  },
  {
    src: '/marketplace/screenshots/safe-mode-enabled.png',
    title: 'Safe Mode control',
    copy: 'Apply a local protection profile and keep the active posture visible inside the editor.',
  },
];

const DEPLOYMENT_CONTROLS = [
  {
    icon: ServerCog,
    title: 'Machine-scoped controls',
    copy: 'Safety settings that can weaken protection or change data routing cannot be overridden by a repository setting.',
  },
  {
    icon: LockKeyhole,
    title: 'Workspace Trust aware',
    copy: 'Local scanning remains available in restricted workspaces while cloud connection, token storage, and remote escalation stay disabled.',
  },
  {
    icon: FileCheck2,
    title: 'Privacy-preserving evidence',
    copy: 'Review redacted decisions, hashes, file metadata, and policy state without retaining raw secrets in exported views.',
  },
  {
    icon: Network,
    title: 'Brokered enforcement',
    copy: 'Route supported OpenAI- and Anthropic-compatible traffic through the authenticated loopback broker for request and response checks.',
  },
];

const applicationSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SoterAI IDE Guard',
  applicationCategory: 'DeveloperApplication',
  applicationSubCategory: 'SecurityApplication',
  operatingSystem: 'Windows, macOS, Linux',
  softwareVersion: EXTENSION_VERSION,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  downloadUrl: VSCODE_MARKETPLACE_URL,
  installUrl: [VSCODE_MARKETPLACE_URL, OPEN_VSX_URL],
  softwareRequirements: 'Visual Studio Code 1.85.0 or a compatible desktop editor',
  description:
    'Local-first AI security extension for scanning secrets, PII, prompt injection, terminal commands, and MCP configuration.',
};

export default function IdeExtensionPage() {
  return (
    <main className="bg-[#080f19]">
      <JsonLd data={applicationSchema} />

      <section className="border-b border-slate-800 bg-[#0b1420]">
        <div className="container-page py-12 sm:py-16 lg:py-20">
          <nav
            className="flex items-center gap-2 text-xs font-medium text-slate-300"
            aria-label="Breadcrumb"
          >
            <Link href="/" className="transition hover:text-slate-300">
              SoterAI
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-300">IDE Guard</span>
          </nav>

          <div className="mt-8 flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-start">
            <Image
              src="/marketplace/soterai-icon-192.png"
              alt="SoterAI IDE Guard extension icon"
              width={96}
              height={96}
              priority
              className="h-20 w-20 border border-slate-700 object-cover shadow-[0_12px_36px_rgba(0,0,0,0.28)] sm:h-24 sm:w-24"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="border border-cyan/30 bg-cyan/10 px-2 py-1 text-cyan">
                  Local-first security
                </span>
                <span className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
                  v{EXTENSION_VERSION}
                </span>
                <span className="border border-slate-700 bg-slate-900 px-2 py-1 text-slate-300">
                  Free to use
                </span>
              </div>
              <h1 className="mt-4 max-w-4xl text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
                SoterAI IDE Guard
              </h1>
              <p className="mt-4 inline-block rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm font-bold text-emerald-200 shadow-[0_0_24px_rgba(52,211,153,0.15)]">
                ✦ Risk-free vibe coding
              </p>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                Stop your API keys, tokens, and customer secrets from reaching AI. SoterAI IDE Guard
                inspects every prompt, selection, and file before it leaves your editor — scanning
                secrets, PII, prompt injection, MCP configuration, and terminal commands where your
                team works.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <a
                  href={`vscode:extension/${EXTENSION_ID}`}
                  className="button-primary gap-2 text-sm"
                >
                  Open in VS Code <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={OPEN_VSX_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary gap-2 text-sm"
                >
                  Install from Open VSX <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          <div className="mt-10 grid border border-slate-800 bg-[#08101a] sm:grid-cols-3">
            <div className="flex items-start gap-3 border-b border-slate-800 p-4 sm:border-b-0 sm:border-r">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">Live on both registries</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Version {EXTENSION_VERSION} API-verified
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 border-b border-slate-800 p-4 sm:border-b-0 sm:border-r">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">5 editor runtimes verified</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Same packaged VSIX, seven host checks
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold text-white">No account for local scans</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">
                  Cloud connection is explicit and optional
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="install" className="container-page scroll-mt-24 py-14 sm:py-20">
        <div className="max-w-3xl">
          <p className="eyebrow">Choose your editor</p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Install from a verified distribution
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
            Click the primary action to open SoterAI directly in your installed editor. Use the
            registry fallback if the browser blocks the editor prompt or the IDE is not installed on
            this device.
          </p>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden border border-slate-800 bg-slate-800 md:grid-cols-2">
          {EDITOR_OPTIONS.map((editor) => {
            const Icon = ICONS[editor.icon];
            const verified = editor.status === 'runtime-verified';
            return (
              <article key={editor.name} className="flex min-w-0 flex-col bg-[#0d1724] p-5 sm:p-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-slate-700 bg-slate-900 text-cyan">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white">{editor.name}</h3>
                    <p className="mt-1 text-xs text-slate-300">{editor.summary}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="border border-emerald-400/25 bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase text-emerald-300">
                      Free to use
                    </span>
                    <span
                      className={
                        verified
                          ? 'shrink-0 border border-lime/25 bg-lime/10 px-2 py-1 text-[10px] font-bold uppercase text-lime'
                          : 'shrink-0 border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300'
                      }
                    >
                      {verified ? 'Verified' : 'Published'}
                    </span>
                  </div>
                </div>

                <p className="mt-4 flex min-h-10 items-start gap-2 text-xs leading-5 text-slate-200">
                  {verified ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime" aria-hidden="true" />
                  ) : (
                    <Activity
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300"
                      aria-hidden="true"
                    />
                  )}
                  {editor.statusDetail}
                </p>

                <a
                  href={editor.deepLink}
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-cyan/90"
                >
                  Open in {editor.name}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={editor.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-200 transition hover:text-cyan"
                >
                  {editor.listingLabel} fallback
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <div className="mt-3">
                  <CopyInstallCommand command={editor.command} />
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-4 border border-slate-800 bg-[#0b1420] p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-white">
              Need an offline or controlled deployment?
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-300">
              Download the exact Open VSX package, then verify its registry-provided SHA-256
              checksum.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a
              href={DIRECT_VSIX_URL}
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500"
            >
              <Download className="h-4 w-4" aria-hidden="true" /> Download VSIX
            </a>
            <a
              href={VSIX_SHA256_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              SHA-256 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Protection surface</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              Security controls inside the developer workflow
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
              Local checks are available immediately after installation. Strong enforcement applies
              to workflows routed through SoterAI's guarded commands or local broker.
            </p>
          </div>
          <div className="mt-8 grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2 lg:grid-cols-4">
            {PROTECTION_LAYERS.map((item) => {
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
          <div className="mt-5 border-l-2 border-amber-400 bg-amber-400/5 px-4 py-3 text-xs leading-5 text-amber-100/80">
            SoterAI cannot transparently intercept a proprietary editor's private AI prompt pipeline
            or every command typed into an unrestricted terminal. Route supported AI traffic through
            the local broker when you need request-level enforcement.
          </div>
        </div>
      </section>

      <section className="container-page py-14 sm:py-20">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <p className="eyebrow">Product evidence</p>
            <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
              See the extension in VS Code
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-200 sm:text-base">
              These captures come from the extension-host verification flow and use synthetic test
              data only.
            </p>
          </div>
          <a
            href={VSCODE_MARKETPLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-semibold text-cyan transition hover:text-cyan/80"
          >
            View marketplace listing <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {SCREENSHOTS.map((shot) => (
            <figure key={shot.src} className="overflow-hidden border border-slate-800 bg-[#0d1724]">
              <div className="relative aspect-video overflow-hidden border-b border-slate-800 bg-slate-950">
                <Image
                  src={shot.src}
                  alt={`${shot.title} in SoterAI IDE Guard`}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover"
                />
              </div>
              <figcaption className="p-4">
                <h3 className="text-sm font-semibold text-white">{shot.title}</h3>
                <p className="mt-2 text-xs leading-5 text-slate-300">{shot.copy}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-800 bg-[#0b1420]">
        <div className="container-page py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div>
              <p className="eyebrow">Enterprise deployment</p>
              <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
                Controls built for managed workstations
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-200">
                Start local, then add team policy and brokered traffic controls where your threat
                model requires consistent enforcement and reviewable evidence.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Link href="/contact-sales" className="button-primary gap-2 text-sm">
                  Talk to security engineering <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/docs" className="button-secondary gap-2 text-sm">
                  Deployment documentation
                </Link>
              </div>
            </div>
            <div className="grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2">
              {DEPLOYMENT_CONTROLS.map((item) => {
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
        </div>
      </section>

      <section className="container-page py-12 sm:py-16">
        <div className="grid gap-8 border-b border-slate-800 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase text-slate-300">Release details</p>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-300">Extension ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-200">{EXTENSION_ID}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">Current version</dt>
                <dd className="mt-1 font-mono text-xs text-slate-200">{EXTENSION_VERSION}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-300">Minimum VS Code API</dt>
                <dd className="mt-1 font-mono text-xs text-slate-200">^1.85.0</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <a
              href={SOURCE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white"
            >
              <Github className="h-4 w-4" aria-hidden="true" /> Source
            </a>
            <a
              href={ISSUE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-slate-200 transition hover:text-white"
            >
              Report an issue <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <Link href="/support" className="text-slate-200 transition hover:text-white">
              Support
            </Link>
          </div>
        </div>

        <div className="pt-8 text-xs leading-5 text-slate-300">
          <p>
            Registry availability and release identity were verified against the Visual Studio
            Marketplace extension query API and the Open VSX Registry API. Runtime status reflects
            packaged execution evidence stored for version {EXTENSION_VERSION}; VSCodium is marked
            separately because a local host verification artifact is not present.
          </p>
        </div>
      </section>
    </main>
  );
}
