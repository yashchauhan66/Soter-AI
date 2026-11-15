"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Search, X } from "lucide-react";
import { DOCS_SECTIONS } from "@/lib/docs/navigation";
import { parseDocsIndex, searchDocs, type DocsSearchDocument } from "@/lib/docs/search";
import "./docs-search.css";

const guideFallback: DocsSearchDocument[] = DOCS_SECTIONS.flatMap((section) => section.pages.map((page) => ({
  href: page.href, title: page.label, section: section.label, kind: "guide" as const,
  summary: page.summary, body: page.summary, keywords: page.keywords ?? [], headings: [],
})));

/** A local index, loaded only on intent. Queries never leave the browser. */
export function DocsSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const prefix = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [documents, setDocuments] = useState<DocsSearchDocument[] | null>(null);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const results = useMemo(() => searchDocs(documents ?? guideFallback, query), [documents, query]);
  const selected = Math.min(activeIndex, Math.max(0, results.length - 1));
  const listId = `${prefix}-results`;

  const close = useCallback(() => { setOpen(false); setQuery(""); setActiveIndex(0); }, []);
  const show = useCallback(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!documents) setLoadState("loading");
    setOpen(true);
  }, [documents]);
  const go = useCallback((href: string) => { close(); router.push(href); }, [close, router]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || !triggerRef.current?.getClientRects().length) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select") || target?.isContentEditable;
      const shortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !typing && !event.metaKey && !event.ctrlKey;
      if (!shortcut && !slash) return;
      const otherModal = [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"][aria-modal="true"]')]
        .some((element) => element !== dialogRef.current && element.getClientRects().length > 0);
      if (otherModal) return;
      event.preventDefault();
      if (open && shortcut) close(); else if (!open) show();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, show, close]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    const previous = previousFocus.current;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    inputRef.current?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      // Never focus search on initial load; restore only after a real opening.
      const target = previous?.isConnected && previous !== document.body ? previous : trigger;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open || documents) return;
    const controller = new AbortController();
    let active = true;
    const deadline = window.setTimeout(() => controller.abort(), 8000);
    fetch("/docs-search-index.json", { signal: controller.signal, cache: "no-cache", credentials: "same-origin" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Index unavailable");
        const body = await response.text();
        if (body.length > 2_000_000) throw new Error("Index too large");
        const parsed = parseDocsIndex(JSON.parse(body));
        if (!parsed) throw new Error("Invalid index");
        if (active) { setDocuments(parsed); setLoadState("ready"); }
      })
      .catch(() => { if (active) setLoadState("error"); })
      .finally(() => window.clearTimeout(deadline));
    return () => { active = false; controller.abort(); window.clearTimeout(deadline); };
  }, [open, documents, attempt]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const option = document.getElementById(`${prefix}-result-${selected}`);
    if (!list || !option) return;
    const frame = requestAnimationFrame(() => {
      const bounds = list.getBoundingClientRect();
      const item = option.getBoundingClientRect();
      if (item.top < bounds.top) list.scrollTop -= bounds.top - item.top;
      else if (item.bottom > bounds.bottom) list.scrollTop += item.bottom - bounds.bottom;
    });
    return () => cancelAnimationFrame(frame);
  }, [open, prefix, selected, results]);

  return (
    <>
      <button ref={triggerRef} type="button" onClick={show} aria-haspopup="dialog" aria-expanded={open}
        className={`docs-search-trigger ${className}`}>
        <Search size={16} aria-hidden="true" /><span>Search the docs…</span><kbd>⌘ / Ctrl K</kbd>
      </button>
      <dialog ref={dialogRef} role="dialog" aria-modal="true" aria-label="Search documentation" className="docs-search-dialog"
        onCancel={(event) => { event.preventDefault(); close(); }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
        }}>
        <div className="docs-search-field">
          <Search size={20} aria-hidden="true" />
          <input ref={inputRef} type="search" role="combobox" aria-expanded={open} aria-controls={listId}
            aria-autocomplete="list" aria-label="Search documentation"
            aria-activedescendant={results[selected] ? `${prefix}-result-${selected}` : undefined}
            value={query} maxLength={160} autoComplete="off" spellCheck={false}
            placeholder="Find a guide, endpoint, or concept…"
            onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
            onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); close(); }
              else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const direction = event.key === "ArrowDown" ? 1 : -1;
                setActiveIndex(results.length ? (selected + direction + results.length) % results.length : 0);
              } else if (event.key === "Enter" && results[selected]) { event.preventDefault(); go(results[selected].href); }
            }} />
          <button type="button" aria-label="Close search" className="docs-search-close" onClick={close}><X size={18} aria-hidden="true" /></button>
        </div>
        <div className="docs-search-context" role="status" aria-live="polite">
          {loadState === "loading" ? "Loading the local search index…" : loadState === "error" ? (
            <><span>Full-text search unavailable. Guide-only fallback.</span><button type="button" onClick={() => { setLoadState("loading"); setAttempt((value) => value + 1); }}>Retry</button></>
          ) : query.trim() ? `Showing ${results.length} results` : "Suggested starting points"}
        </div>
        <ul ref={listRef} id={listId} role="listbox" aria-label="Search results" className="docs-search-results">
          {results.map((result, index) => (
            <li key={result.href} role="presentation">
              <button id={`${prefix}-result-${index}`} type="button" role="option" aria-selected={selected === index}
                tabIndex={-1} className="docs-search-result" onClick={() => go(result.href)} onPointerMove={() => setActiveIndex(index)}>
                <span className="docs-search-result-meta">{result.section}<span>{result.kind === "service" ? "Service guide" : "Documentation"}</span></span>
                <span className="docs-search-result-title">{result.title}<ArrowUpRight size={15} aria-hidden="true" /></span>
                {result.heading && <span className="docs-search-result-heading">{result.heading}</span>}
                <span className="docs-search-result-excerpt">{result.excerpt}</span>
              </button>
            </li>
          ))}
        </ul>
        {results.length === 0 && <div className="docs-search-empty"><strong>No matches for “{query}”</strong><p>Try an API field, a service name, or a shorter phrase.</p><button type="button" onClick={() => { setQuery(""); setActiveIndex(0); inputRef.current?.focus(); }}>Clear search</button></div>}
        <div className="docs-search-footer"><span><kbd>↑↓</kbd> Navigate <kbd>↵</kbd> Open <kbd>Esc</kbd> Close</span><span>{documents ? `${documents.length} documents · local search` : "Your query stays in this browser"}</span></div>
      </dialog>
    </>
  );
}

