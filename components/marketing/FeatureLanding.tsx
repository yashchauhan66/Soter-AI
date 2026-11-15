import Link from "next/link";
import { PLAYGROUND_CTA_LABEL } from "@/lib/marketing/cta";
import { Faq } from "@/components/sa/Faq";
import { SaLinkButton } from "@/components/sa/primitives";
import { SaRoot } from "@/components/sa/SaRoot";
import { JsonLd } from "@/components/seo/JsonLd";
import { GENERAL_LIMIT } from "@/lib/sa/claims";
import { softwareApplicationLd, faqPageLd } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";

/** VS Code Marketplace listing for the IDE Guard extension. */
export const VSCODE_MARKETPLACE_URL =
  "https://marketplace.visualstudio.com/items?itemName=soterai.soterai-ide-guard";

/** Pages that are IDE / editor focused: show the VS Code install CTA. */
const IDE_PAGES = new Set([
  "/vscode-ai-security",
  "/cursor-ai-security",
  "/mcp-security",
  "/prompt-injection-protection",
  "/ai-data-leakage-prevention",
  "/local-ai-broker",
  "/ai-safe-mode",
  "/ai-memory-inspector",
]);

/**
 * The playground example that best shows what each page is about. The link goes to
 * `/playground?preset=<id>`, which loads the example into the text box. Nothing is
 * sent until the visitor presses "Check this text". Ids come from lib/sa/presets.ts.
 */
const TRY_PRESET: Record<string, { id: string; label: string }> = {
  "/ai-agent-security": { id: "tool-call", label: "a risky tool call" },
  "/ai-user-security": { id: "api-key", label: "a pasted API key" },
  "/prompt-injection-protection": { id: "injection", label: "a prompt injection" },
  "/ai-data-leakage-prevention": { id: "api-key", label: "a pasted API key" },
  "/rag-security": { id: "rag-poisoning", label: "a poisoned document" },
  "/mcp-security": { id: "mcp-poisoning", label: "a poisoned MCP tool description" },
  "/llm-firewall": { id: "injection", label: "a prompt injection" },
  "/jailbreak-detection": { id: "jailbreak-dan", label: "a DAN jailbreak" },
  "/llm-security": { id: "injection", label: "a prompt injection" },
  "/ai-security-india": { id: "aadhaar-pan", label: "an Aadhaar-like number and a PAN" },
  "/ai-workflow-security": { id: "tool-abuse", label: "tool abuse" },
  "/enterprise-ai-security": { id: "reply-leak", label: "a reply that leaks data" },
  "/vscode-ai-security": { id: "api-key", label: "a pasted API key" },
  "/cursor-ai-security": { id: "api-key", label: "a pasted API key" },
  "/local-ai-broker": { id: "personal-data", label: "an email address and a phone number" },
  "/ai-safe-mode": { id: "tool-call", label: "a risky tool call" },
  "/ai-memory-inspector": { id: "memory-poisoning", label: "memory poisoning" },
};

/** Determine the primary CTA for a feature page based on its path. */
function primaryCta(path: string): { label: string; href: string; external: boolean } {
  if (path === "/ai-user-security") {
    return { label: "Explore Browser Guard", href: "/extensions/browser", external: false };
  }
  if (IDE_PAGES.has(path)) {
    return { label: "Install the VS Code extension", href: VSCODE_MARKETPLACE_URL, external: true };
  }
  // API and platform pages: let the visitor try the engine first.
  return { label: PLAYGROUND_CTA_LABEL, href: "/playground", external: false };
}

/** Determine the secondary CTA based on page path. */
function secondaryCta(path: string): { label: string; href: string } {
  if (path === "/ai-user-security") {
    return { label: "Book a security review", href: "/contact-sales" };
  }
  if (IDE_PAGES.has(path)) {
    return { label: "Read the docs", href: "/docs/quickstart" };
  }
  if (path.includes("enterprise")) {
    return { label: "Book a security review", href: "/contact-sales" };
  }
  return { label: "Create a free account", href: "/signup" };
}

