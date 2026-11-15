import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { JsonLd } from "@/components/seo/JsonLd";
import { ServiceDirectory } from "@/components/docs/ServiceDirectory";
import { SERVICE_GROUPS, SERVICES } from "@/lib/docs/services";
import { SITE_URL } from "@/lib/seo/schema";

/**
 * Service directory hub.
 *
 * Removed from the previous version:
 *
 * - **The four "quick stat" cards.** "6 Protection Layers", "8 Detection
 *   Engines", "4 Monitoring Tools" were hard-coded integers with no runtime
 *   source. Nothing recomputed them when a service was added or removed, so they
 *   were guaranteed to drift into being wrong — and on a security product,
 *   invented numbers are worse than no numbers. The one honest figure
 *   (`SERVICES.length`) is now stated inline in the intro.
 * - **The "Need integration help?" block and the "Related documentation" chip
 *   row.** Twelve links to guides that the persistent sidebar already lists on
 *   every page. Duplicated navigation makes a page feel busy without making
 *   anything easier to find.
 *
 * What remains is the actual job of this page: explain how the catalogue is
 * organised, then get out of the way of the searchable directory.
 */

export const metadata: Metadata = {
  title: "All Security Services: Setup for Every Control",
  description: `Searchable directory of all ${SERVICES.length} SoterAI security controls — monitoring, protection, detection, agent governance and compliance evidence.`,
  alternates: { canonical: "/docs/services" },
  openGraph: {
    images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
    title: "All SoterAI Security Services",
    description: `Browse ${SERVICES.length} security controls, each with a focused setup guide.`,
  },
};

export default function ServicesHubPage() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "BreadcrumbList",
              itemListElement: [
                { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
                { "@type": "ListItem", position: 2, name: "Documentation", item: `${SITE_URL}/docs` },
                { "@type": "ListItem", position: 3, name: "All services", item: `${SITE_URL}/docs/services` },
              ],
            },
            /**
             * `ItemList` rather than a `SoftwareApplication` per service: these
             * are features of one product, not separate applications. Claiming
             * 30-plus applications would be structured-data spam.
             */
            {
              "@type": "ItemList",
              name: "SoterAI security services",
              numberOfItems: SERVICES.length,
              itemListElement: SERVICES.map((service, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: service.title,
                url: `${SITE_URL}/docs/services/${service.id}`,
              })),
            },
          ],
        }}
      />

      <header className="docs-page-header">
        <p className="docs-eyebrow">Service documentation</p>
        <h1 className="docs-title">Find the control you need</h1>
        <p className="docs-summary">
          {SERVICES.length} service references, grouped by purpose. Each guide covers the actual setup,
          authentication boundary, verification steps, and limitations in the repository implementation.
          Live deployment and account availability still need to be checked.
        </p>
      </header>

      {/* The six groups explained once, up front. Without this the filter buttons
          in the directory below are six unexplained words. */}
      <section aria-labelledby="service-groups" className="docs-category-section">
        <h2 id="service-groups" className="docs-category-heading">
          How the catalogue is organised
        </h2>
        <dl className="docs-category-list">
          {SERVICE_GROUPS.map((group) => {
            const count = SERVICES.filter((service) => service.group === group.id).length;
            return (
              <div key={group.id}>
                <dt className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-100">{group.label}</span>
                  <span data-numeric className="text-xs text-slate-500">
                    {count}
                  </span>
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-400">{group.description}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <ServiceDirectory />

      <p className="mt-12 border-t border-slate-800 pt-6 text-sm text-slate-400">
        Looking for language setup instead of individual controls?{" "}
        <Link href="/docs/quickstart" className="inline-flex items-center gap-1 font-semibold text-cyan hover:underline">
          Start with the quickstart
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </p>
    </>
  );
}
