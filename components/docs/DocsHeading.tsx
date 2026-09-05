import { Hash } from "lucide-react";
import { docsSlug } from "@/lib/docs/slug";

/**
 * A section heading inside a documentation guide.
 *
 * Replaces the 89 hand-written `<h2 className="text-2xl font-bold">` headings
 * across the 17 guides. Three things were wrong with those, none of which shows
 * up in a diff:
 *
 * 1. **No `id`.** `.docs-section` already carried `scroll-mt-24`, so the intent
 *    to be an anchor target was there — but nothing ever emitted the target. You
 *    could not send a colleague to "Step 3" of the quickstart, and Google could
 *    not offer a jump-to-section link for any of the ~89 sections.
 * 2. **Off the type scale.** `text-2xl` is a fixed 24px. Every other heading on
 *    the site uses the fluid `display-*` ramp, so docs headings were the one
 *    place that did not respond to viewport width and did not match a `.heading-*`
 *    anywhere else.
 * 3. **No machine-readable outline.** Building an "On this page" rail meant
 *    hand-maintaining a parallel list per page, which is exactly what
 *    `app/docs/services/[id]/page.tsx` does today and exactly how that list
 *    drifts from the content it describes.
 *
 * This component fixes all three at once, and it does it *on the server*, so the
 * ids are in the initial HTML: deep links work on a cold load, before any
 * JavaScript runs, and crawlers can see them.
 *
 * `data-docs-*` is the contract with `DocsToc`. The rail reads
 * `data-docs-label` rather than `textContent` on purpose — `textContent` would
 * pick up anything else rendered inside the heading, and the anchor icon means
 * there is always something else rendered inside the heading.
 */
export function DocsHeading({
  children,
  id,
  level = 2,
}: {
  /**
   * Plain text, not JSX.
   *
   * Typed as `string` so the slug is derivable at build time and the compiler
   * rejects a heading whose text cannot be turned into a stable anchor. A guide
   * that wants inline code in a heading should put it in the following
   * paragraph instead — a fragment identifier built from marked-up text is not
   * something a reader can predict or type.
   */
  children: string;
  /** Overrides the derived slug. Use only to preserve an already-published link. */
  id?: string;
  /** `3` for a subsection. Indented in the rail; still a real heading level. */
  level?: 2 | 3;
}) {
  const slug = id ?? docsSlug(children);
  const Tag = level === 2 ? "h2" : "h3";

  return (
    <Tag
      id={slug}
      data-docs-heading=""
      data-docs-label={children}
      data-docs-level={level}
      className={`group ${level === 2 ? "docs-h2" : "docs-h3"}`}
    >
      {children}
      {/*
        Revealed on hover, and on keyboard focus so it is not a focusable
        invisible control (WCAG 2.4.7). Hidden below `lg`: it would cost ~24px of
        horizontal space on every heading at a width where headings are already
        wrapping, and a touch user shares a page URL rather than a section one.
      */}
      <a
        href={`#${slug}`}
        className="docs-anchor"
        aria-label={`Link to this section: ${children}`}
      >
        <Hash size={level === 2 ? 15 : 13} aria-hidden="true" />
      </a>
    </Tag>
  );
}
