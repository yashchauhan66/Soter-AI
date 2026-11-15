import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { buttonClass } from '@/components/sa/buttonStyles';
import { Callout, SaLinkButton, StatusBadge } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { buildMetadata } from '@/lib/seo/metadata';
import { STATUS_MEANING, SURFACES } from '@/lib/sa/surfaces';
import { CopyInstallCommand } from './CopyInstallCommand';
import {
  DIRECT_VSIX_URL, EDITOR_OPTIONS, EXTENSION_ID, EXTENSION_SEARCH_NAME,
  EXTENSION_VERSION, ISSUE_URL, OPEN_VSX_URL, VSCODE_MARKETPLACE_URL, VSIX_SHA256_URL,
} from './extensionData';
import { OpenIdeButton } from './OpenIdeButton';

const ideSurface = SURFACES.find((surface) => surface.href === '/extensions/ide')!;
const mcpSurface = SURFACES.find((surface) => surface.href === '/mcp-security')!;

export const metadata: Metadata = buildMetadata({
  title: 'SoterAI IDE Guard: VS Code coverage',
  description: 'IDE Guard (Beta) checks AI coding context in scoped VS Code paths. Install links for other editors are available; their runtimes are untested.',
  path: '/extensions/ide',
});

const PROTECTION_LAYERS = [
  { title: 'Secrets and PII', copy: 'Scan prompts, files, selections and git changes that you explicitly send through the extension. Review a redacted copy before sharing context with AI.' },
  { title: 'Prompt integrity', copy: 'Review recognized injection patterns and hidden instructions in supplied text. Detection may miss attacks or flag benign content.' },
  { title: 'MCP and tool review', copy: 'Inspect configuration and permissions. Detection-only paths are guidance, not enforced mediation of every tool call.' },
  { title: 'Command preflight', copy: 'Review commands you send through the supported preflight path. Commands and processes that bypass it are not intercepted.' },
];
const DEPLOYMENT_CONTROLS = [
  { title: 'Workspace policy', copy: 'Apply workspace policy to the extension-managed paths you use. Test the policy in your own VS Code configuration before rolling it out.' },
  { title: 'Workspace Trust aware', copy: 'Local scans remain available while cloud connection and remote escalation stay disabled in restricted workspaces.' },
  { title: 'Redacted evidence', copy: 'Review redacted decisions, hashes, metadata and policy state. Check exports before sharing them.' },
  { title: 'Optional brokered checks', copy: 'Explicitly routed OpenAI- and Anthropic-compatible requests can use the authenticated loopback broker. Direct traffic that bypasses it is not checked.' },
];
const applicationSchema = {
  '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'SoterAI IDE Guard',
  applicationCategory: 'DeveloperApplication', applicationSubCategory: 'SecurityApplication',
  operatingSystem: 'Windows, macOS, Linux', softwareVersion: EXTENSION_VERSION,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
  downloadUrl: VSCODE_MARKETPLACE_URL, installUrl: [VSCODE_MARKETPLACE_URL, OPEN_VSX_URL],
  softwareRequirements: 'Visual Studio Code 1.85.0 or a compatible desktop editor. Runtime coverage is scoped to VS Code; other editor runtimes are untested.',
  description: 'Beta local-first checks for explicitly supplied AI coding context. Compatible editor install targets do not establish runtime coverage.',
};

