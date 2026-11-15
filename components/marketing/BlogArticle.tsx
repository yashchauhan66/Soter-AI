import Link from "next/link";
import { PLAYGROUND_CTA_LABEL } from "@/lib/marketing/cta";
import { FocusableOverflow } from "@/components/sa/FocusableOverflow";
import { Faq } from "@/components/sa/Faq";
import { SaLinkButton } from "@/components/sa/primitives";
import { SaRoot } from "@/components/sa/SaRoot";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleLd, faqPageLd } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { VSCODE_MARKETPLACE_URL } from "@/components/marketing/FeatureLanding";

/**
 * Prose wrapper: styles raw heading, paragraph, list, code and table children so blog
 * posts can be authored as plain JSX without a Markdown pipeline. Styles live under
 * `.sa-prose` in components/sa/sa.css.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return <div className="sa-prose">{children}</div>;
}

/** Tags that mean the post is about coding assistants, where the IDE extension is relevant. */
const IDE_TAGS = new Set(["secret-scanning", "ai-coding", "mcp", "mcp-security"]);

/**
 * Shared article shell for blog posts: header with author and date, prose body, FAQ,
 * a closing call to action, and page-scoped BlogPosting + FAQPage + Breadcrumb data.
 *
 * The FAQ list is drawn from the same array as the FAQPage schema, so the visible text
 * and the markup cannot differ.
 */
export function BlogArticle({
  meta,
  faqs,
  children,
}: {
  meta: BlogPostMeta;
  faqs: Array<{ q: string; a: string }>;
  children: React.ReactNode;
}) {
  const path = `/blog/${meta.slug}`;
  const breadcrumb = breadcrumbList([
    { name: "Home", path: "/" },
    { name: "Blog", path: "/blog" },
    { name: meta.title, path },
  ]);
  const article = articleLd({
    headline: meta.title,
    description: meta.description,
    path,
    datePublished: meta.datePublished,
  });

  const published = new Date(meta.datePublished).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  const ideRelevant = meta.tags.some((t) => IDE_TAGS.has(t));

  return (
    <SaRoot>
      <JsonLd data={breadcrumb} />
      <JsonLd data={article} />
      <JsonLd data={faqPageLd(faqs)} />

      <main className="sa-page" style={{ paddingBlock: "var(--sa-space-7) var(--sa-space-9)" }}>
        <article>
          <header>
            <p className="sa-eyebrow">
              <Link href="/blog" className="sa-link">
                Blog
              </Link>
            </p>
            <h1 className="sa-h1" style={{ marginTop: "var(--sa-space-3)", maxWidth: "22ch" }}>
              {meta.title}
            </h1>
            <p className="sa-article-meta" style={{ marginTop: "var(--sa-space-4)" }}>
              <span>
                By <Link href="/about" className="sa-link">Yash Chauhan</Link>
              </span>
              <time dateTime={meta.datePublished}>{published}</time>
              <span>{meta.readingTime}</span>
            </p>
          </header>

          <div style={{ marginTop: "var(--sa-space-6)" }}>
            <Prose>{children}</Prose>
            <FocusableOverflow />
          </div>

          <section className="sa-section" aria-labelledby="faq">
            <div className="sa-section__head">
              <h2 className="sa-h2" id="faq">
                Questions
              </h2>
            </div>
            <Faq items={faqs.map((f) => ({ q: f.q, a: f.a }))} />
          </section>

          <section className="sa-closing" aria-labelledby="closing">
            <h2 className="sa-h2" id="closing">
              Test it on text you already have.
            </h2>
            <p className="sa-body" style={{ marginTop: "var(--sa-space-3)" }}>
              The playground runs the real engine and shows the verdict, the risk score and where it matched. Use sample data, not real
              secrets.
            </p>
            <div className="sa-hero__actions">
              <SaLinkButton href="/playground" large>
                {PLAYGROUND_CTA_LABEL}
              </SaLinkButton>
              {ideRelevant ? (
                <a href={VSCODE_MARKETPLACE_URL} target="_blank" rel="noopener noreferrer" className="sa-btn sa-btn--ghost">
                  Install the VS Code extension (Beta)
                </a>
              ) : (
                <SaLinkButton href="/limitations" variant="ghost">
                  Read what it misses
                </SaLinkButton>
              )}
            </div>
          </section>
        </article>
      </main>
    </SaRoot>
  );
}
