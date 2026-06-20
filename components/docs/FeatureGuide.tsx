import { CodeBlock } from "@/components/ui/CodeBlock";

interface FeatureGuideSection {
  heading: string;
  body: string;
}

interface FeatureGuideProps {
  /** Short eyebrow label (e.g. "Agent security") */
  eyebrow: string;
  /** Feature name */
  title: string;
  /** One-line description of what this feature does */
  description: string;
  /** Longer paragraph explaining the use case and why users need it */
  useCase: string;
  /** How it works: array of numbered steps */
  howItWorks: FeatureGuideSection[];
  /** Integration code example (shown in a copy-paste section) */
  integrationCode?: string;
  /** Language label for the code block (default "typescript") */
  codeLanguage?: string;
  /** Warning / tip callout (shown as an amber card) */
  callout?: string;
  /** Links to related docs pages */
  relatedDocs?: Array<{ label: string; href: string }>;
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
}: FeatureGuideProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mt-3 max-w-3xl text-lg leading-7 text-slate-400">
          {description}
        </p>
      </div>

      {/* Use case / Why this matters */}
      <section className="card border-cyan/20 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan">
          Why this matters
        </h2>
        <p className="mt-3 leading-7 text-slate-300">{useCase}</p>
      </section>

      {/* How it works */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          How it works
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {howItWorks.map((step, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-800 bg-slate-950/30 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan/10 text-xs font-bold text-cyan">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-sm">{step.heading}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Integration code */}
      {integrationCode && (
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Copy-paste integration
          </h2>
          <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
            <strong>Important:</strong> API keys must stay server-side. Never
            expose them in client-side code.
          </div>
          <CodeBlock language={codeLanguage} className="mt-4">
            {integrationCode}
          </CodeBlock>
        </section>
      )}

      {/* Callout */}
      {callout && (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
          {callout}
        </section>
      )}

      {/* Related docs */}
      {relatedDocs && relatedDocs.length > 0 && (
        <section className="card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Related docs
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedDocs.map((doc) => (
              <a
                key={doc.href}
                href={doc.href}
                className="rounded-lg border border-slate-800 px-3 py-2 text-xs text-slate-400 transition hover:border-cyan/50 hover:text-cyan"
              >
                {doc.label} →
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
