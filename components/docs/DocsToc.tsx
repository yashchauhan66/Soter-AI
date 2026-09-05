"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUp, ChevronDown, List } from "lucide-react";

/**
 * "On this page" rail.
 *
 * The guides run 3–10 minutes and average five sections; before this there was no
 * way to see a guide's shape without scrolling it, and no way to get back to a
 * section you had passed. The only table of contents anywhere in the product was
 * a hand-written six-item list inside `app/docs/services/[id]/page.tsx`, which
 * had to be edited every time that page's sections changed.
 *
 * ## Why it reads the DOM instead of taking a prop
 *
 * The rail derives itself from `[data-docs-heading]`, which `DocsHeading` emits.
 * A `toc={[…]}` prop would have been simpler to write and would have been wrong:
 * it is a second copy of the outline, maintained by hand, next to the outline it
 * describes. Those two copies diverge — the existing hardcoded list is the proof.
 * Reading the rendered headings means the rail cannot be stale, and adding a
 * section to a guide requires no second edit.
 *
 * It also gives a useful property for free: a page that renders no `DocsHeading`
 * produces no rail. That is why the hub, the service directory, and the `[id]`
 * route (which has its own bespoke aside) are unaffected without needing to be
 * special-cased here.
 *
 * ## Why scroll position, not IntersectionObserver
 *
 * The obvious implementation observes each heading and marks the last one to
 * cross the top of the viewport. It fails in two ordinary situations: a section
 * shorter than the viewport never becomes the sole intersecting element, and at
 * the bottom of the page the final heading may never intersect at all — so the
 * last section of every guide can never be marked current.
 *
 * Measuring `getBoundingClientRect().top` against the header offset and taking
 * the last heading above it is deterministic, handles both cases, and costs one
 * rAF-throttled pass over at most ~10 elements. The same pass computes reading
 * progress, so there is one listener rather than two.
 */

/**
 * Distance from the top of the viewport at which a heading counts as "current".
 *
 * Must match the `scroll-mt` on `.docs-h2` / `.docs-h3` (6rem), otherwise a
 * heading clicked in the rail lands just above or below the line that decides
 * whether it is active, and the entry the reader just clicked highlights the
 * neighbouring section instead. `tests/docs-structure.test.ts` asserts the pair.
 */
const HEADING_OFFSET = 96;

/**
 * The outline of the guide currently rendered on screen.
 *
 * Shared by the rail and its collapsed narrow-viewport counterpart so there is
 * one definition of "what counts as a section" rather than two that can drift.
 *
 * ## Why `useSyncExternalStore` and not an effect
 *
 * The straightforward version reads the headings in a `useEffect` and calls
 * `setEntries`. That is a setState synchronously inside an effect body, which
 * `react-hooks/set-state-in-effect` rejects — and rightly: it schedules a second
 * render pass on every mount and every navigation.
 *
 * The DOM *is* an external store, so this is the API for it. A `MutationObserver`
 * is the subscription, which is strictly better than keying an effect on
 * `usePathname`: it also catches a guide whose sections arrive from a streamed
 * Suspense boundary rather than in the first commit, which a pathname-keyed effect
 * would miss entirely.
 *
 * `readHeadings` memoises on the outline's shape. `getSnapshot` is called on every
 * render and React compares the result with `Object.is`, so returning a freshly
 * built array each time would loop forever.
 */
interface TocEntry {
  id: string;
  label: string;
  level: number;
}

/** Stable empty snapshot: identity has to hold across calls, so it cannot be `[]`. */
const NO_ENTRIES: TocEntry[] = [];

let cachedShape = "";
let cachedEntries: TocEntry[] = NO_ENTRIES;

function readHeadings(): TocEntry[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-docs-heading]"));
  const shape = nodes.map((node) => `${node.id}/${node.dataset.docsLevel ?? 2}`).join("|");

  if (shape !== cachedShape) {
    cachedShape = shape;
    cachedEntries = nodes
      // An empty id would render an anchor that goes nowhere. `DocsHeading` cannot
      // produce one — the slug test in tests/docs-structure.test.ts enforces it —
      // but this hook also sees any heading a future page marks up by hand.
      .filter((node) => node.id !== "")
      .map((node) => ({
        id: node.id,
        // Not `textContent`: the heading also contains the anchor icon, and any
        // future inline markup would leak into the rail label.
        label: node.dataset.docsLabel?.trim() ?? node.id,
        level: Number(node.dataset.docsLevel ?? 2),
      }));
  }

  return cachedEntries;
}

function subscribeToHeadings(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);

  // `document.body`, not the reading column.
  //
  // Watching `[data-docs-article]` would be more precise, but the node is resolved
  // once — when React subscribes — and `useSyncExternalStore` only ever
  // re-subscribes if this function's identity changes. Any client-side navigation
  // that replaced the article element rather than reconciling its children would
  // leave the observer watching a detached node, and the rail would silently stop
  // updating on exactly the routes it is meant to serve.
  //
  // The imprecision is free: unrelated mutations do fire `onStoreChange`, but
  // `readHeadings` returns the identical array when the outline has not changed,
  // so React does nothing.
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}

