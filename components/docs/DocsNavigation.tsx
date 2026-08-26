"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Braces, Layers3, Puzzle, Rocket, ShieldCheck } from "lucide-react";

const DOC_LINKS = [
  { href: "/docs", label: "Overview", icon: BookOpen, exact: true },
  { href: "/docs/quickstart", label: "Quickstart", icon: Rocket, exact: false },
  { href: "/docs/services", label: "Services", icon: Layers3, exact: false },
  { href: "/docs/rest-api", label: "API", icon: Braces, exact: false },
  { href: "/docs/best-practices", label: "Security", icon: ShieldCheck, exact: false },
  { href: "/extensions/browser", label: "Extensions", icon: Puzzle, exact: false },
] as const;

export function DocsNavigation() {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 z-40 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-2xl">
      <nav className="container-page flex min-h-12 items-center gap-1 overflow-x-auto py-2" aria-label="Documentation">
        {DOC_LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-cyan/10 text-cyan shadow-[0_0_0_1px_rgba(49,215,200,0.15)]"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
