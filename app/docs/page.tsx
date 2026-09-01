import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, KeyRound, MousePointerClick, ShieldCheck, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { DOCS_SECTIONS } from "@/lib/docs/navigation";
import { SITE_URL } from "@/lib/seo/schema";

/**
 * Documentation hub.
 *
 * The previous hub was a 290-line wall: a hero, a 4-step aside, a code block, a
 * product-status grid, a 6-card language grid, an 11-item platform list, three
 * "why our docs are good" cards, and a 12-chip link cloud. Every guide appeared
 * two or three times across those sections, so the page answered "what exists?"
 * loudly and "where do I start?" not at all.
 *
 * It is now built around one decision — *what are you here to do?* — with three
 * paths, then the smallest working example, then the guide index rendered from
 * `DOCS_SECTIONS` so it can never drift from the sidebar.
 *
 * The self-congratulatory "For beginners / Security first / Any language" cards
 * are gone: they described the docs rather than helping anyone use the product.
 * Product-status chips are gone too — they belong on /pricing and the Features
 * section, where a reader is evaluating rather than integrating.
 */

export const metadata: Metadata = {
  title: "SoterAI Documentation: Guard Your First AI Request in 5 Minutes",
  description:
    "Integration guides for SoterAI AI security. Quickstart, JavaScript and Python SDKs, REST API for any language, Next.js, Express, FastAPI, RAG, WordPress, WhatsApp, Intercom, Zendesk, and Botpress — each with setup steps, working code, and an honest scope note.",
  alternates: { canonical: "/docs" },
  openGraph: {
    title: "SoterAI Documentation — AI Security Integration Guides",
    description:
      "Guard prompts, outputs, retrieved context, and agent tool calls. Start with the 5-minute quickstart, or jump straight to your language.",
  },
};

/** The three reasons someone opens these docs, in the order they occur. */
const paths = [
  {
    href: "/docs/quickstart",
    icon: MousePointerClick,
    eyebrow: "Start here",
    title: "I want to guard my first request",
    copy: "Install, set a key, wrap one call, and verify it blocks a real prompt injection.",
    cta: "Open the quickstart",
    minutes: 5,
    primary: true,
  },
  {
    href: "/docs/rest-api",
    icon: Terminal,
    eyebrow: "Any language",
    title: "I don't use JavaScript or Python",
    copy: "The REST API works from Go, Java, PHP, C#, Ruby, Rust — anything that speaks HTTPS.",
    cta: "See the REST API",
    minutes: 7,
  },
  {
    href: "/docs/best-practices",
    icon: ShieldCheck,
    eyebrow: "Before production",
    title: "I'm already integrated",
    copy: "Key handling, fail-closed defaults, webhook verification, and OWASP LLM alignment.",
    cta: "Review best practices",
    minutes: 9,
  },
];

const smallestExample = `// Server-side only. This key must never reach a browser bundle.
import { Soter } from "@soterai/core";

const soter = new Soter({ apiKey: process.env.SOTER_API_KEY });

// 1. Inspect the user's message before the model ever sees it.
const input = await soter.protect({ input: userMessage });

if (!input.allowed) {
  // Blocked — do not call the LLM at all.
  return { blocked: true, reason: input.reason };
}

// 2. Call your model with the sanitised text.
const reply = await callYourLLM(input.safeText ?? userMessage);

// 3. Inspect the model's answer before the user sees it.
const output = await soter.guardOutput({ aiResponse: reply });

return { reply: output.safeText ?? reply, riskScore: output.riskScore };`;

const faqs = [
  {
    q: "Where should the API key live?",
    a: "Server-side only, in an environment variable. Never in frontend or browser code — a key in client JavaScript is publicly readable. Browser apps should call your own backend route, and that route calls SoterAI.",
  },
  {
    q: "Can I use SoterAI without an SDK?",
    a: "Yes. The REST API works from any language that can make an HTTPS request, including Java, Go, PHP, C#, Ruby, Rust, Swift, Kotlin, and shell scripts.",
  },
  {
    q: "Do I need both the input guard and the output guard?",
    a: "Yes, for meaningful coverage. The input guard stops prompt injection and sensitive data before the model runs; the output guard catches leaked instructions, secrets, and unsafe content in the response. Using only one leaves half the path unchecked.",
  },
  {
    q: "How long does integration take?",
    a: "About five minutes for a single guarded chat route: install the SDK, set the key, wrap the call, and test with an attack prompt. Agent tool calls and RAG pipelines take longer because there is more surface to cover.",
  },
  {
    q: "Does SoterAI guarantee my AI is secure?",
    a: "No. SoterAI is a defense-in-depth layer that reduces risk. It complements secure design, identity controls, monitoring, and human review — it does not replace them, and no configuration makes an AI system completely secure.",
  },
];

