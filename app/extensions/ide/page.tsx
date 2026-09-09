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
  Eye,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Laptop,
  LockKeyhole,
  MousePointer2,
  Network,
  Rocket,
  ServerCog,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Waves,
  Zap,
} from 'lucide-react';
import { JsonLd } from '@/components/seo/JsonLd';
import { CopyInstallCommand } from './CopyInstallCommand';
import {
  DIRECT_VSIX_URL,
  EDITOR_OPTIONS,
  EXTENSION_ID,
  EXTENSION_SEARCH_NAME,
  EXTENSION_VERSION,
  ISSUE_URL,
  OPEN_VSX_URL,
  VSCODE_MARKETPLACE_URL,
  VSIX_SHA256_URL,
  type EditorIconName,
} from './extensionData';
import { OpenIdeButton } from './OpenIdeButton';

export const metadata: Metadata = {
  title: 'IDE Guard Extension for VS Code & Cursor',
  description:
    'Install SoterAI IDE Guard for VS Code, Cursor, Windsurf, Kiro and VSCodium. Scan AI coding context locally for secrets, PII, prompt injection and risky tools.',
  alternates: { canonical: '/extensions/ide' },
  openGraph: {
    title: 'SoterAI IDE Guard — Local AI Security for Developers',
    description: 'Free, local-first protection around your AI coding workflow.',
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
    number: '01',
    title: 'Secrets and PII',
    copy: 'Scan prompts, files, selections, and git changes locally. Create a redacted copy before sharing context with AI.',
  },
  {
    icon: Fingerprint,
    number: '02',
    title: 'Prompt integrity',
    copy: 'Flag prompt injection, hidden instructions, and obfuscated content with clear allow, redact, ask, or block decisions.',
  },
  {
    icon: Blocks,
    number: '03',
    title: 'MCP and tool review',
    copy: 'Inspect MCP configuration and tool permissions before connection, with detection-only labels where mediation is unavailable.',
  },
  {
    icon: TerminalSquare,
    number: '04',
    title: 'Command preflight',
    copy: 'Review risky terminal commands before execution and route fixed-argument, allowlisted operations through a controlled terminal.',
  },
];

