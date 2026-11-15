import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsToc, DocsTocInline } from "@/components/docs/DocsToc";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { DOCS_SECTIONS } from "@/lib/docs/navigation";
import { SITE_URL } from "@/lib/seo/schema";

export const metadata: Metadata = {
  title: "Documentation: AI Security Integrations",
  description: "Integrate SoterAI with your AI workflow. Start with a guarded request, explore SDKs and API reference, and verify input and output handling.",
  alternates: { canonical: "/docs" },
  openGraph: {
    images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
    title: "SoterAI Documentation — AI Security Integration Guides",
    description: "Learn where to check prompts, model output, retrieved context and agent actions, with explicit integration boundaries.",
  },
};

const smallestExample = `// Server-side only. This key must never reach a browser bundle.
import { Soter } from "@soterai/core";

const soter = new Soter(); // Reads SOTER_API_KEY from the server environment.

// Only an explicit permission and a usable payload can continue.
function checkedText(result: {
  allowed: boolean; action: string; safeText?: string; redactedText?: string;
}, original: string): string | null {
  if (result.allowed !== true) return null;
  if (result.action === "ALLOW") {
    return result.safeText ?? result.redactedText ?? original;
  }
  if (result.action === "ALLOW_WITH_REDACTION" || result.action === "REWRITE") {
    const cleaned = result.safeText ?? result.redactedText;
    return typeof cleaned === "string" && cleaned.trim() ? cleaned : null;
  }
  return null; // BLOCK, HUMAN_REVIEW, or an unknown action.
}

const input = await soter.protect({ input: userMessage });
const safeInput = checkedText(input, userMessage);
if (safeInput === null) return { blocked: true, reply: "Request blocked." };

const reply = await callYourLLM(safeInput);
const output = await soter.guardOutput({ aiResponse: reply });
const safeOutput = checkedText(output, reply);
if (safeOutput === null) return { blocked: true, reply: "Response blocked." };

return { blocked: false, reply: safeOutput };`;

const faqs = [
  {
    q: "Where should the API key live?",
    a: "Server-side only, in an environment variable. A key in client JavaScript is publicly readable. Browser apps should call your own backend route, which then calls SoterAI.",
  },
  {
    q: "Can I use SoterAI without an SDK?",
    a: "Yes. The documented REST endpoints accept HTTPS requests, so you can integrate from Go, Java, PHP, C#, Ruby, Rust, or another language with an HTTP client. Check the API reference for each endpoint’s authentication requirements.",
  },
  {
    q: "Do I need both the input guard and the output guard?",
    a: "They check different boundaries. Input checks inspect text before the model runs; output checks inspect the generated reply before you release it. Neither check guarantees detection, and RAG context and agent tool calls need additional controls.",
  },
  {
    q: "How long does integration take?",
    a: "It depends on your stack, authentication, error handling, and test coverage. Begin with a single chat turn, then verify blocked, redacted, allowed, and unavailable paths before extending the integration. Guide times are estimates, not a completion promise.",
  },
  {
    q: "Does SoterAI guarantee my AI is secure?",
    a: "No. SoterAI is a defense-in-depth layer that reduces risk. It complements secure design, identity controls, monitoring, and human review; it does not replace them. No configuration makes an AI system completely secure.",
  },
];

export default function DocsHubPage() {
  return (
    <div className="docs-page-grid docs-hub">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
              { "@type": "ListItem", position: 2, name: "Documentation", item: `${SITE_URL}/docs` },
            ],
          },
          {
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question", name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          },
        ],
      }} />
      <article data-docs-article className="docs-article">
        <header className="docs-page-header">
          <p className="docs-eyebrow">SoterAI documentation</p>
          <h1 className="docs-title">Guard the full request path</h1>
          <p className="docs-summary">
            Check prompts, model responses, retrieved context, and agent actions.
            Learn where each check belongs—and what remains your application’s responsibility.
          </p>
        </header>

        <DocsTocInline />
        <div className="docs-body">
          <section aria-labelledby="docs-paths" className="docs-hub-start">
            <DocsHeading id="docs-paths">Start with one guarded request</DocsHeading>
            <div className="docs-start-panel">
              <div className="docs-start-primary">
                <p className="docs-small-label">Recommended path</p>
                <p>Install the SDK on your server, connect an API key, and test both sides of a model call.</p>
                <Link href="/docs/quickstart" className="docs-button docs-button-primary">
                  Open the quickstart <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
              <div className="docs-start-alternatives">
                <Link href="/docs/rest-api">
                  <span>Working in another language?<ArrowRight size={14} aria-hidden="true" /></span>
                  <span>Use the REST API</span>
                </Link>
                <Link href="/docs/best-practices">
                  <span>Before production<ArrowRight size={14} aria-hidden="true" /></span>
                  <span>Review security best practices</span>
                </Link>
              </div>
            </div>
          </section>

          <section aria-labelledby="docs-example" className="docs-section">
            <DocsHeading id="docs-example">Understand the request path</DocsHeading>
            <ol className="docs-request-flow" aria-label="Guarded request sequence">
              <li><span>01</span> Inspect input</li>
              <li><span>02</span> Call your model</li>
              <li><span>03</span> Inspect output</li>
            </ol>
            <p className="docs-example-note">
              <strong>Server-side pattern, not a complete route.</strong> You supply <code>userMessage</code>,
              your <code>callYourLLM</code> function, authentication, and error handling. Keep the key on the server.
              If a check fails or is unavailable, stop; never fall back to releasing unchecked text.
            </p>
            <CodeBlock language="typescript" title="guarded-chat.ts · server pattern" showLineNumbers>{smallestExample}</CodeBlock>
            <p className="docs-example-next">
              <Link href="/docs/quickstart">Add request handling and verification <ArrowRight size={14} aria-hidden="true" /></Link>
              <Link href="/docs/best-practices">Key-handling guidance</Link>
            </p>
          </section>

          <section aria-labelledby="docs-index" className="docs-section">
            <DocsHeading id="docs-index">Every guide</DocsHeading>
            <p className="docs-section-summary">Choose your stack or inspect a specific control. Each guide states its scope before the examples.</p>
            <div className="docs-guide-index">
              {DOCS_SECTIONS.map((section) => (
                <section key={section.id} className="docs-index-group" aria-label={section.label}>
                  <h3>{section.label}</h3>
                  <p>{section.caption}</p>
                  <ul>
                    {section.pages.filter((page) => page.href !== "/docs").map((page) => (
                      <li key={page.href}>
                        <Link href={page.href} className="docs-index-link">
                          <span>{page.label}<ArrowRight size={14} aria-hidden="true" /></span>
                          <span>{page.summary}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </section>

          <section aria-labelledby="docs-faq" className="docs-section">
            <DocsHeading id="docs-faq">Common questions</DocsHeading>
            <div className="docs-faq-list">
              {faqs.map((faq) => (
                <details key={faq.q}>
                  <summary>{faq.q}<ChevronDown size={16} aria-hidden="true" /></summary>
                  <p>{faq.a}</p>
                </details>
              ))}
            </div>
            <p className="docs-hub-help">
              Still stuck? <Link href="/support">Contact support</Link> or <Link href="/playground">try the guard without signing up</Link>.
            </p>
          </section>
        </div>
      </article>
      <aside className="docs-outline-rail"><DocsToc /></aside>
    </div>
  );
}