export interface FeatureLandingData {
  /** Site-relative path, e.g. "/mcp-security". */
  path: string;
  /** Short kicker above the H1. */
  eyebrow: string;
  /** Page H1. */
  h1: string;
  /** One-paragraph hero subtext. The first sentence should answer the page's question on its own. */
  intro: string;
  /** SoftwareApplication schema name. */
  productName: string;
  operatingSystem?: string;
  primaryCta?: { label: string; href: string; external: boolean };
  secondaryCta?: { label: string; href: string };
  scopeNote?: string;
  /** "What it does" bullets. */
  features: Array<{ title: string; body: string }>;
  /** "How it works" ordered steps. */
  how: Array<{ step: string; body: string }>;
  /** Optional educational sections for search intents that need more depth. */
  contentSections?: Array<{
    title: string;
    intro: string;
    items: Array<{ title: string; body: string }>;
  }>;
  /** Honest limitations: what the feature does NOT do. */
  limitations: string[];
  /** FAQ pairs (also emitted as FAQPage JSON-LD). */
  faqs: Array<{ q: string; a: string }>;
  /** Internal links to related soterai.in features and docs. */
  related: Array<{ label: string; href: string }>;
}

/**
 * Shared server-rendered layout for the AI-security topic pages.
 *
 * Built on the soterai.in design system. Each page passes its own content; this
 * component keeps the structure the same everywhere: an answer-first opening, what
 * it does, how it works, an example to try on the live engine, what it does not
 * stop (before the FAQ and the closing call to action, never after), the FAQ,
 * related pages, and the structured data (BreadcrumbList, SoftwareApplication,
 * FAQPage). The breadcrumb the reader sees is drawn by the site chrome.
 */