export default function DocsHubPage() {
  return (
    <>
      <JsonLd
        data={{
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
                "@type": "Question",
                name: faq.q,
                acceptedAnswer: { "@type": "Answer", text: faq.a },
              })),
            },
          ],
        }}
      />

      <header>
        <p className="eyebrow">Documentation</p>
        <h1 className="heading-1 mt-3">Guard your first AI request in five minutes</h1>
        <p className="lede mt-4">
          SoterAI inspects prompts, model output, retrieved context, and agent tool calls. These guides show exactly
          where to put each check — and state plainly what each one does not cover.
        </p>
      </header>

      {/* Three paths instead of a link cloud. A docs hub's job is to route, and a
          reader can only be in one of these three situations. */}
      <section aria-labelledby="docs-paths" className="mt-10">
        <h2 id="docs-paths" className="sr-only">
          Choose where to start
        </h2>

        <div className="grid gap-4">
          {paths.map((path) => {
            const Icon = path.icon;
            return (
              <Link
                key={path.href}
                href={path.href}
                className={`card card-interactive group flex items-start gap-4 p-5 ${
                  path.primary ? "border-cyan/40" : ""
                }`}
              >
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                    path.primary
                      ? "border-cyan/40 bg-cyan/10 text-cyan"
                      : "border-slate-700 bg-slate-900/70 text-slate-300"
                  }`}
                >
                  <Icon size={19} aria-hidden="true" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-micro text-cyan">{path.eyebrow}</span>
                    <span data-numeric className="text-[10px] text-slate-500">
                      {path.minutes} min
                    </span>
                  </span>
                  <span className="mt-1 block text-base font-semibold text-slate-100">{path.title}</span>
                  <span className="mt-1 block text-sm leading-6 text-slate-400">{path.copy}</span>
                  <span className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
                    {path.cta}
                    <ArrowRight
                      size={14}
                      aria-hidden="true"
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>


      {/* The whole product in one screen of code. Placed above the index because
          a developer evaluating the docs wants to see the shape of the API before
          committing to a guide. */}
      <section aria-labelledby="docs-example" className="mt-14">
        <h2 id="docs-example" className="heading-3">
          The whole integration, in one file
        </h2>
        <p className="body-copy mt-3">
          Three calls: inspect the input, call your model, inspect the output. Everything else in these docs is a
          variation on this shape.
        </p>

        <CodeBlock language="typescript" title="server route" showLineNumbers>
          {smallestExample}
        </CodeBlock>

        <div className="tip-card mt-4 flex gap-3">
          <KeyRound size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-cyan" />
          <p>
            The key belongs in a server environment variable. Put it in a client bundle and anyone can read it from your
            site — this is the single most common integration mistake.{" "}
            <Link href="/docs/best-practices" className="font-semibold text-cyan hover:underline">
              How to handle keys properly
            </Link>
          </p>
        </div>
      </section>

      {/* Guide index, rendered from DOCS_SECTIONS so it can never disagree with
          the sidebar. Previously the same guides were listed in three different
          hand-maintained arrays on this page. */}
      <section aria-labelledby="docs-index" className="mt-16">
        <div className="flex items-center gap-2.5">
          <Compass size={18} aria-hidden="true" className="text-cyan" />
          <h2 id="docs-index" className="heading-3">
            Every guide
          </h2>
        </div>
        <p className="body-copy mt-3">
          Each one states what it covers, how long it takes, and what it deliberately leaves out.
        </p>

        <div className="mt-8 space-y-10">
          {DOCS_SECTIONS.map((section) => {
            const SectionIcon = section.icon;

            return (
              <div key={section.id}>
                <div className="flex items-center gap-2">
                  <SectionIcon size={15} aria-hidden="true" className="shrink-0 text-cyan" />
                  <h3 className="text-sm font-bold uppercase tracking-micro text-slate-200">{section.label}</h3>
                </div>
                <p className="mt-1 text-sm text-slate-500">{section.caption}</p>

                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {section.pages
                    // The hub appears in the sidebar tree; listing it here would
                    // be a link to the page the reader is already on.
                    .filter((page) => page.href !== "/docs")
                    .map((page) => (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          className="surface group flex h-full flex-col p-4 transition-colors hover:border-cyan/40"
                        >
                          <span className="flex items-start justify-between gap-3">
                            <span className="font-semibold text-slate-100 group-hover:text-cyan">{page.label}</span>
                            <span data-numeric className="shrink-0 text-[10px] text-slate-500">
                              {page.minutes} min
                            </span>
                          </span>
                          <span className="mt-1.5 text-sm leading-6 text-slate-400">{page.summary}</span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>


      <section aria-labelledby="docs-faq" className="mt-16 border-t border-slate-800 pt-10">
        <h2 id="docs-faq" className="heading-3">
          Common questions
        </h2>

        {/* Native <details> so every answer ships in the initial HTML — crawlable,
            no client JS, and expandable before hydration. */}
        <div className="mt-6 space-y-3">
          {faqs.map((faq) => (
            <details
              key={faq.q}
              className="group overflow-hidden rounded-card border border-slate-800 bg-slate-950/50 open:border-cyan/40"
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 p-4 text-sm font-semibold text-slate-100 transition-colors hover:text-cyan">
                {faq.q}
                <ArrowRight
                  size={14}
                  aria-hidden="true"
                  className="shrink-0 text-cyan transition-transform group-open:rotate-90"
                />
              </summary>
              <p className="border-t border-slate-800/70 p-4 text-sm leading-7 text-slate-300">{faq.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-8 text-sm text-slate-400">
          Still stuck?{" "}
          <Link href="/support" className="font-semibold text-cyan hover:underline">
            Contact support
          </Link>{" "}
          or{" "}
          <Link href="/playground" className="font-semibold text-cyan hover:underline">
            try the guard without signing up
          </Link>
          .
        </p>
      </section>
    </>
  );
}