const DEPLOYMENT_CONTROLS = [
  {
    icon: ServerCog,
    title: 'Policy that travels',
    copy: 'Distribute workspace policy and keep developer decisions consistent across supported editors.',
  },
  {
    icon: LockKeyhole,
    title: 'Workspace Trust aware',
    copy: 'Local scans remain available while cloud connection and remote escalation stay disabled in restricted workspaces.',
  },
  {
    icon: FileCheck2,
    title: 'Privacy-preserving evidence',
    copy: 'Export redacted decisions, hashes, metadata, and policy state without retaining raw secrets in evidence views.',
  },
  {
    icon: Network,
    title: 'Optional brokered checks',
    copy: 'Route supported OpenAI- and Anthropic-compatible traffic through an authenticated loopback broker for request and response checks.',
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
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  downloadUrl: VSCODE_MARKETPLACE_URL,
  installUrl: [VSCODE_MARKETPLACE_URL, OPEN_VSX_URL],
  softwareRequirements: 'Visual Studio Code 1.85.0 or a compatible desktop editor',
  description:
    'Local-first AI security extension for scanning secrets, PII, prompt injection, terminal commands, and MCP configuration.',
};

export default function IdeExtensionPage() {
  return (
    <main className="overflow-hidden bg-white text-slate-100">
      <JsonLd data={applicationSchema} />

      <section className="relative border-b border-slate-800/80 bg-slate-950">
        <div className="pointer-events-none absolute inset-0 hero-wash" />
        <div className="container-page relative py-10 sm:py-14 lg:py-20">
          <nav
            className="flex items-center gap-2 text-xs font-medium text-slate-400"
            aria-label="Breadcrumb"
          >
            <Link
              href="/"
              className="rounded-sm transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
            >
              SoterAI
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-slate-200">IDE Guard</span>
          </nav>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-14">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 border border-lime/30 bg-lime/10 px-2.5 py-1 text-xs font-bold text-lime">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Free to use
                </span>
                <span className="border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  Local-first
                </span>
                <span className="border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  v{EXTENSION_VERSION}
                </span>
              </div>

              <h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.05] tracking-tight text-slate-100 sm:text-5xl lg:text-6xl">
                Build with AI Without Exposing Your Private Data.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                SoterAI IDE Guard helps stop secrets, personal information, and sensitive files from
                being accidentally shared with AI—so you can vibe code with greater confidence.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <OpenIdeButton
                  ideName="Visual Studio Code"
                  deepLink={`vscode:extension/${EXTENSION_ID}`}
                  className="button-primary min-h-12 gap-2 px-5 text-sm"
                >
                  Install free for VS Code <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </OpenIdeButton>
                <a href="#editors" className="button-secondary min-h-12 gap-2 px-5 text-sm">
                  Choose another editor
                </a>
              </div>

              <ul
                className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300"
                aria-label="Product assurances"
              >
                {['No account for local scans', 'No credit card', 'Open source'].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-lime" aria-hidden="true" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <figure className="relative lg:pl-4">
              <div className="absolute -inset-5 bg-cyan/5 blur-3xl" aria-hidden="true" />
              <div className="relative overflow-hidden border border-slate-800 bg-white p-2 shadow-elevation-4 sm:p-3">
                <div
                  className="flex items-center gap-1.5 border-b border-slate-800 px-2 pb-2.5"
                  aria-hidden="true"
                >
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="h-2 w-2 rounded-full bg-slate-600" />
                  <span className="h-2 w-2 rounded-full bg-cyan/70" />
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    SoterAI control panel
                  </span>
                </div>
                <Image
                  src="/marketplace/screenshots/control-panel-protection.png"
                  alt="SoterAI IDE Guard control panel showing active request checks, editor warnings, local data boundaries, and detected coverage gaps"
                  width={1440}
                  height={816}
                  priority
                  sizes="(min-width: 1024px) 55vw, 100vw"
                  className="mt-2 h-auto w-full"
                />
              </div>
              <figcaption className="mt-3 flex items-center gap-2 text-xs leading-5 text-slate-400">
                <Eye className="h-3.5 w-3.5 shrink-0 text-cyan" aria-hidden="true" />
                Real extension UI. See active checks and known gaps in one view.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section id="editors" className="container-page scroll-mt-24 py-16 sm:py-20">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow">Pick your editor</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
              One guard. Six familiar editors.
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-300 sm:text-base">
              Open the verified listing directly in your editor. If your browser asks, allow it to
              open the desktop app.
            </p>
          </div>
          <p className="max-w-sm border-l-2 border-cyan pl-4 text-xs leading-5 text-slate-400">
            Manual fallback: search for{' '}
            <strong className="text-slate-200">{EXTENSION_SEARCH_NAME}</strong> by publisher{' '}
            <strong className="text-slate-200">soterai</strong>.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {EDITOR_OPTIONS.map((editor) => {
            const Icon = ICONS[editor.icon];
            const verified = editor.status === 'runtime-verified';
            return (
              <article
                key={editor.name}
                className="group flex min-w-0 flex-col border border-slate-800 bg-slate-950 p-5 transition hover:border-slate-700 hover:bg-slate-900 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-slate-700 bg-slate-900 text-cyan transition group-hover:border-cyan/40">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-slate-100">{editor.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{editor.summary}</p>
                  </div>
                  <span
                    className={
                      verified
                        ? 'border border-lime/25 bg-lime/10 px-2 py-1 text-[10px] font-bold uppercase text-lime'
                        : 'border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] font-bold uppercase text-amber-300'
                    }
                  >
                    {verified ? 'Verified' : 'Published'}
                  </span>
                </div>

                <p className="mt-4 flex min-h-10 items-start gap-2 text-xs leading-5 text-slate-300">
                  {verified ? (
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-lime"
                      aria-hidden="true"
                    />
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
                  className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 bg-cyan px-4 py-2.5 text-sm font-bold text-white transition hover:bg-cyan/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan focus-visible:ring-offset-2"
                >
                  Open in {editor.name} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
                <a
                  href={editor.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-sm text-xs font-semibold text-slate-300 transition hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
                >
                  {editor.listingLabel} fallback{' '}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
                <div className="mt-3">
                  <CopyInstallCommand command={editor.command} />
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-5 flex flex-col justify-between gap-4 border border-slate-800 bg-slate-950 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-100">Offline or controlled deployment</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              Download the exact Open VSX package and verify its registry-provided SHA-256 checksum.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={DIRECT_VSIX_URL} className="button-secondary gap-2 text-xs">
              <Download className="h-4 w-4" aria-hidden="true" /> Download VSIX
            </a>
            <a href={VSIX_SHA256_URL} className="button-secondary gap-2 text-xs">
              SHA-256 <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-800 bg-slate-950">
        <div className="container-page py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="eyebrow">Three-step setup</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
              From install to useful protection in minutes.
            </h2>
          </div>
          <ol className="mt-10 grid border border-slate-800 bg-slate-800 md:grid-cols-3 md:gap-px">
            {[
              {
                icon: Download,
                step: '01',
                title: 'Install',
                copy: 'Choose your editor above and install from its verified registry listing.',
              },
              {
                icon: Laptop,
                step: '02',
                title: 'Scan locally',
                copy: 'Open the SoterAI panel, then scan a selection, file, prompt, or git changes.',
              },
              {
                icon: Zap,
                step: '03',
                title: 'Act with context',
                copy: 'Review the finding, redact sensitive content, or continue with a recorded decision.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.step} className="relative bg-slate-950 p-6 sm:p-8">
                  <span className="font-mono text-xs font-bold text-cyan">{item.step}</span>
                  <Icon className="mt-8 h-6 w-6 text-lime" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="container-page py-16 sm:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
          <div>
            <p className="eyebrow">Protection you can inspect</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
              Less blind trust. More informed decisions.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-300 sm:text-base">
              SoterAI puts checks next to the work instead of promising invisible, universal
              interception. You see what was examined and how to respond.
            </p>
          </div>
          <div className="grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2">
            {PROTECTION_LAYERS.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="bg-slate-950 p-6">
                  <div className="flex items-center justify-between">
                    <Icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                    <span className="font-mono text-[10px] text-slate-500">{item.number}</span>
                  </div>
                  <h3 className="mt-7 font-semibold text-slate-100">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.copy}</p>
                </article>
              );
            })}
          </div>
        </div>

        <aside
          className="mt-10 border border-amber-400/20 bg-amber-400/[0.04] p-6 sm:p-8"
          aria-labelledby="coverage-heading"
        >
          <div className="grid gap-5 md:grid-cols-[auto_1fr] md:gap-6">
            <ShieldCheck className="h-7 w-7 text-amber-300" aria-hidden="true" />
            <div>
              <h2 id="coverage-heading" className="text-lg font-semibold text-slate-100">
                Clear coverage, including the boundaries
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-300">
                The extension can scan content you explicitly send through its commands and
                supported broker routes. It cannot transparently intercept every prompt sent by
                every editor or third-party AI extension. Detection-only surfaces are labeled in the
                control panel so your team can distinguish guidance from enforced blocking.
              </p>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-y border-slate-800 bg-slate-950">
        <div className="container-page py-16 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16">
            <div>
              <p className="eyebrow">For security-minded teams</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-100 sm:text-4xl">
                Local by default. Governed when you need it.
              </h2>
              <p className="mt-5 text-sm leading-7 text-slate-300 sm:text-base">
                Start with free local protection, then add consistent policy, evidence, and
                supported network controls for managed environments.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/contact-sales" className="button-primary gap-2 text-sm">
                  Talk to security engineering <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href="/docs" className="button-secondary text-sm">
                  Deployment documentation
                </Link>
              </div>
            </div>
            <div className="grid gap-px border border-slate-800 bg-slate-800 sm:grid-cols-2">
              {DEPLOYMENT_CONTROLS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="bg-slate-950 p-5 sm:p-6">
                    <Icon className="h-5 w-5 text-cyan" aria-hidden="true" />
                    <h3 className="mt-5 text-sm font-semibold text-slate-100">{item.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-300">{item.copy}</p>
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
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Verified release details
            </p>
            <dl className="mt-5 grid gap-5 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Extension ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-slate-200">{EXTENSION_ID}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Current version</dt>
                <dd className="mt-1 font-mono text-xs text-slate-200">{EXTENSION_VERSION}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Minimum VS Code API</dt>
                <dd className="mt-1 font-mono text-xs text-slate-200">^1.85.0</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
            <a
              href={ISSUE_URL}
              className="inline-flex items-center gap-2 text-slate-300 transition hover:text-slate-100"
            >
              Report an issue <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <Link href="/support" className="text-slate-300 transition hover:text-slate-100">
              Support
            </Link>
          </div>
        </div>
        <p className="pt-8 text-xs leading-5 text-slate-500">
          Registry availability and release identity were verified against the Visual Studio
          Marketplace and Open VSX APIs. Runtime status reflects packaged execution evidence for
          version {EXTENSION_VERSION}; VSCodium is labeled separately because a local host
          verification artifact is not present.
        </p>
      </section>
    </main>
  );
}
