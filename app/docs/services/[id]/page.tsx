import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Zap, Code2, Shield } from "lucide-react";
import { SERVICES, SERVICE_GROUPS, type ServiceDoc } from "@/lib/docs/services";
import { getServiceExperience } from "@/lib/docs/serviceExperience";
import { DocViewTracker } from "@/components/docs/DocViewTracker";
import { CodeBlock, TipBox, WarnBox } from "@/components/ui/CodeBlock";

interface Props {
  params: Promise<{ id: string }>;
}

function findService(id: string): ServiceDoc | undefined {
  return SERVICES.find((s) => s.id === id);
}

function findGroupLabel(groupId: string): string {
  return SERVICE_GROUPS.find((g) => g.id === groupId)?.label ?? groupId;
}

export async function generateStaticParams() {
  return SERVICES.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const service = findService(id);
  if (!service) return { title: "Service not found - SoterAI" };

  return {
    title: `${service.title} - SoterAI Service Documentation`,
    description: service.longDescription,
    alternates: { canonical: `/docs/services/${service.id}` },
    openGraph: {
      title: `${service.title} - SoterAI Service`,
      description: service.longDescription.substring(0, 160),
    },
  };
}

export default async function ServiceDocPage({ params }: Props) {
  const { id } = await params;
  const service = findService(id);
  if (!service) notFound();

  const Icon = service.icon;
  const groupLabel = findGroupLabel(service.group);
  const groupServices = SERVICES.filter((s) => s.group === service.group);
  const currentIndex = groupServices.findIndex((s) => s.id === service.id);
  const prevService = currentIndex > 0 ? groupServices[currentIndex - 1] : null;
  const nextService = currentIndex < groupServices.length - 1 ? groupServices[currentIndex + 1] : null;
  const experience = getServiceExperience(service.id);
  // The legacy catalog snippets describe an unreleased /api/v1 surface. Keep
  // them out of customer-facing docs until each snippet has an executable test.
  const showLegacyIntegrationExample = false;

  return (
    <main className="py-12">
      <DocViewTracker />
      
      <div className="container-page">
        {/* ── Breadcrumb ── */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-slate-300">
          <Link href="/docs" className="transition hover:text-slate-300">Docs</Link>
          <span>/</span>
          <Link href="/docs/services" className="transition hover:text-slate-300">Services</Link>
          <span>/</span>
          <span className="text-slate-200">{service.title}</span>
        </nav>

        {/* ── Hero Section ── */}
        <section className="rounded-lg border border-slate-800 bg-panel/70 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:gap-8">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg ${service.bg} ${service.color}`}>
              <Icon size={32} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <p className="eyebrow">{groupLabel}</p>
                <span className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1 text-xs text-slate-200">
                  {service.apiEndpoint ?? "Service"}
                </span>
              </div>
              <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{service.title}</h1>
              <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-300">
                {service.longDescription}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={experience.dashboardHref} className="button-primary gap-2">
                  Open {experience.dashboardLabel} <ArrowRight size={17} aria-hidden="true" />
                </Link>
                <Link href={service.apiEndpoint ? "/docs/rest-api" : "/docs/quickstart"} className="button-secondary gap-2">
                  {service.apiEndpoint ? "Open integration guide" : "Open quickstart"}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_280px]">
          {/* ── Main Content ── */}
          <div className="space-y-10">
            <section className="docs-section" id="setup">
              <div className="flex items-center gap-3">
                <BookOpen size={20} className="text-cyan" />
                <h2 className="text-xl font-bold">Set up {service.title}</h2>
              </div>
              <p className="mt-2 max-w-3xl text-slate-200">
                Complete these steps in order. The dashboard link opens the exact product workspace for this service.
              </p>
              <ol className="mt-6 divide-y divide-slate-800 border-y border-slate-800">
                <li className="grid gap-3 py-5 sm:grid-cols-[40px_1fr_auto] sm:items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan/10 text-sm font-bold text-cyan">1</span>
                  <div>
                    <h3 className="font-semibold">Open the correct workspace</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Sign in, select the project you want to protect, then open {experience.dashboardLabel}.</p>
                  </div>
                  <Link href={experience.dashboardHref} className="button-secondary !px-3 !py-2 text-sm">Open workspace</Link>
                </li>
                <li className="grid gap-3 py-5 sm:grid-cols-[40px_1fr] sm:items-start">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan/10 text-sm font-bold text-cyan">2</span>
                  <div>
                    <h3 className="font-semibold">Configure the service</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">{service.howItWorks[0]?.body}</p>
                  </div>
                </li>
                <li className="grid gap-3 py-5 sm:grid-cols-[40px_1fr_auto] sm:items-center">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan/10 text-sm font-bold text-cyan">3</span>
                  <div>
                    <h3 className="font-semibold">{service.apiEndpoint ? "Connect the implemented API route" : "Apply the control to your project"}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">
                      {service.apiEndpoint
                        ? `Use ${service.apiEndpoint} from server-side code. Keep API keys out of browsers and client bundles.`
                        : `Complete the configuration in ${experience.dashboardLabel}; this control does not require a public API call.`}
                    </p>
                  </div>
                  <Link href={service.apiEndpoint ? "/docs/rest-api" : "/docs/quickstart"} className="button-secondary !px-3 !py-2 text-sm">View guide</Link>
                </li>
                <li className="grid gap-3 py-5 sm:grid-cols-[40px_1fr] sm:items-start">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-cyan/10 text-sm font-bold text-cyan">4</span>
                  <div>
                    <h3 className="font-semibold">Verify before production</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300">Run one safe case and one expected-risk case. Confirm the result in {experience.dashboardLabel}, then review Guard Logs before enabling the control for production traffic.</p>
                  </div>
                </li>
              </ol>
              <div className="mt-5 rounded-lg border border-lime/20 bg-lime/5 p-4 text-sm leading-6 text-slate-200">
                <strong className="text-lime">Done when:</strong> the service is configured for the intended project, the safe test completes, the risky test produces the expected control decision, and the event is visible in logs.
              </div>
            </section>

            {/* Why This Matters */}
            <section className="docs-section" id="why">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-cyan" />
                <h2 className="text-xl font-bold">Why this matters</h2>
              </div>
              <div className="mt-4 rounded-xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-blue-500/5 p-6">
                <p className="leading-7 text-slate-300">{service.whyMatters}</p>
              </div>
            </section>

            {/* How It Works */}
            <section className="docs-section" id="how-it-works">
              <div className="flex items-center gap-3">
                <Zap size={20} className="text-cyan" />
                <h2 className="text-xl font-bold">How it works</h2>
              </div>
              <p className="mt-2 text-slate-200">A step-by-step breakdown of how {service.title} protects your AI.</p>
              
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {service.howItWorks.map((step, index) => (
                  <div
                    key={index}
                    className="card relative overflow-hidden p-5 transition-all duration-200 hover:border-cyan/30"
                  >
                    <div className="absolute right-3 top-3 text-4xl font-bold text-slate-800/40 select-none">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan/10 text-sm font-bold text-cyan">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-white">{step.heading}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-200">{step.body}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Key Features */}
            <section className="docs-section" id="features">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-cyan" />
                <h2 className="text-xl font-bold">Key features</h2>
              </div>
              
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {service.features.map((feature, index) => (
                  <div key={index} className="card p-4 transition-all duration-200 hover:border-slate-600">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-lime" />
                      <div>
                        <h3 className="font-medium text-white">{feature.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-slate-200">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Integration Code */}
            {showLegacyIntegrationExample && service.integrationCode && (
              <section className="docs-section" id="integration">
                <div className="flex items-center gap-3">
                  <Code2 size={20} className="text-cyan" />
                  <h2 className="text-xl font-bold">Quick integration</h2>
                </div>
                <p className="mt-2 text-slate-200">
                  Copy-paste this code to get started with {service.title} in your project.
                </p>
                <WarnBox>
                  <strong>API keys must stay server-side.</strong> Never expose your SoterAI API key in 
                  client-side code or browser bundles. Always use environment variables.
                </WarnBox>
                <CodeBlock language={service.codeLanguage ?? "typescript"} title={`${service.title} integration`}>
                  {service.integrationCode}
                </CodeBlock>
                {service.apiEndpoint && (
                  <TipBox>
                    <strong>API Reference:</strong> <code className="text-cyan">{service.apiEndpoint}</code> — 
                    see the{" "}
                    <Link href="/docs/api-contract" className="text-cyan underline decoration-cyan/30 hover:decoration-cyan/70">
                      full API contract
                    </Link>{" "}
                    for request/response schemas.
                  </TipBox>
                )}
              </section>
            )}

            {service.apiEndpoint && (
              <section className="docs-section" id="integration">
                <div className="flex items-center gap-3">
                  <Code2 size={20} className="text-cyan" />
                  <h2 className="text-xl font-bold">Implemented API route</h2>
                </div>
                <p className="mt-2 text-slate-200">
                  This service is implemented at the application route below. Use the tested SDK and framework guides for copy-paste integration examples.
                </p>
                <TipBox>
                  <strong>Implemented route:</strong> <code className="text-cyan">{service.apiEndpoint}</code>. API keys must stay server-side. See the{" "}
                  <Link href="/docs/rest-api" className="text-cyan underline decoration-cyan/30 hover:decoration-cyan/70">
                    REST API guide
                  </Link>{" "}
                  and related documentation before integrating.
                </TipBox>
              </section>
            )}

            {/* Related Docs */}
            {service.relatedDocs && service.relatedDocs.length > 0 && (
              <section className="docs-section" id="related">
                <div className="flex items-center gap-3">
                  <BookOpen size={20} className="text-cyan" />
                  <h2 className="text-xl font-bold">Related documentation</h2>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {service.relatedDocs.map((doc) => (
                    <Link
                      key={doc.href}
                      href={doc.href}
                      className="group flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-2.5 text-sm text-slate-200 transition-all duration-200 hover:border-cyan/40 hover:text-cyan"
                    >
                      {doc.label}
                      <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside className="xl:border-l xl:border-slate-800 xl:pl-8">
            <div className="sticky top-24 space-y-8">
              {/* On this page */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">On this page</h3>
                <ul className="mt-4 space-y-2 text-sm">
                  <li><a href="#why" className="text-slate-200 transition hover:text-cyan">Why this matters</a></li>
                  <li><a href="#setup" className="text-slate-200 transition hover:text-cyan">Setup workflow</a></li>
                  <li><a href="#how-it-works" className="text-slate-200 transition hover:text-cyan">How it works</a></li>
                  <li><a href="#features" className="text-slate-200 transition hover:text-cyan">Key features</a></li>
                  {service.apiEndpoint && (
                    <li><a href="#integration" className="text-slate-200 transition hover:text-cyan">API route</a></li>
                  )}
                  {service.relatedDocs && service.relatedDocs.length > 0 && (
                    <li><a href="#related" className="text-slate-200 transition hover:text-cyan">Related docs</a></li>
                  )}
                </ul>
              </div>

              {/* Service Info */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">Service info</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-slate-300">Category</dt>
                    <dd className="text-slate-300">{groupLabel}</dd>
                  </div>
                  {service.apiEndpoint && (
                    <div className="flex justify-between">
                      <dt className="text-slate-300">API</dt>
                      <dd className="font-mono text-xs text-cyan truncate ml-2">{service.apiEndpoint}</dd>
                    </div>
                  )}
                </dl>
              </div>

              {/* Group Navigation */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">{groupLabel} services</h3>
                <ul className="mt-4 space-y-1 text-sm">
                  {groupServices.map((s) => {
                    const SIcon = s.icon;
                    return (
                      <li key={s.id}>
                        <Link
                          href={`/docs/services/${s.id}`}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 transition ${
                            s.id === service.id
                              ? "bg-cyan/10 text-cyan"
                              : "text-slate-200 hover:bg-slate-800/50 hover:text-slate-200"
                          }`}
                        >
                          <SIcon size={14} />
                          <span className="truncate">{s.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Navigation */}
              <div className="flex flex-col gap-2">
                {prevService && (
                  <Link
                    href={`/docs/services/${prevService.id}`}
                    className="card group flex items-center gap-2 p-3 text-sm transition hover:border-cyan/30"
                  >
                    <ArrowLeft size={14} className="shrink-0 text-slate-300 transition group-hover:text-cyan" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-300">Previous</p>
                      <p className="truncate text-slate-300 transition group-hover:text-cyan">{prevService.title}</p>
                    </div>
                  </Link>
                )}
                {nextService && (
                  <Link
                    href={`/docs/services/${nextService.id}`}
                    className="card group flex items-center gap-2 p-3 text-sm transition hover:border-cyan/30"
                  >
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-xs text-slate-300">Next</p>
                      <p className="truncate text-slate-300 transition group-hover:text-cyan">{nextService.title}</p>
                    </div>
                    <ArrowRight size={14} className="shrink-0 text-slate-300 transition group-hover:text-cyan" />
                  </Link>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* ── Back to hub ── */}
        <div className="mt-12 border-t border-slate-800 pt-8">
          <Link
            href="/docs/services"
            className="group inline-flex items-center gap-2 text-sm text-slate-200 transition hover:text-cyan"
          >
            <ArrowLeft size={16} className="transition-transform duration-200 group-hover:-translate-x-1" />
            Back to all services
          </Link>
        </div>
      </div>
    </main>
  );
}
