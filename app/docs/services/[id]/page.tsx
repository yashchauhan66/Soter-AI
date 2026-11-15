import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsToc, DocsTocInline } from "@/components/docs/DocsToc";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { JsonLd } from "@/components/seo/JsonLd";
import { SERVICES, SERVICE_GROUPS, type ServiceDoc } from "@/lib/docs/services";
import { getServiceExperience } from "@/lib/docs/serviceExperience";
import { clampDescription } from "@/lib/seo/metadata";
import { SITE_URL } from "@/lib/seo/schema";

interface Props { params: Promise<{ id: string }> }
// Preserve the existing opt-out boundary: unverified v1 snippets are never public guidance.
const showLegacyIntegrationExample = false;
const findService = (id: string): ServiceDoc | undefined => SERVICES.find((service) => service.id === id);

export async function generateStaticParams() {
  return SERVICES.map((service) => ({ id: service.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const service = findService((await params).id);
  if (!service) return { title: "Service not found" };
  return {
    title: `${service.title} — Setup Guide`,
    description: clampDescription(service.longDescription),
    alternates: { canonical: `/docs/services/${service.id}` },
    openGraph: {
      images: [{ url: "/og-card/default.png", width: 1200, height: 630, alt: "SoterAI, the AI security command layer" }],
      title: `${service.title} - SoterAI Service`,
      description: clampDescription(service.longDescription),
    },
  };
}

export default async function ServiceDocPage({ params }: Props) {
  const service = findService((await params).id);
  if (!service) notFound();
  const experience = getServiceExperience(service.id);
  const groupLabel = SERVICE_GROUPS.find((group) => group.id === service.group)?.label ?? service.group;
  const groupServices = SERVICES.filter((entry) => entry.group === service.group);
  const index = groupServices.findIndex((entry) => entry.id === service.id);
  const previous = groupServices[index - 1];
  const next = groupServices[index + 1];

  return (
    <div className="docs-page-grid">
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Documentation", item: `${SITE_URL}/docs` },
          { "@type": "ListItem", position: 3, name: "All services", item: `${SITE_URL}/docs/services` },
          { "@type": "ListItem", position: 4, name: service.title, item: `${SITE_URL}/docs/services/${service.id}` },
        ],
      }} />
      <article data-docs-article className="docs-article">
        <header className="docs-page-header">
          <p className="docs-eyebrow">{groupLabel} · Service reference</p>
          <h1 className="docs-title">{service.title}</h1>
          <p className="docs-summary">{service.longDescription}</p>
          <div className="docs-page-meta">
            <span>{experience.authentication.label}</span>
            <span>Deployment checks still required</span>
          </div>
          <div className="docs-service-actions">
            <Link href={experience.dashboardHref} className="docs-button docs-button-primary">
              Open {experience.dashboardLabel}<ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link href={service.apiEndpoint ? "/docs/rest-api" : "/docs/quickstart"} className="docs-service-guide-link">
              {service.apiEndpoint ? "Guard REST guide" : "Guard quickstart"}<ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section aria-labelledby="service-access" className="docs-scope">
          <h2 id="service-access">Access and scope</h2>
          <p>{experience.authentication.description}</p>
          {service.apiEndpoint && <p className="docs-service-endpoint"><span>Application reference</span><code>{service.apiEndpoint}</code></p>}
          <p className="docs-source-boundary">These instructions describe the repository implementation. They do not establish enabled plan features, a deployed worker, or live integration readiness.</p>
        </section>

        <DocsTocInline />
        <div className="docs-body">
          <section className="docs-section">
            <DocsHeading id="setup">Set up this service</DocsHeading>
            <ol className="docs-operation-list">
              {experience.setup.map((step) => <li key={step.heading}><h3>{step.heading}</h3><p>{step.body}</p></li>)}
            </ol>
          </section>
          <section className="docs-section">
            <DocsHeading id="verification">Verify the behavior</DocsHeading>
            <ol className="docs-operation-list">
              {experience.validation.map((step) => <li key={step.heading}><h3>{step.heading}</h3><p>{step.body}</p></li>)}
            </ol>
          </section>
          <section className="docs-section">
            <DocsHeading id="why">Why this matters</DocsHeading>
            <p className="mt-4">{service.whyMatters}</p>
          </section>
          <section className="docs-section">
            <DocsHeading id="how-it-works">How it works</DocsHeading>
            <ol className="docs-operation-list">
              {service.howItWorks.map((step) => <li key={step.heading}><h3>{step.heading}</h3><p>{step.body}</p></li>)}
            </ol>
          </section>
          <section className="docs-section">
            <DocsHeading id="features">Reference capabilities</DocsHeading>
            <dl className="docs-reference-rows">
              {service.features.map((feature) => <div key={feature.title}><dt>{feature.title}</dt><dd>{feature.description}</dd></div>)}
            </dl>
          </section>
          <section className="docs-section">
            <DocsHeading id="integration">Integration boundary</DocsHeading>
            <ul className="docs-boundary-list">{experience.integrationNotes.map((note) => <li key={note}>{note}</li>)}</ul>
            {showLegacyIntegrationExample && service.integrationCode && (
              <CodeBlock language="typescript" title="Unverified legacy example">{service.integrationCode}</CodeBlock>
            )}
          </section>
          <section className="docs-section">
            <DocsHeading id="limitations">Limitations to review</DocsHeading>
            <ul className="docs-boundary-list">{experience.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
          </section>
          {!!service.relatedDocs?.length && <section className="docs-section">
            <DocsHeading id="related">Related documentation</DocsHeading>
            <ul className="docs-related-links">{service.relatedDocs.map((doc) => <li key={doc.href}><Link href={doc.href}>{doc.label}<ArrowRight size={14} aria-hidden="true" /></Link></li>)}</ul>
          </section>}
        </div>

        <nav aria-label="Service navigation" className="docs-guide-footer">
          <div className="docs-pager">
            {previous ? <Link href={`/docs/services/${previous.id}`} className="docs-pager-link"><span><ArrowLeft size={14} aria-hidden="true" /> Previous service</span><strong>{previous.title}</strong></Link> : <span aria-hidden="true" />}
            {next && <Link href={`/docs/services/${next.id}`} className="docs-pager-link docs-pager-next"><span>Next service<ArrowRight size={14} aria-hidden="true" /></span><strong>{next.title}</strong></Link>}
          </div>
          <div className="docs-feedback">
            <Link href="/docs/services"><ArrowLeft size={14} aria-hidden="true" /> Back to all services</Link>
            <Link href="/support">Something unclear? Tell us</Link>
          </div>
        </nav>
      </article>
      <aside className="docs-outline-rail"><DocsToc /></aside>
    </div>
  );
}
