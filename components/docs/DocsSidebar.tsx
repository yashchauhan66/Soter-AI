"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { DOCS_HELP_LINKS, DOCS_SECTIONS } from "@/lib/docs/navigation";

/** The full taxonomy stays open. Labels may wrap, never disappear into ellipses. */
export function DocsSidebar() {
  const pathname = usePathname() ?? "/docs";

  return (
    <nav aria-label="Documentation" className="docs-sidebar">
      {DOCS_SECTIONS.map((section) => (
        <div key={section.id} className="docs-nav-group">
          <h2 className="docs-nav-group-label">{section.label}</h2>
          <ul>
            {section.pages.map((page) => {
              const active = pathname === page.href;
              const parent = page.href === "/docs/services" && pathname.startsWith("/docs/services/");
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    aria-current={active ? "page" : parent ? "location" : undefined}
                    className="docs-nav-link"
                  >
                    <span>{page.label}</span>
                    {page.recommended && <span className="docs-nav-start">Start</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      <div className="docs-nav-help">
        {DOCS_HELP_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}<ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        ))}
      </div>
      <p className="docs-nav-note">Read each guide’s scope before integrating.</p>
    </nav>
  );
}
