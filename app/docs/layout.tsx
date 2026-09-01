import { Suspense } from "react";
import { DocsMobileNav } from "@/components/docs/DocsMobileNav";
import { DocsSearch } from "@/components/docs/DocsSearch";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

/**
 * Documentation layout.
 *
 * Structure: a sticky sidebar column plus a reading column capped at a
 * comfortable measure. This replaces a full-width single column under a
 * horizontal pill nav, where line length ran past 110 characters at 1280px and
 * 12 of the 18 guides were invisible from any given page.
 *
 * Why the sidebar is `lg:sticky` and independently scrollable: guides run from 3
 * to 10 minutes of content, so a non-sticky sidebar would scroll away on the long
 * ones exactly when a reader wants to jump elsewhere.
 *
 * `min-w-0` on the content column is load-bearing — without it a wide `<pre>`
 * code block forces the grid track to grow and pushes the sidebar off screen
 * instead of scrolling inside its own container.
 *
 * `DocViewTracker` moved here from all 18 page components. It reads
 * `useSearchParams`, so it must sit inside a Suspense boundary or it opts the
 * entire docs subtree out of static rendering — which would turn 18 prerendered
 * pages into on-demand server renders.
 */
export default function DocsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="container-page">
      <Suspense fallback={null}>
        <DocViewTracker />
      </Suspense>

      <div className="lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block">
          {/* top-16 clears the sticky site header (h-16). */}
          <div className="sticky top-16 max-h-[calc(100vh-4rem)] overflow-y-auto py-10 pr-4">
            <DocsSearch />
            <div className="mt-7">
              <DocsSidebar />
            </div>
          </div>
        </aside>

        <div className="min-w-0 py-8 lg:py-10">
          <div className="space-y-4 lg:hidden">
            <DocsSearch />
            <DocsMobileNav />
          </div>

          {/* No width cap here on purpose. `DocsPageShell` applies the prose
              measure for the 16 guide pages, which lets the service directory use
              the full column for its 3-up card grid. Capping here would squeeze
              that grid to one column at every breakpoint. */}
          <div className="mt-6 lg:mt-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
