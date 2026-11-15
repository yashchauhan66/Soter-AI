import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, BookOpen } from "lucide-react";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocViewTracker } from "@/components/docs/DocViewTracker";
import "@/components/docs/docs.css";

/** The workspace owns width; individual articles own their prose measure. */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="docs-workspace">
      <Suspense fallback={null}>
        <DocViewTracker />
      </Suspense>
      <a href="#docs-content" className="docs-skip-link">Skip documentation navigation</a>

      <div className="docs-toolbar">
        <Link href="/docs" className="docs-workspace-label">
          <BookOpen size={17} aria-hidden="true" />
          <span>Developer docs</span>
        </Link>
        <div className="docs-toolbar-navigation"><DocsMobileNav /></div>
        {/* One owner for keyboard shortcuts, dialog state and restored focus at
            every viewport. Never mount a second search in a hidden sidebar. */}
        <div className="docs-toolbar-search"><DocsSearch /></div>
        <nav aria-label="Documentation tools" className="docs-toolbar-actions">
          <Link href="/docs/api-contract">API reference</Link>
          <Link href="/playground">Playground <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </nav>
      </div>

      <div className="docs-layout-grid">
        <aside className="docs-sidebar-rail" aria-label="Browse documentation">
          <div className="docs-sidebar-scroll"><DocsSidebar /></div>
        </aside>
        <main id="docs-content" tabIndex={-1} className="docs-content">{children}</main>
      </div>
    </div>
  );
}
