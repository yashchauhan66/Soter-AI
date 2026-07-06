import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { buildMetadata } from "@/lib/seo/metadata";
import { BLOG_POSTS } from "@/lib/blog/posts";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI Blog — Technical AI Security for Developers",
  description:
    "Practical, honest writing on AI coding security: secret leakage, the AI context firewall pattern, MCP tool permissions, and prompt-injection defense.",
  path: "/blog",
});

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) =>
    b.datePublished.localeCompare(a.datePublished),
  );

  return (
    <main className="container-page py-16">
      <section className="max-w-3xl">
        <p className="eyebrow">Blog</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Technical AI security for developers
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Practical, honest writing on securing AI coding tools — how secrets
          leak, what an AI context firewall actually does, and why MCP tool
          permissions matter. No hype, no absolute claims.
        </p>
      </section>

      <section className="mt-12 grid gap-6">
        {posts.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group rounded-2xl border border-slate-800 bg-panel/40 p-6 transition hover:border-cyan/40"
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <time dateTime={post.datePublished}>
                {new Date(post.datePublished).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              <span aria-hidden>·</span>
              <span>{post.readingTime}</span>
            </div>
            <h2 className="mt-3 text-xl font-bold text-slate-100 group-hover:text-cyan">
              {post.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {post.excerpt}
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-cyan">
              Read post <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </section>
    </main>
  );
}
