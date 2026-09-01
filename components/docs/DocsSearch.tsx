"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, X } from "lucide-react";
import { DOCS_PAGES, DOCS_SECTIONS, type DocsPage } from "@/lib/docs/navigation";

/**
 * Documentation search (⌘K / Ctrl+K / "/").
 *
 * The docs had **no search at all** — 18 guides discoverable only by reading a
 * link grid. This is a client-side index over the navigation tree: labels,
 * summaries, and per-page keyword aliases. That scope is deliberate:
 *
 * - It answers "which page do I want?", which is the actual question a reader
 *   has on a docs site of this size.
 * - It ships no infrastructure and no third-party script, so it works offline,
 *   costs nothing, and cannot leak query strings to a vendor.
 *
 * Full-text search across page bodies would need a build-time index; the
 * `keywords` field covers the aliases that matter most ("curl" → REST API,
 * "pip" → Python, "aadhaar" → WhatsApp) without that machinery.
 *
 * Accessibility: a real modal dialog with `aria-modal`, a labelled combobox,
 * scroll lock, Escape to close, arrow-key navigation, and `aria-activedescendant`
 * so assistive technology tracks the highlighted option.
 */

interface Ranked {
  page: DocsPage;
  section: string;
  score: number;
}

/**
 * Rank a page against the query.
 *
 * The weighting matters more than the matching: a label prefix hit ("qui" →
 * Quickstart) must beat a summary mention, or the top result feels random.
 * Returns 0 for no match.
 */
function score(page: DocsPage, query: string): number {
  const label = page.label.toLowerCase();
  const summary = page.summary.toLowerCase();
  const keywords = page.keywords ?? [];

  if (label === query) return 100;
  if (label.startsWith(query)) return 90;
  if (keywords.some((keyword) => keyword.toLowerCase() === query)) return 80;
  if (label.includes(query)) return 70;
  if (keywords.some((keyword) => keyword.toLowerCase().includes(query))) return 55;
  if (summary.includes(query)) return 40;
  return 0;
}

export function DocsSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const sectionOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const section of DOCS_SECTIONS) {
      for (const page of section.pages) map.set(page.href, section.label);
    }
    return map;
  }, []);

  const results = useMemo<Ranked[]>(() => {
    const normalized = query.trim().toLowerCase();

    // An empty query is not an empty state: show the recommended entry point
    // first, then reading order. A blank panel would waste the interaction.
    if (!normalized) {
      return [...DOCS_PAGES]
        .sort((a, b) => Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)))
        .slice(0, 6)
        .map((page) => ({ page, section: sectionOf.get(page.href) ?? "", score: 0 }));
    }

    return DOCS_PAGES.map((page) => ({
      page,
      section: sectionOf.get(page.href) ?? "",
      score: score(page, normalized),
    }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
  }, [query, sectionOf]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Global ⌘K / Ctrl+K, plus "/" when the reader is not already typing — the
  // convention developers expect from a docs site.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable === true;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (event.key === "/" && !typing && !open) {
        event.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Focus the field on open and lock background scroll; restore focus to the
  // trigger on close so keyboard position is never lost.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    triggerRef.current?.focus();
  }, [open]);

  // Reset the highlight whenever the query changes so Enter can never navigate
  // to a row that has scrolled out of the result set.
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    if (activeIndex !== 0) setActiveIndex(0);
  }

  const onFieldKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index + 1) % results.length));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (results.length === 0 ? 0 : (index - 1 + results.length) % results.length));
      return;
    }

    if (event.key === "Enter") {
      const target = results[activeIndex];
      if (target) {
        event.preventDefault();
        go(target.page.href);
      }
    }
  };


  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="input flex w-full items-center gap-2.5 text-left text-slate-400 hover:border-cyan/40"
      >
        <Search size={15} aria-hidden="true" className="shrink-0" />
        <span className="flex-1 text-sm">Search the docs…</span>
        {/* Hidden below sm: a keyboard hint is noise on a touch device. */}
        <kbd className="hidden shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 sm:inline">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-overlay flex items-start justify-center px-4 pt-[10vh]"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="animate-overlay-in absolute inset-0 bg-ink/80 backdrop-blur-sm" aria-hidden="true" />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search documentation"
            className="animate-scale-in surface-raised relative w-full max-w-xl overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-slate-800 px-4">
              <Search size={16} aria-hidden="true" className="shrink-0 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls="docs-search-results"
                aria-autocomplete="list"
                aria-activedescendant={results[activeIndex] ? `docs-result-${activeIndex}` : undefined}
                aria-label="Search documentation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onFieldKeyDown}
                placeholder="Search guides, SDKs, frameworks…"
                className="h-14 flex-1 bg-transparent text-base text-slate-100 outline-none placeholder:text-slate-500"
              />
              <button type="button" onClick={close} aria-label="Close search" className="button-icon !h-8 !w-8">
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <ul
              id="docs-search-results"
              role="listbox"
              aria-label="Search results"
              className="max-h-[52vh] overflow-y-auto p-2"
            >
              {results.length === 0 ? (
                <li className="px-3 py-8 text-center text-sm text-slate-400">
                  No guide matches <span className="font-medium text-slate-200">“{query}”</span>.
                  <br />
                  Try a language or platform name, or{" "}
                  <button
                    type="button"
                    onClick={() => go("/support")}
                    className="font-semibold text-cyan hover:underline"
                  >
                    ask support
                  </button>
                  .
                </li>
              ) : (
                results.map((item, index) => {
                  const Icon = item.page.icon;
                  const active = index === activeIndex;

                  return (
                    <li key={item.page.href} id={`docs-result-${index}`} role="option" aria-selected={active}>
                      <button
                        type="button"
                        onClick={() => go(item.page.href)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                          active ? "bg-cyan/10" : "hover:bg-slate-800/60"
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            active
                              ? "border-cyan/40 bg-cyan/10 text-cyan"
                              : "border-slate-700 bg-slate-900 text-slate-400"
                          }`}
                        >
                          {Icon ? <Icon size={14} aria-hidden="true" /> : <Search size={14} aria-hidden="true" />}
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-100">{item.page.label}</span>
                            <span className="text-[10px] uppercase tracking-micro text-slate-500">{item.section}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-slate-400">{item.page.summary}</span>
                        </span>

                        {active && (
                          <CornerDownLeft size={13} aria-hidden="true" className="mt-1.5 shrink-0 text-cyan" />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="flex items-center gap-4 border-t border-slate-800 bg-slate-950/60 px-4 py-2.5 text-[11px] text-slate-500">
              <span>
                <kbd className="font-mono text-slate-400">↑↓</kbd> navigate
              </span>
              <span>
                <kbd className="font-mono text-slate-400">↵</kbd> open
              </span>
              <span>
                <kbd className="font-mono text-slate-400">esc</kbd> close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

