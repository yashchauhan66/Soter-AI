"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/** Only the disclosure behavior is client-side; links arrive as server children. */
export function FooterNavGroup({ title, children }: { title: string; children: ReactNode }) {
  const groupRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const desktop = window.matchMedia("(min-width: 768px)");
    const syncLayout = () => {
      const summary = group.querySelector("summary");
      const active = document.activeElement;
      const contentHadFocus = group.contains(active) && active !== summary;
      group.open = desktop.matches;
      if (!desktop.matches && contentHadFocus) summary?.focus();
      if (desktop.matches && active === summary) group.querySelector<HTMLAnchorElement>("a[href]")?.focus();
    };
    syncLayout();
    desktop.addEventListener("change", syncLayout);
    return () => desktop.removeEventListener("change", syncLayout);
  }, []);

  return (
    // Start open in server HTML: all links work without JavaScript. Hydration
    // enhances narrow screens; native Enter/Space toggling needs no click handler.
    <details ref={groupRef} open data-footer-group={title} className="group min-w-0 border-b border-slate-800 md:border-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-sm py-3 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan md:hidden [&::-webkit-details-marker]:hidden">
        <h2 className="font-mono text-xs font-semibold uppercase tracking-micro text-slate-100">{title}</h2>
        <ChevronDown size={16} aria-hidden="true" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>
      <h2 className="hidden font-mono text-[0.6875rem] font-semibold uppercase tracking-micro text-slate-100 md:block">
        {title}
      </h2>
      {children}
    </details>
  );
}
