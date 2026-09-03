"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CornerDownLeft, Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
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
 * Ranking stays dependency-free: substring + FeatureSearchBar's `matchScore`, no
 * third-party fuzzy-search lib.
 *
 * ## What the Radix migration fixed
 *
 * The dialog shell is now `components/ui/Dialog.tsx` (Radix) instead of a
 * hand-rolled overlay. That resolves three real defects, not just duplication:
 *
 * 1. **The page scrolled behind the open palette.** There was no scroll lock at
 *    all, so a mouse wheel or trackpad gesture over the backdrop scrolled the
 *    dashboard underneath. Radix locks the body and compensates for the scrollbar
 *    width, so the page does not shift sideways when the palette opens either.
 * 2. **The focus trap was `event.preventDefault()` on Tab.** That pins focus to
 *    the input by disabling Tab entirely — which also means a keyboard user can
 *    never reach the close affordance, and any future control added to this dialog
 *    would be unreachable. Radix cycles focus within the dialog properly.
 * 3. **Focus restore ran on every `open` change including first mount**, so
 *    `previouslyFocused.current?.focus?.()` fired against a null ref on load.
 *
 * What is deliberately kept custom: the listbox. `aria-activedescendant` combobox
 * navigation over a filtered list is the correct pattern here and Radix has no
 * primitive for it — arrow keys move a *virtual* selection while real focus stays
 * in the text field, which is what lets the user keep typing.
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

  /**
   * Reset the query when the dialog closes.
   *
   * Radix owns open/close (Escape, outside pointer-down, close button), so this
   * runs from one `onOpenChange` rather than from a bespoke `close()` that every
   * exit path had to remember to call — the previous version had four such paths.
   */
  const onOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, []);

  const navigate = useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
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

  // Keep the highlighted row scrolled into view. Radix owns focus capture and
  // restore, so there is no focus effect left in this component.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[selectedIndex] as
      | HTMLElement
      | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, open, results.length]);

  /**
   * Arrow/Enter only. Escape and Tab are Radix's responsibility now — handling
   * Escape here as well would run the close path twice, and swallowing Tab was
   * the bug described in the file header.
   */
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Command palette — jump to a service"
        titleVisuallyHidden
        hideClose
        // The search field is the point of this dialog, so focus goes there
        // rather than to Radix's default (the first focusable node).
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
        }}
        // Top-anchored rather than vertically centred: a palette whose result list
        // grows downward would otherwise shift on every keystroke as the filtered
        // list changes height. `translate-y-0` cancels the centring transform.
        className="top-[12vh] max-w-xl translate-y-0 overflow-hidden p-0"
      >
        {/* Search input */}
        <div className="relative border-b border-slate-800">
          <Search
            size={17}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
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
            className="h-14 w-full bg-transparent pl-12 pr-4 text-base text-slate-100 outline-none placeholder:text-slate-500"
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
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors ${
                    index === selectedIndex
                      ? "bg-slate-800/80 text-slate-100"
                      : "text-slate-300 hover:bg-slate-800/50"
                  }`}
                  tabIndex={-1}
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{item.label}</span>
                    <span className="ml-2 text-[11px] text-slate-500">
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
          <div className="px-4 py-10 text-center text-sm text-slate-400">
            No services match &ldquo;{query}&rdquo;
          </div>
        )}

        {/* Footer hint */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-500">
          <span className="flex items-center gap-3">
            <span>
              <Kbd>↑</Kbd> <Kbd>↓</Kbd> navigate
            </span>
            <span>
              <Kbd>↵</Kbd> open
            </span>
          </span>
          <span>
            <Kbd>Esc</Kbd> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Keycap.
 *
 * Extracted because the same class string appeared five times inline. `font-sans`
 * is explicit: the browser default for `<kbd>` is monospace, which at 11px next to
 * Inter renders noticeably smaller and misaligned on the baseline.
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-slate-700 bg-slate-800/60 px-1.5 py-0.5 font-sans">
      {children}
    </kbd>
  );
}
