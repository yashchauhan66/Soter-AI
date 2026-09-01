import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildCrumbs } from "@/lib/navigation";
import { SITE_URL } from "@/lib/seo/schema";

/**
 * Breadcrumb trail.
 *
 * Replaces the single "Back to Home" bar that used to sit under the header on
 * every non-home page. That bar told the visitor one thing ("home exists") and
 * gave search engines nothing. A real trail does three jobs at once:
 *
 *   1. Orientation — on a deep page like /compliance/owasp-llm-top-10 the
 *      visitor can see and reach the parent section, not just the root.
 *   2. Rich results — the emitted BreadcrumbList lets Google render the site
 *      hierarchy in the SERP instead of a bare URL.
 *   3. Internal linking — every page now links up to its section, which
 *      distributes authority toward the section hubs.
 *
 * Server component: the trail derives from the pathname, so there is no reason
 * to ship it to the client. `pathname` is passed in from the client shell.
 */
export function Breadcrumbs({ pathname }: { pathname: string }) {
  const crumbs = buildCrumbs(pathname);

  // A single "Home" crumb is noise, and Google ignores one-item lists.
  if (crumbs.length < 2) return null;

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: crumbs.map((crumb, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: crumb.name,
            item: `${SITE_URL}${crumb.path === "/" ? "" : crumb.path}`,
          })),
        }}
      />

      <nav aria-label="Breadcrumb" className="border-b border-slate-800/60 bg-slate-950/50">
        {/* Horizontal scroll rather than wrapping: a wrapped trail on a phone
            pushes the page heading below the fold. */}
        <ol className="container-page flex items-center gap-1 overflow-x-auto py-2.5 text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;

            return (
              <li key={crumb.path} className="flex shrink-0 items-center gap-1">
                {index > 0 && (
                  <ChevronRight size={13} aria-hidden="true" className="shrink-0 text-slate-600" />
                )}

                {last ? (
                  // The current page is not a link — a link to the page you are
                  // already on is a dead control.
                  <span aria-current="page" className="font-medium text-slate-200">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    href={crumb.path}
                    className="rounded px-1 py-0.5 font-medium text-slate-400 transition-colors hover:text-cyan"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