export default function IdeExtensionPage() {
  return (
    <SaRoot>
      <JsonLd data={applicationSchema} />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <nav className="sa-label" aria-label="Breadcrumb" style={{ marginBottom: 'var(--sa-space-5)' }}><Link className="sa-link" href="/">SoterAI</Link> / IDE Guard</nav>
        <header className="sa-hero">
          <div>
            <p className="sa-eyebrow">IDE Guard <StatusBadge status={ideSurface.status} /> · Local-first · v{EXTENSION_VERSION}</p>
            <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>Check context before you share it with AI.</h1>
            <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>Find recognized secrets and personal data in the text you explicitly scan. Runtime coverage is scoped to VS Code. Other editors below are install targets, not verified runtime coverage.</p>
            <div className="sa-hero__actions">
              <OpenIdeButton ideName="Visual Studio Code" deepLink={`vscode:extension/${EXTENSION_ID}`} className={buttonClass({ large: true })}>Install free for VS Code →</OpenIdeButton>
              <a href="#editors" className="sa-btn sa-btn--secondary">Choose another editor</a>
            </div>
            <p className="sa-label" style={{ marginTop: 'var(--sa-space-4)' }}>No account for local scans · No credit card</p>
            <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-4)' }}>{STATUS_MEANING.find((item) => item.status === ideSurface.status)?.meaning}</p>
          </div>
          <figure style={{ margin: 0 }}>
            <Image src="/marketplace/screenshots/control-panel-protection.png" alt="IDE Guard control panel with request checks and coverage indicators" width={1440} height={816} priority sizes="(min-width: 1024px) 55vw, 100vw" style={{ width: '100%', height: 'auto', border: '1px solid rgb(var(--sa-hairline))' }} />
            <figcaption className="sa-label" style={{ marginTop: 'var(--sa-space-3)' }}>Extension UI screenshot. Coverage indicators are not a protection guarantee.</figcaption>
          </figure>
        </header>

        <section id="editors" className="sa-section" aria-labelledby="install-targets" style={{ scrollMarginTop: '6rem' }}>
          <div className="sa-section__head">
            <h2 className="sa-h2" id="install-targets">Choose an install target</h2>
            <p className="sa-body">Open the listing in your editor, use its registry fallback or copy the install command. Registry availability and compatible installation do not prove runtime protection.</p>
            <p className="sa-body sa-muted">Manual fallback: search for <strong>{EXTENSION_SEARCH_NAME}</strong> by publisher <strong>soterai</strong>.</p>
          </div>
          <ul className="sa-rules sa-rules--2">
            {EDITOR_OPTIONS.map((editor) => {
              const scopedVsCode = editor.name === 'Visual Studio Code';
              return (
                <li key={editor.name} data-editor={editor.name} data-runtime-coverage={scopedVsCode ? 'scoped-vs-code' : 'untested'}>
                  <h3>{editor.name}</h3>
                  <p className="sa-label">{scopedVsCode ? 'Scoped VS Code testing' : 'Install target only · Runtime untested'}</p>
                  <p className="sa-body" style={{ marginTop: 'var(--sa-space-3)' }}>{editor.summary}</p>
                  <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-3)' }}>{scopedVsCode ? 'Limited public coverage, not universal interception. Test your AI assistant and configuration.' : 'An install option is available. Runtime behavior in this editor is not verified by the current public coverage claim.'}</p>
                  <div className="sa-hero__actions" style={{ marginBlock: 'var(--sa-space-4)' }}>
                    <a href={editor.deepLink} className="sa-btn sa-btn--primary">Open in {editor.name} →</a>
                    <a href={editor.listingUrl} target="_blank" rel="noopener noreferrer" className="sa-link">{editor.listingLabel} fallback ↗</a>
                  </div>
                  <CopyInstallCommand command={editor.command} />
                </li>
              );
            })}
          </ul>
          <div style={{ marginTop: 'var(--sa-space-5)' }}>
            <Callout title="Offline or controlled deployment">Download the versioned Open VSX package and compare it with the registry-provided SHA-256 checksum before installation.</Callout>
            <div className="sa-hero__actions"><a href={DIRECT_VSIX_URL} className="sa-btn sa-btn--secondary">Download VSIX</a><a href={VSIX_SHA256_URL} className="sa-btn sa-btn--secondary">SHA-256 ↗</a></div>
          </div>
        </section>

        <section className="sa-section" aria-labelledby="first-scan">
          <div className="sa-section__head"><h2 className="sa-h2" id="first-scan">Start with an explicit local scan</h2></div>
          <ol className="sa-steps">
            <li><div><h3>Install</h3><p className="sa-body">Choose an editor above and install from its registry listing. Only VS Code has scoped public runtime coverage.</p></div></li>
            <li><div><h3>Scan locally</h3><p className="sa-body">Open the SoterAI panel, then scan a selection, file, prompt or git changes with non-sensitive test content.</p></div></li>
            <li><div><h3>Act with context</h3><p className="sa-body">Review the finding, use the redacted copy where appropriate and check the displayed coverage boundary before continuing.</p></div></li>
          </ol>
        </section>

        <section className="sa-section" aria-labelledby="checks">
          <div className="sa-section__head"><h2 className="sa-h2" id="checks">Checks you can inspect</h2><p className="sa-body">The extension checks managed paths, rather than promising invisible interception of every editor or AI assistant.</p></div>
          <ul className="sa-rules sa-rules--2">{PROTECTION_LAYERS.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.copy}</p></li>)}</ul>
          <aside aria-labelledby="coverage-heading" style={{ marginTop: 'var(--sa-space-5)' }}>
            <h2 className="sa-h3" id="coverage-heading">Clear coverage, including the boundaries</h2>
            <Callout kind="limit" title="Detection is not universal blocking">Explicit scan commands and supported broker routes can inspect supplied content. Other prompts, direct network traffic and same-user processes reading files can bypass these checks. Detection-only paths provide guidance, not enforced containment. Other editor runtimes remain untested in the current public coverage claim.</Callout>
          </aside>
          <div style={{ marginTop: 'var(--sa-space-5)' }}><Callout kind="limit" title="MCP and agent guard is experimental"><p className="sa-body"><Link href={mcpSurface.href} className="sa-link">MCP and agent guard</Link> <StatusBadge status={mcpSurface.status} /> — {mcpSurface.gap}</p></Callout></div>
        </section>

        <section className="sa-section" aria-labelledby="teams">
          <div className="sa-section__head"><h2 className="sa-h2" id="teams">Plan a scoped team pilot</h2><p className="sa-body">Evaluate policy, evidence and optional network controls in your own supported configuration. Do not treat an install target as a tested security boundary.</p></div>
          <ul className="sa-rules sa-rules--2">{DEPLOYMENT_CONTROLS.map((item) => <li key={item.title}><h3>{item.title}</h3><p className="sa-body">{item.copy}</p></li>)}</ul>
          <div className="sa-hero__actions"><SaLinkButton href="/contact-sales">Talk to security engineering</SaLinkButton><SaLinkButton href="/docs" variant="secondary">Deployment documentation</SaLinkButton></div>
        </section>

        <section className="sa-section" aria-labelledby="release">
          <div className="sa-section__head"><h2 className="sa-h2" id="release">Release identity and install options</h2></div>
          <dl className="sa-cols sa-cols--3">
            <div><dt className="sa-label">Extension ID</dt><dd className="sa-body" style={{ margin: 0, overflowWrap: 'anywhere' }}>{EXTENSION_ID}</dd></div>
            <div><dt className="sa-label">Current version</dt><dd className="sa-body" style={{ margin: 0 }}>{EXTENSION_VERSION}</dd></div>
            <div><dt className="sa-label">Minimum VS Code API</dt><dd className="sa-body" style={{ margin: 0 }}>^1.85.0</dd></div>
          </dl>
          <p className="sa-body sa-muted" style={{ marginTop: 'var(--sa-space-5)' }}>These are package and installation details, not evidence that every editor, operating system or AI agent has been tested.</p>
          <nav aria-label="Extension help" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sa-space-4)', marginTop: 'var(--sa-space-4)' }}><a href={ISSUE_URL} className="sa-link">Report an issue ↗</a><Link href="/support" className="sa-link">Support</Link><Link href="/limitations" className="sa-link">Known limitations</Link></nav>
        </section>
      </main>
    </SaRoot>
  );
}

