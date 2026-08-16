"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CornerDownLeft, Search, X } from "lucide-react";
import { ADMIN_NAV, ADMIN_PALETTE_EVENT, type AdminBadgeCounts, type AdminNavItem } from "./adminNav";

type Ranked = { item: AdminNavItem; group: string; score: number };

/** Cheap subsequence + prefix scorer so "flscn" still finds "File scan events". */
function scoreItem(item: AdminNavItem, group: string, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const haystacks = [item.label, group, item.hint, ...(item.keywords ?? [])].map((value) => value.toLowerCase());

  let best = -1;
  for (const hay of haystacks) {
    if (hay === q) best = Math.max(best, 100);
    else if (hay.startsWith(q)) best = Math.max(best, 80);
    else if (hay.includes(q)) best = Math.max(best, 55);
  }
  if (best >= 0) return best;

  // Fall back to a fuzzy subsequence match on the label ("flscn" -> "file scan").
  const label = item.label.toLowerCase();
  let cursor = 0;
  for (const char of q) {
    cursor = label.indexOf(char, cursor);
    if (cursor === -1) return -1;
    cursor += 1;
  }
  return 20;
}

export function AdminCommandPalette({ counts }: { counts: AdminBadgeCounts }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo<Ranked[]>(() => {
    if (!query.trim()) {
      return ADMIN_NAV.flatMap((group) => group.items.map((item) => ({ item, group: group.title, score: 0 })));
    }
    const ranked: Ranked[] = [];
    for (const group of ADMIN_NAV) {
      for (const item of group.items) {
        const score = scoreItem(item, group.title, query.trim());
        if (score >= 0) ranked.push({ item, group: group.title, score });
      }
    }
    return ranked.sort((a, b) => b.score - a.score);
  }, [query]);

  // Deduplicate by href so "Growth metrics" and "Billing & revenue" don't both
  // fight for the same keyboard slot when they point at the same route.
  const visible = useMemo(() => {
    const seen = new Set<string>();
    return results.filter(({ item }) => {
      const key = `${item.href}::${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [results]);

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

  // Global Cmd/Ctrl+K toggle, plus "/" as a quick-open when not already typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
        return;
      }
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (!open && event.key === "/" && !typing) {
        event.preventDefault();
        setOpen(true);
      }
    }
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(ADMIN_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(ADMIN_PALETTE_EVENT, onOpenRequest);
    };
  }, [open]);

  // Focus the input and lock body scroll while the palette is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const raf = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.cancelAnimationFrame(raf);
    };
  }, [open]);

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (visible.length ? (prev + 1) % visible.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (visible.length ? (prev - 1 + visible.length) % visible.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = visible[activeIndex];
      if (choice) go(choice.item.href);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true" aria-label="Admin command palette">
      <button type="button" aria-label="Close command palette" onClick={close} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-panel shadow-glow" onKeyDown={onListKeyDown}>
        <div className="flex items-center gap-3 border-b border-slate-800 px-4">
          <Search size={18} className="text-slate-300" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to any admin service..."
            className="h-14 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-300"
            aria-label="Search admin services"
          />
          <button type="button" onClick={close} aria-label="Close" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-700 text-slate-200 hover:text-slate-200">
            <X size={14} />
          </button>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {visible.length ? (
            visible.map(({ item, group }, index) => {
              const Icon = item.icon;
              const count = item.badge ? counts[item.badge.key] : 0;
              const showBadge = Boolean(item.badge) && count > 0;
              const active = index === activeIndex;
              return (
                <button
                  key={`${item.href}-${item.label}`}
                  type="button"
                  data-index={index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.href)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                    active ? "bg-cyan/10" : "hover:bg-slate-800/50"
                  }`}
                >
                  <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${active ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-slate-800 bg-slate-950/60 text-slate-200"}`}>
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium ${active ? "text-cyan" : "text-slate-200"}`}>{item.label}</span>
                      {showBadge && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${item.badge!.tone === "red" ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"}`}>
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-300">{group} - {item.hint}</span>
                  </span>
                  {active && <CornerDownLeft size={14} className="shrink-0 text-slate-300" />}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-sm text-slate-300">No admin service matches "{query}".</p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2.5 text-[11px] text-slate-300">
          <span className="flex items-center gap-3">
            <span><kbd className="rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 font-mono">up/down</kbd> navigate</span>
            <span><kbd className="rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 font-mono">enter</kbd> open</span>
            <span><kbd className="rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 font-mono">esc</kbd> close</span>
          </span>
          <span>{visible.length} services</span>
        </div>
      </div>
    </div>
  );
}