export function FeatureLanding({ data }: { data: FeatureLandingData }) {
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: data.h1, path: data.path },
  ]);
  const appLd = softwareApplicationLd({
    name: data.productName,
    description: data.intro,
    path: data.path,
    operatingSystem: data.operatingSystem,
  });
  const faqLd = faqPageLd(data.faqs);
  const cta = data.primaryCta ?? primaryCta(data.path);
  const secondary = data.secondaryCta ?? secondaryCta(data.path);
  const tryIt = TRY_PRESET[data.path];
  const isIde = IDE_PAGES.has(data.path);

  return (
    <SaRoot>
      <JsonLd data={breadcrumb} />
      <JsonLd data={appLd} />
      <JsonLd data={faqLd} />

      <main className="sa-page" style={{ paddingBlock: "var(--sa-space-7) var(--sa-space-9)" }}>
        <header>
          <p className="sa-eyebrow">{data.eyebrow}</p>
          <h1 className="sa-h1" style={{ marginTop: "var(--sa-space-3)" }}>
            {data.h1}
          </h1>
          <p className="sa-lede" style={{ marginTop: "var(--sa-space-4)" }}>
            {data.intro}
          </p>
          <div className="sa-hero__actions">
            {cta.external ? (
              <a href={cta.href} target="_blank" rel="noopener noreferrer" className="sa-btn sa-btn--primary sa-btn--lg">
                {cta.label}
              </a>
            ) : (
              <SaLinkButton href={cta.href} large>
                {cta.label}
              </SaLinkButton>
            )}
            <SaLinkButton href={secondary.href} variant="ghost">
              {secondary.label}
            </SaLinkButton>
          </div>
          {isIde ? (
            <p className="sa-muted" style={{ marginTop: "var(--sa-space-4)", fontSize: "var(--sa-text-sm)", maxWidth: "var(--sa-measure)" }}>
              {data.scopeNote ?? "Local checks cover supported SoterAI-managed actions. Independent AI traffic and direct file access require separate controls."}
              {" "}<Link className="sa-link" href="/limitations">Read the published limitations.</Link>
            </p>
          ) : null}
        </header>

        <section className="sa-section" aria-labelledby="does">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="does">
              What it does
            </h2>
          </div>
          <ul className="sa-rules sa-rules--2">
            {data.features.map((f) => (
              <li key={f.title}>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-section" aria-labelledby="how">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="how">
              How it works
            </h2>
          </div>
          <ol className="sa-steps">
            {data.how.map((s) => (
              <li key={s.step}>
                <div>
                  <h3>{s.step}</h3>
                  <p className="sa-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {data.contentSections?.map((section, i) => (
          <section key={section.title} className="sa-section" aria-labelledby={`extra-${i}`}>
            <div className="sa-section__head">
              <h2 className="sa-h2" id={`extra-${i}`}>
                {section.title}
              </h2>
              <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
                {section.intro}
              </p>
            </div>
            <ul className="sa-rules sa-rules--2">
              {section.items.map((item) => (
                <li key={item.title}>
                  <h3>{item.title}</h3>
                  <p>{item.body}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {tryIt ? (
          <section className="sa-section" aria-labelledby="try">
            <div className="sa-section__head">
              <h2 className="sa-h2" id="try">
                See it on {tryIt.label}
              </h2>
              <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
                The playground loads a sample into the text box. Nothing is sent until you press Check. It calls the
                same engine as the API and shows the verdict, the risk score and where it matched.
              </p>
            </div>
            <SaLinkButton href={`/playground?preset=${tryIt.id}`} variant="secondary">
              Open this example in the playground
            </SaLinkButton>
          </section>
        ) : null}

        {/* Limits come before the FAQ and the closing call to action on purpose:
            a reader who scrolls should meet the caveats before the sales pitch. */}
        <section className="sa-section" aria-labelledby="limits">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="limits">
              What it does not stop
            </h2>
            <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
              No security tool catches everything. These are the limits of this feature, so you can layer other
              defenses around it.
            </p>
          </div>
          <ul className="sa-limits">
            {data.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          <p className="sa-basis" style={{ marginTop: "var(--sa-space-5)", maxWidth: "var(--sa-measure)" }}>
            <span>{GENERAL_LIMIT}</span>
            <Link className="sa-link" href="/benchmarks">
              Numbers and their limits
            </Link>
            <Link className="sa-link" href="/limitations">
              Published limitations
            </Link>
          </p>
        </section>

        <section className="sa-section" aria-labelledby="faq">
          <div className="sa-section__head">
            <h2 className="sa-h2" id="faq">
              Questions
            </h2>
          </div>
          <Faq items={data.faqs.map((f) => ({ q: f.q, a: f.a }))} />
        </section>

        <section className="sa-section" aria-labelledby="related">
          <div className="sa-section__head">
            <h2 className="sa-h3" id="related">
              Related
            </h2>
          </div>
          <nav aria-labelledby="related">
            <ul className="sa-linklist sa-linklist--cols">
              {data.related.map((r) => (
                <li key={r.href}>
                  <Link href={r.href}>{r.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          {isIde ? (
            <>
              <h2 className="sa-h2" id="closing">
                Check your own editor context
              </h2>
              <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
                Install the extension, or paste a sample into the playground first. Use sample data, not real secrets.
              </p>
              <div className="sa-hero__actions">
                <a href={cta.href} target={cta.external ? "_blank" : undefined} rel={cta.external ? "noopener noreferrer" : undefined} className="sa-btn sa-btn--primary sa-btn--lg">
                  {cta.label}
                </a>
                <SaLinkButton href="/playground" variant="ghost">
                  {PLAYGROUND_CTA_LABEL}
                </SaLinkButton>
              </div>
            </>
          ) : (
            <>
              <h2 className="sa-h2" id="closing">
                Test it on text you already have
              </h2>
              <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
                The Free plan costs nothing and works anywhere. Use the playground first if you want to see a verdict
                before you create an account.
              </p>
              <div className="sa-hero__actions">
                <SaLinkButton href="/playground" large>
                  {PLAYGROUND_CTA_LABEL}
                </SaLinkButton>
                <SaLinkButton href="/signup" variant="ghost">
                  Create a free account
                </SaLinkButton>
              </div>
            </>
          )}
        </section>
      </main>
    </SaRoot>
  );
}
