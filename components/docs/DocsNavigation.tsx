"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Braces, Layers3, Rocket, ShieldCheck } from "lucide-react";

const DOC_LINKS = [
  { href: "/docs", label: "Overview", icon: BookOpen, exact: true },
  { href: "/docs/quickstart", label: "Quickstart", icon: Rocket, exact: false },
  { href: "/docs/services", label: "Services", icon: Layers3, exact: false },
  { href: "/docs/rest-api", label: "API", icon: Braces, exact: false },
  { href: "/docs/best-practices", label: "Security", icon: ShieldCheck, exact: false },
] as const;

export function DocsNavigation() {
  const pathname = usePathname();

  return (
    <div className="sticky top-16 z-40 border-b border-slate-800 bg-slate-950/95 backdrop-blur-xl">
      <nav className="container-page flex min-h-12 items-center gap-1 overflow-x-auto py-1.5" aria-label="Documentation">
        {DOC_LINKS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition ${
                active
                  ? "bg-cyan/10 text-cyan"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
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