/** Server render has no DOM, so the rail is absent from the HTML and appears on hydration. */
const serverSnapshot = () => NO_ENTRIES;

function useDocsHeadings(): TocEntry[] {
  return useSyncExternalStore(subscribeToHeadings, readHeadings, serverSnapshot);
}

export function DocsToc() {
  const entries = useDocsHeadings();
  const [activeId, setActiveId] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const barRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (entries.length === 0) return;

    // Resolved once per outline change rather than inside the scroll pass.
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((node): node is HTMLElement => node !== null);

    if (headings.length === 0) return;
    const article = document.querySelector<HTMLElement>("[data-docs-article]");

    let frame = 0;

    const measure = () => {
      frame = 0;

      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > HEADING_OFFSET) break;
        current = heading.id;
      }

      // Hitting the end of the document marks the last section current. Without
      // this, a short closing section — which most of these guides have — stays
      // unreachable in the rail no matter how far the reader scrolls.
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      setActiveId(atBottom ? headings[headings.length - 1].id : current);

      if (article) {
        // Progress through the article, not the document: the footer is roughly a
        // screen tall on these pages, so a document-scoped bar would read ~85%
        // when the reader has actually reached the end of the content.
        const span = article.offsetHeight - window.innerHeight;
        const distance = window.scrollY - article.offsetTop;
        const value = span <= 0 ? 1 : Math.min(1, Math.max(0, distance / span));

        // Written straight to the element rather than held in state. Progress
        // changes on essentially every scroll frame; as state it would re-render
        // the whole rail 60 times a second to move one transform.
        if (barRef.current) barRef.current.style.transform = `scaleX(${value})`;
        setScrolled(value > 0.04);
      }
    };

    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    // Scheduled rather than called, for two reasons: reading layout synchronously
    // in the commit phase forces a style recalc before the browser has painted,
    // and a synchronous `setState` here would be a cascading render inside an
    // effect body — the thing `react-hooks/set-state-in-effect` exists to catch.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [entries]);

  const toTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // One heading does not need a table of contents, and an empty rail is worse
  // than no rail — it reads as a component that failed to load.
  if (entries.length < 2) return null;

  return (
    <nav aria-labelledby="docs-toc-label" className="sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pb-8">
      <p id="docs-toc-label" className="eyebrow">
        On this page
      </p>

      {/* Progress is decorative: the same information is in the scrollbar, and the
          active rail entry already says where the reader is. `aria-hidden` rather
          than `role="progressbar"` so assistive technology is not read a number
          that changes on every scroll frame. */}
      <div className="docs-toc-progress mt-3" aria-hidden="true">
        <span ref={barRef} style={{ transform: "scaleX(0)" }} />
      </div>

      <ul className="mt-4 space-y-px">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              // `location`, not `page` — this marks a position inside the current
              // document, which is what the token means.
              aria-current={activeId === entry.id ? "location" : undefined}
              className={`docs-toc-link ${entry.level === 3 ? "pl-7" : "pl-3"}`}
            >
              {entry.label}
            </a>
          </li>
        ))}
      </ul>

      {/* Appears only once there is something to go back up to. */}
      {scrolled && (
        <button type="button" onClick={toTop} className="docs-toc-top mt-5">
          <ArrowUp size={13} aria-hidden="true" />
          Back to top
        </button>
      )}
    </nav>
  );
}

/**
 * The same outline, collapsed, for viewports too narrow for a third column.
 *
 * Most documentation traffic is on a phone, which is also where a 10-minute guide
 * is hardest to navigate: there is no scrollbar to judge length by and no rail to
 * jump with. A closed `<details>` costs one line above the body and answers "how
 * long is this and what is in it" in a tap.
 *
 * Closed by default. An open outline would push the first paragraph of every
 * guide below the fold, which trades one navigation problem for a worse one.
 */
export function DocsTocInline() {
  const entries = useDocsHeadings();

  if (entries.length < 2) return null;

  return (
    <details className="docs-toc-inline mt-8 xl:hidden">
      <summary>
        <span className="flex items-center gap-2">
          <List size={14} aria-hidden="true" />
          On this page
        </span>
        <span className="flex items-center gap-2 text-slate-400">
          <span data-numeric>{entries.length} sections</span>
          <ChevronDown size={15} aria-hidden="true" className="docs-toc-chevron transition-transform" />
        </span>
      </summary>

      <ul className="border-t border-slate-800 px-3 py-2">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className={`docs-toc-link ${entry.level === 3 ? "pl-7" : "pl-3"}`}>
              {entry.label}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
