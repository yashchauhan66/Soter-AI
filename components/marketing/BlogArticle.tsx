import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { articleLd, faqPageLd } from "@/lib/seo/metadata";
import { breadcrumbList } from "@/lib/seo/schema";
import type { BlogPostMeta } from "@/lib/blog/posts";
import { VSCODE_MARKETPLACE_URL } from "@/components/marketing/FeatureLanding";

/**
 * Prose wrapper: styles raw heading/paragraph/list children so blog posts can
 * be authored as plain JSX without a Markdown pipeline or the typography plugin.
 */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-10 max-w-3xl text-[15px] leading-7 text-slate-300
        [&_a]:text-cyan [&_a]:underline [&_a:hover]:opacity-80
        [&_code]:rounded [&_code]:bg-slate-800/70 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[13px] [&_code]:text-cyan
        [&_h2]:mt-12 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-slate-100
        [&_h3]:mt-8 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-slate-100
        [&_li]:mt-2 [&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:pl-6
        [&_p]:mt-4
        [&_pre]:mt-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-slate-800 [&_pre]:bg-slate-950/80 [&_pre]:p-4 [&_pre]:text-[13px]
        [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6"
    >
      {children}
    </div>
  );
}

/**
 * Shared article shell for blog posts: header, prose body, FAQ, install CTA,
 * and page-scoped Article + FAQPage + Breadcrumb structured data.
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

  return (
    <main className="container-page py-16">
      <JsonLd data={breadcrumb} />
      <JsonLd data={article} />
      <JsonLd data={faqPageLd(faqs)} />

      <article>
        <header className="max-w-3xl">
          <p className="eyebrow">SoterAI Blog</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            {meta.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <time dateTime={meta.datePublished}>{published}</time>
            <span aria-hidden>·</span>
            <span>{meta.readingTime}</span>
          </div>
        </header>

        <Prose>{children}</Prose>

        {/* FAQ */}
        <section className="mt-14 max-w-3xl">
          <h2 className="text-2xl font-bold">Frequently asked questions</h2>
          <div className="mt-6 space-y-6">
            {faqs.map((f) => (
              <div key={f.q}>
                <h3 className="font-semibold text-slate-100">{f.q}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mt-14 max-w-3xl rounded-2xl border border-cyan/20 bg-cyan/5 p-8">
          <h2 className="text-xl font-bold">Scan your AI context locally</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            SoterAI IDE Guard scans secrets, prompts, MCP tools, and terminal
            commands on your machine before they reach an AI model. Free to
            install, local by default.
          </p>
          <a
            href={VSCODE_MARKETPLACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-cyan px-5 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Install the VS Code extension <ArrowRight className="h-4 w-4" />
          </a>
        </section>

        <nav className="mt-12 max-w-3xl border-t border-slate-800 pt-6 text-sm">
          <Link href="/blog" className="text-cyan hover:opacity-80">
            ← Back to all posts
          </Link>
        </nav>
      </article>
    </main>
  );
}
