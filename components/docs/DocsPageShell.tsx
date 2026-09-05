import Link from "next/link";
import { ArrowLeft, ArrowRight, Clock, Mail, ShieldAlert } from "lucide-react";
import { DocsToc, DocsTocInline } from "@/components/docs/DocsToc";
import { JsonLd } from "@/components/seo/JsonLd";
import { findDocsPage, findDocsSection, getDocsNeighbours } from "@/lib/docs/navigation";
import { getDocsScope } from "@/lib/docs/scope";
import { SITE_URL } from "@/lib/seo/schema";

/**
 * Shared shell for a single documentation guide.
 *
 * Every one of the 18 guides previously hand-rolled its own back-link, eyebrow,
 * H1, intro paragraph, breadcrumb JSON-LD, and footer pager — roughly 30
 * duplicated lines per page, which is exactly why the headings, spacing, and
 * structured data had already drifted apart between them.
 *
 * This component owns:
 *   - the page header (section label, H1, summary, hands-on time estimate)
 *   - `BreadcrumbList` JSON-LD derived from the navigation tree, so it can never
 *     disagree with the sidebar
 *   - the "what this guide does not cover" scope note from `lib/docs/scope.ts`
 *   - the "On this page" rail, and its collapsed equivalent on narrow viewports
 *   - the previous/next pager and a feedback / edit affordance
 *
 * Server component apart from the table of contents, which has to read the
 * rendered headings out of the DOM.
 */
export function DocsPageShell({
  path,
  children,
  jsonLd,
}: {
  path: string;
  children: React.ReactNode;
  /**
   * Extra page-scoped structured data, emitted alongside the breadcrumb graph.
   *
   * Exists so a guide can add a genuinely page-specific type — the quickstart's
   * `HowTo` graph, for example — without going back to hand-rolling its own
   * `<script>` tag and re-importing `safeJsonLd`. Breadcrumbs are never passed
   * here: the shell derives those from the navigation tree so they cannot drift.
   */
  jsonLd?: unknown;
}) {
  const page = findDocsPage(path);
  const section = findDocsSection(path);
  const scope = getDocsScope(path);
  const { previous, next } = getDocsNeighbours(path);

  // A guide missing from the navigation tree would be unreachable from the
  // sidebar and would emit a breadcrumb with no parent. Fail loudly at build
  // time rather than shipping an orphan page.
  if (!page) {
    throw new Error(
      `DocsPageShell: "${path}" is missing from DOCS_SECTIONS in lib/docs/navigation.ts. ` +
        "Add it there so the sidebar, search, and pager stay in sync.",
    );
  }

  return (
    // Two tracks at `xl`: the reading column and the "On this page" rail.
    //
    // The article narrows from 768px to 672px to make room, which is a gain in
    // both directions — 672px is closer to the 66-character measure long-form copy
    // wants, and the space it gives up returns a persistent outline. Below `xl`
    // there is not enough room inside `.container-page` for a third column, so the
    // rail collapses into `DocsTocInline` above the body instead.
    //
    // The rail track is rendered even when `DocsToc` finds no headings. Collapsing
    // it conditionally would mean the article measure changed after hydration,
    // which is a visible reflow on every page load; a stable column is worth an
    // occasionally empty one.
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-10">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Documentation", item: `${SITE_URL}/docs` },
            { "@type": "ListItem", position: 3, name: page.label, item: `${SITE_URL}${page.href}` },
          ],
        }}
      />

      {/* `jsonLd !== undefined` rather than a truthiness check: `jsonLd` is typed
          `unknown`, and `unknown && <JSX/>` evaluates to `unknown`, which is not a
          valid ReactNode. */}
      {jsonLd !== undefined && <JsonLd data={jsonLd} />}

      {/* `min-w-0` keeps a wide `<pre>` from growing the grid track instead of
          scrolling inside itself. `data-docs-article` is what DocsToc measures
          reading progress against — the document would include the footer, which
          is roughly a screen tall here. */}
      <article data-docs-article className="min-w-0 max-w-3xl">
        <header>
          {section && <p className="eyebrow">{section.label}</p>}
          <h1 className="heading-1 mt-3">{page.label}</h1>
          <p className="lede mt-4">{page.summary}</p>

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Clock size={13} aria-hidden="true" />
              {/* Hands-on time, not reading time — see lib/docs/navigation.ts. */}
              About {page.minutes} minutes hands-on
            </span>
            {page.recommended && <span className="badge-brand">Start here</span>}
          </div>
        </header>

        {/* Scope note, placed before the body so expectations are set before any
            code is copied — not in a footnote after it. */}
        {scope && scope.length > 0 && (
          <section aria-labelledby="docs-scope" className="warn-card mt-8">
            <h2 id="docs-scope" className="flex items-center gap-2 font-semibold text-amber-200">
              <ShieldAlert size={15} aria-hidden="true" className="shrink-0" />
              What this guide does not cover
            </h2>
            <ul className="mt-2 space-y-1.5">
              {scope.map((item) => (
                <li key={item} className="flex gap-2 text-amber-100/90">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        <DocsTocInline />

        <div className="mt-10">{children}</div>

        {/* Pager. Previously every guide ended in a dead stop, forcing a trip back
            to the hub to continue reading. */}
        <nav aria-label="Guide navigation" className="mt-16 border-t border-slate-800 pt-8">
          <div className="grid gap-3 sm:grid-cols-2">
            {previous ? (
              <Link href={previous.href} className="card card-interactive group p-4">
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <ArrowLeft size={13} aria-hidden="true" className="transition-transform group-hover:-translate-x-0.5" />
                  Previous
                </span>
                <span className="mt-1.5 block font-semibold text-slate-100">{previous.label}</span>
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}

            {next && (
              <Link href={next.href} className="card card-interactive group p-4 sm:text-right">
                <span className="flex items-center gap-1.5 text-xs text-slate-400 sm:justify-end">
                  Next
                  <ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1.5 block font-semibold text-slate-100">{next.label}</span>
              </Link>
            )}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
            <p>
              Something wrong or unclear here?{" "}
              <Link href="/support" className="font-semibold text-cyan hover:underline">
                Tell us
              </Link>{" "}
              — docs bugs are treated as product bugs.
            </p>
            <a
              href="mailto:support@soterai.in?subject=Docs%20feedback"
              className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-cyan"
            >
              <Mail size={13} aria-hidden="true" />
              Suggest an edit
            </a>
          </div>
        </nav>
      </article>

      <div className="hidden xl:block">
        <DocsToc />
      </div>
    </div>
  );
}
