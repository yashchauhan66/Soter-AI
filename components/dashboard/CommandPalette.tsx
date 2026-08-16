"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { heroProducts, navGroups } from "./DashboardSidebar";
import { FEATURES, matchScore, type FeatureItem } from "./FeatureSearchBar";

/**
 * CommandPalette — global Cmd/Ctrl+K launcher for the 45+ dashboard services.
 *
 * The service catalog is derived from DashboardSidebar (heroProducts +
 * navGroups), which is the single source of truth for the route taxonomy.
 * Keyword hints are layered in from FeatureSearchBar's FEATURES index (keyed
 * by href) so search matches the same terms as the home-page search box.
 *
 * Dependency-free: substring + FeatureSearchBar's matchScore ranking, native
 * keyboard handling, no third-party fuzzy-search lib.
 */

interface PaletteItem {
  label: string;
  href: string;
  group: string;
  keywords: string[];
}

// Build a href -> keywords/group lookup from the existing search index so we
// reuse the same keywords instead of retyping them.
const featureByHref = new Map<string, FeatureItem>(
  FEATURES.map((f) => [f.href, f]),
);

/**
 * Flatten the sidebar taxonomy into a de-duplicated catalog. The sidebar is
 * authoritative for which services exist; FeatureSearchBar enriches keywords.
 */
function buildCatalog(): PaletteItem[] {
  const byHref = new Map<string, PaletteItem>();

  const add = (label: string, href: string, group: string) => {
    const existing = byHref.get(href);
    const feature = featureByHref.get(href);
    const keywords = feature ? feature.keywords : [];
    if (existing) {
      // Prefer the first (sidebar) label; merge keywords defensively.
      existing.keywords = Array.from(
        new Set([...existing.keywords, ...keywords]),
      );
      return;
    }
    byHref.set(href, { label, href, group, keywords });
  };

  for (const product of heroProducts) {
    add(product.label, product.href, product.label);
    for (const item of product.items) {
      add(item.label, item.href, product.label);
    }
  }

  for (const grp of navGroups) {
    for (const item of grp.items) {
      add(item.label, item.href, grp.label);
    }
  }

  return Array.from(byHref.values());
}

const CATALOG: PaletteItem[] = buildCatalog();

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Element focused before the palette opened, so we can restore it on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) {
      // Empty query: show the full catalog in taxonomy order.
      return CATALOG;
    }
    return CATALOG.map((item) => ({ item, score: matchScore(q, item) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((s) => s.item);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelectedIndex(0);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Global Cmd/Ctrl+K toggles the palette.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Manage focus: capture prior focus, focus the input, restore on close.
  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      // Focus after paint so the input is mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    previouslyFocused.current?.focus?.();
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open, results.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[selectedIndex];
      if (item) navigate(item.href);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // Single focusable element — trap focus on the input.
      e.preventDefault();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        // Close when clicking the backdrop (outside the dialog).
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette — jump to a service"
        className="card w-full max-w-xl overflow-hidden border-slate-700 p-0 shadow-2xl shadow-black/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="relative border-b border-slate-800">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a service..."
            className="h-14 w-full bg-transparent pl-12 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-300"
            maxLength={200}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={
              results[selectedIndex]
                ? `cmd-${results[selectedIndex].href}`
                : undefined
            }
            aria-autocomplete="list"
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul
            ref={listRef}
            id="command-palette-list"
            role="listbox"
            aria-label="Services"
            className="max-h-[52vh] overflow-y-auto p-2"
          >
            {results.map((item, index) => (
              <li key={item.href} id={`cmd-${item.href}`} role="option" aria-selected={index === selectedIndex}>
                <button
                  type="button"
                  onClick={() => navigate(item.href)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    index === selectedIndex
                      ? "bg-cyan/10 text-cyan"
                      : "text-slate-300 hover:bg-slate-800/70"
                  }`}
                  tabIndex={-1}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-[11px] text-slate-300">
                      {item.group}
                    </span>
                  </span>
                  {index === selectedIndex ? (
                    <CornerDownLeft
                      size={14}
                      className="shrink-0 text-cyan"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight
                      size={14}
                      className="shrink-0 text-slate-600"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-10 text-center text-sm text-slate-300">
            No services match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-300">
          <span className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5">↑</kbd>{" "}
              <kbd className="rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5">↓</kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5">↵</kbd>{" "}
              open
            </span>
          </span>
          <span>
            <kbd className="rounded border border-slate-700 bg-slate-800/50 px-1.5 py-0.5">Esc</kbd>{" "}
            close
          </span>
        </div>
      </div>
    </div>
  );
}
