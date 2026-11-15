import Link from "next/link";
import { ArrowLeft, ArrowRight, Mail } from "lucide-react";
import { DocsToc, DocsTocInline } from "@/components/docs/DocsToc";
import { JsonLd } from "@/components/seo/JsonLd";
import { findDocsPage, findDocsSection, getDocsNeighbours } from "@/lib/docs/navigation";
import { getDocsScope } from "@/lib/docs/scope";
import { SITE_URL } from "@/lib/seo/schema";

/** Shared reading language. Guide bodies retain their content and anchors. */
export function DocsPageShell({
  path,
  children,
  jsonLd,
}: {
  path: string;
  children: React.ReactNode;
  /** Page-specific structured data; the breadcrumb always comes from navigation. */
  jsonLd?: unknown;
}) {
  const page = findDocsPage(path);
  const section = findDocsSection(path);
  const scope = getDocsScope(path);
  const { previous, next } = getDocsNeighbours(path);

  if (!page) {
    throw new Error(
      `DocsPageShell: "${path}" is missing from DOCS_SECTIONS in lib/docs/navigation.ts. ` +
        "Add it there so the sidebar, search, and pager stay in sync.",
    );
  }

  return (
    <div className="docs-page-grid">
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
      {jsonLd !== undefined && <JsonLd data={jsonLd} />}

      <article data-docs-article className="docs-article">
        <header className="docs-page-header">
          {section && <p className="docs-eyebrow">{section.label}</p>}
          <h1 className="docs-title">{page.label}</h1>
          <p className="docs-summary">{page.summary}</p>
          <div className="docs-page-meta">
            <span>Hands-on estimate · {page.minutes} min</span>
            {page.recommended && <span className="docs-start-label">Recommended starting point</span>}
          </div>
        </header>

        {/* Editorial scope stays open and before every example, not in a
            disclosure or below the fold after code. */}
        {scope && scope.length > 0 && (
          <section aria-labelledby="docs-scope" className="docs-scope">
            <h2 id="docs-scope">What this guide does not cover</h2>
            <ul>{scope.map((item) => <li key={item}>{item}</li>)}</ul>
          </section>
        )}

        <DocsTocInline />
        <div className="docs-body">{children}</div>

        <nav aria-label="Guide navigation" className="docs-guide-footer">
          <div className="docs-pager">
            {previous ? (
              <Link href={previous.href} className="docs-pager-link">
                <span><ArrowLeft size={14} aria-hidden="true" /> Previous guide</span>
                <strong>{previous.label}</strong>
              </Link>
            ) : <span aria-hidden="true" />}
            {next && (
              <Link href={next.href} className="docs-pager-link docs-pager-next">
                <span>Next guide <ArrowRight size={14} aria-hidden="true" /></span>
                <strong>{next.label}</strong>
              </Link>
            )}
          </div>
          <div className="docs-feedback">
            <p>Something unclear? <Link href="/support">Tell us</Link>.</p>
            <a href="mailto:support@soterai.in?subject=Docs%20feedback">
              <Mail size={14} aria-hidden="true" /> Suggest an edit
            </a>
          </div>
        </nav>
      </article>
      <aside className="docs-outline-rail"><DocsToc /></aside>
    </div>
  );
}
