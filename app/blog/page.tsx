import type { Metadata } from 'next';
import Link from 'next/link';
import { PLAYGROUND_CTA_LABEL } from '@/lib/marketing/cta';
import { SaLinkButton } from '@/components/sa/primitives';
import { SaRoot } from '@/components/sa/SaRoot';
import { JsonLd } from '@/components/seo/JsonLd';
import { BLOG_POSTS } from '@/lib/blog/posts';
import { buildMetadata } from '@/lib/seo/metadata';
import { breadcrumbList } from '@/lib/seo/schema';

/**
 * Blog index. A ruled list sorted by date, not a stack of cards. Every post links to
 * the page it explains, so the blog feeds the topic pages instead of standing apart.
 *
 * Title: 47 characters with the brand suffix. Description: 149.
 */
export const metadata: Metadata = buildMetadata({
  title: 'Blog: AI Security Notes for Developers',
  description:
    'Practical writing on prompt injection, secret and data leakage, MCP tool permissions and agent security. Numbers come with their tests and limits.',
  path: '/blog',
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function BlogIndexPage() {
  const posts = [...BLOG_POSTS].sort((a, b) => b.datePublished.localeCompare(a.datePublished));

  return (
    <SaRoot>
      <JsonLd
        data={breadcrumbList([
          { name: 'Home', path: '/' },
          { name: 'Blog', path: '/blog' },
        ])}
      />
      <main className="sa-page" style={{ paddingBlock: 'var(--sa-space-7) var(--sa-space-9)' }}>
        <header>
          <p className="sa-eyebrow">Blog</p>
          <h1 className="sa-h1" style={{ marginTop: 'var(--sa-space-3)' }}>
            AI security notes for developers.
          </h1>
          <p className="sa-lede" style={{ marginTop: 'var(--sa-space-4)' }}>
            How secrets leak, what a prompt filter misses, and why tool permissions matter. Each post shows its test, its numbers
            and what it does not prove.
          </p>
        </header>

        <section className="sa-section" aria-labelledby="posts">
          <h2 className="sa-h2" id="posts" style={{ marginBottom: 'var(--sa-space-5)' }}>
            All posts
          </h2>
          <ul className="sa-postlist">
            {posts.map((post) => (
              <li key={post.slug}>
                <p className="sa-postlist__meta">
                  <time dateTime={post.datePublished}>{formatDate(post.datePublished)}</time>
                  <br />
                  {post.readingTime}
                </p>
                <div>
                  <h2>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </h2>
                  <p className="sa-body">{post.excerpt}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="sa-closing" aria-labelledby="closing">
          <h2 className="sa-h2" id="closing">
            Run the examples yourself.
          </h2>
          <p className="sa-body" style={{ marginTop: 'var(--sa-space-3)' }}>
            The playground runs the same engine the posts describe. Use sample data, not real secrets.
          </p>
          <div className="sa-hero__actions">
            <SaLinkButton href="/playground" large>
              {PLAYGROUND_CTA_LABEL}
            </SaLinkButton>
            <SaLinkButton href="/benchmarks" variant="ghost">
              Read the numbers
            </SaLinkButton>
          </div>
        </section>
      </main>
    </SaRoot>
  );
}
