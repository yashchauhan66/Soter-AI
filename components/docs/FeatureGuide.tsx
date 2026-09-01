import { CodeBlock } from "@/components/ui/CodeBlock";
import { PageHeader } from "@/components/dashboard/PageHeader";

/**
 * In-product feature explainer, used at the top of 52 dashboard pages.
 *
 * Two structural problems this fixes.
 *
 * **1. It duplicated the page header.** It rendered its own eyebrow + `<h1>` +
 * description, which is why the 46 dashboard pages using `FeatureGuide` could not
 * be migrated to `PageHeader` by the header codemod — they already had a header,
 * just a second implementation of one. It now delegates to `PageHeader`, so all
 * 84 pages share one heading treatment.
 *
 * **2. Everything was expanded, always.** "Why this matters" plus a four-step
 * "how it works" grid plus a code block sat above the actual working panels on
 * every visit. That is genuinely useful the first time and pure friction the
 * fiftieth: an operator opening Escrow to approve a pending transaction had to
 * scroll past ~400px of explanation to reach the queue.
 *
 * The explainer is now a collapsed `<details>` below the header. Native
 * `<details>` keeps the copy in the DOM — still crawlable, still findable with
 * ⌘F, no client JS — while putting the operational content first.
 */

interface FeatureGuideSection {
  heading: string;
  body: string;
}

interface FeatureGuideProps {
  /** Short eyebrow label (e.g. "Agent security"). */
  eyebrow: string;
  /** Feature name. Becomes the page H1. */
  title: string;
  /** One-line description of what this feature does. */
  description: string;
  /** Longer paragraph explaining the use case and why it matters. */
  useCase: string;
  /** Numbered explanation steps. */
  howItWorks: FeatureGuideSection[];
  /** Integration example, shown inside the collapsed explainer. */
  integrationCode?: string;
  codeLanguage?: string;
  /** Constraint or caveat, rendered as an amber callout. */
  callout?: string;
  relatedDocs?: Array<{ label: string; href: string }>;
  /** Page-level controls (project switcher, primary action) for the header. */
  actions?: React.ReactNode;
}

export function FeatureGuide({
  eyebrow,
  title,
  description,
  useCase,
  howItWorks,
  integrationCode,
  codeLanguage = "typescript",
  callout,
  relatedDocs,
  actions,
}: FeatureGuideProps) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />

      <details className="group surface mb-8 overflow-hidden">
        <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-sm font-medium text-slate-300 transition-colors hover:text-cyan">
          <span>
            How {title.toLowerCase()} works, and why it matters
          </span>
          {/* Text rather than an icon: "Show"/"Hide" states what the control does,
              which a rotating chevron alone does not. */}
          <span className="shrink-0 text-xs text-slate-500">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </summary>

        <div className="space-y-6 border-t border-slate-800 p-5">
          <section>
            <h2 className="text-xs font-bold uppercase tracking-micro text-cyan">Why this matters</h2>
            <p className="mt-2.5 max-w-prose leading-7 text-slate-300">{useCase}</p>
          </section>

          <section>
            <h2 className="text-xs font-bold uppercase tracking-micro text-slate-300">How it works</h2>
            <ol className="mt-3 grid gap-3 md:grid-cols-2">
              {howItWorks.map((step, index) => (
                <li key={step.heading} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="flex items-center gap-3">
                    <span
                      data-numeric
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan/10 text-xs font-bold text-cyan"
                    >
                      {index + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100">{step.heading}</h3>
                  </div>
                  <p className="mt-2.5 text-sm leading-6 text-slate-400">{step.body}</p>
                </li>
              ))}
            </ol>
          </section>

          {integrationCode && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-micro text-slate-300">Integration</h2>
              <div className="warn-card mt-3">
                <strong className="font-semibold">API keys must stay server-side.</strong> A key in client code is
                publicly readable by anyone who opens your site.
              </div>
              <CodeBlock language={codeLanguage} className="mt-3">
                {integrationCode}
              </CodeBlock>
            </section>
          )}

          {callout && <div className="warn-card">{callout}</div>}

          {relatedDocs && relatedDocs.length > 0 && (
            <section>
              <h2 className="text-xs font-bold uppercase tracking-micro text-slate-300">Related docs</h2>
              <nav aria-label="Related documentation" className="mt-3 flex flex-wrap gap-2">
                {relatedDocs.map((doc) => (
                  <a
                    key={doc.href}
                    href={doc.href}
                    className="badge-neutral transition-colors hover:border-cyan/50 hover:text-cyan"
                  >
                    {doc.label}
                  </a>
                ))}
              </nav>
            </section>
          )}
        </div>
      </details>
    </>
  );
}
