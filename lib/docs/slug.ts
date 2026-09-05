/**
 * Heading slugs for documentation anchors.
 *
 * One function, used by two places that must never disagree:
 *
 *   - `DocsHeading` (server) writes the `id` into the HTML.
 *   - `DocsToc` (client) reads those ids back out of the DOM to build the rail.
 *
 * If each side derived its own slug, a heading containing an emoji or an
 * apostrophe would produce a link that scrolls nowhere — and it would only break
 * on the specific pages that use those characters, which is the failure mode
 * least likely to be noticed in review. `🚫 Common beginner mistakes` and
 * `What you'll build` are both real headings in these docs.
 */

/**
 * Convert heading text to a stable, URL-safe fragment.
 *
 * Deliberately aggressive: anything outside `a–z0–9` becomes a separator. That
 * loses information (`C#` and `C` collapse to the same stem) but produces
 * fragments that survive copy/paste through chat clients, which is the whole
 * point of a section link. `DocsHeading` accepts an explicit `id` override for
 * the rare case where the collapse matters.
 */
export function docsSlug(text: string): string {
  return text
    .toLowerCase()
    // Strip possessive and contraction apostrophes rather than turning them into
    // separators: "what you'll build" should read `what-youll-build`, not
    // `what-you-ll-build`.
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
