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
  title: "All SoterAI Security Services: Setup Guides for Every Control",
  description: `Searchable directory of all ${SERVICES.length} SoterAI security controls — monitoring, protection, detection, agent governance, compliance evidence, and administration. Each service has its own setup, verification, and API reference.`,
  alternates: { canonical: "/docs/services" },
  openGraph: {
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

      <header className="max-w-3xl">
        <p className="eyebrow">Service documentation</p>
        <h1 className="heading-1 mt-3">Every security control, with its own setup guide</h1>
        <p className="lede mt-4">
          {SERVICES.length} controls, grouped by what they do for you. Each page follows the same path: understand the
          control, open the right workspace, configure it, integrate it, and verify the result.
        </p>
      </header>

      {/* The six groups explained once, up front. Without this the filter buttons
          in the directory below are six unexplained words. */}
      <section aria-labelledby="service-groups" className="mt-10">
        <h2 id="service-groups" className="text-sm font-bold uppercase tracking-micro text-slate-200">
          How the catalogue is organised
        </h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICE_GROUPS.map((group) => {
            const count = SERVICES.filter((service) => service.group === group.id).length;
            return (
              <div key={group.id} className="surface p-4">
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
