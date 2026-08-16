import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, Shield, Zap, Layers, Eye } from "lucide-react";
import { SERVICES } from "@/lib/docs/services";
import { DocViewTracker } from "@/components/docs/DocViewTracker";
import { ServiceDirectory } from "@/components/docs/ServiceDirectory";
import { safeJsonLd } from "@/lib/seo/jsonLd";

export const metadata: Metadata = {
  title: "SoterAI Services Documentation - All Security Features Explained",
  description:
    "Complete documentation for all SoterAI security services. Learn what each service does, how to use it, and how it protects your AI from prompt injection, data leakage, and other threats.",
  alternates: { canonical: "/docs/services" },
  openGraph: {
    title: "SoterAI Services Documentation",
    description: "Comprehensive documentation for all SoterAI AI security services and features.",
  },
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://soterai.in" },
    { "@type": "ListItem", position: 2, name: "Documentation", item: "https://soterai.in/docs" },
    { "@type": "ListItem", position: 3, name: "Services", item: "https://soterai.in/docs/services" },
  ],
};

const quickStatCards = [
  { icon: Shield, label: "Security Services", value: `${SERVICES.length}`, color: "text-cyan", bg: "bg-cyan/10" },
  { icon: Layers, label: "Protection Layers", value: "6", color: "text-emerald-300", bg: "bg-emerald-400/10" },
  { icon: Zap, label: "Detection Engines", value: "8", color: "text-orange-300", bg: "bg-orange-400/10" },
  { icon: Eye, label: "Monitoring Tools", value: "4", color: "text-blue-300", bg: "bg-blue-400/10" },
];

export default function ServicesHubPage() {
  return (
    <main className="py-16">
      <DocViewTracker />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumbSchema) }} />

      <div className="container-page">
        <section className="border-b border-slate-800 pb-10">
          <div>
            <p className="eyebrow">Service documentation</p>
            <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-5xl">
              Choose a security service. Follow one focused setup guide.
            </h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
              Browse all {SERVICES.length} SoterAI controls. Each service page now keeps the user on one path:
              understand the control, open the correct workspace, configure it, integrate it, and verify the result.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/quickstart" className="button-primary gap-2">
                <Zap size={18} /> Quickstart guide <ArrowRight size={18} />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API reference
              </Link>
            </div>
          </div>
        </section>

        {/* ── Quick Stats ── */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickStatCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="card group p-5 transition-all duration-300 hover:border-cyan/30 hover:shadow-lg hover:shadow-cyan/5">
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg} ${stat.color}`}>
                    <Icon size={20} />
                  </span>
                  <div>
                    <p className="text-2xl font-bold text-white">{stat.value}</p>
                    <p className="text-xs text-slate-300">{stat.label}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <ServiceDirectory />

        {/* ── CTA Section ── */}
        <section className="mt-16 rounded-2xl border border-cyan/20 bg-gradient-to-br from-cyan/5 to-blue-500/5 p-8 sm:p-12">
          <div className="flex flex-col items-center text-center">
            <BookOpen size={32} className="text-cyan" />
            <h2 className="mt-4 text-2xl font-bold">Need integration help?</h2>
            <p className="mt-3 max-w-2xl text-slate-200">
              Check out our language-specific integration guides for step-by-step setup 
              instructions with code examples in your preferred framework.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/docs/js" className="button-secondary">JavaScript SDK</Link>
              <Link href="/docs/python" className="button-secondary">Python SDK</Link>
              <Link href="/docs/nextjs" className="button-secondary">Next.js</Link>
              <Link href="/docs/express" className="button-secondary">Express.js</Link>
              <Link href="/docs/fastapi" className="button-secondary">FastAPI</Link>
              <Link href="/docs/rest-api" className="button-secondary">REST API</Link>
            </div>
          </div>
        </section>

        {/* ── Related Links ── */}
        <section className="mt-12 rounded-lg border border-slate-800 bg-slate-950/40 p-6">
          <h2 className="text-lg font-semibold">Related documentation</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/docs/quickstart" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Quickstart</Link>
            <Link href="/docs/rest-api" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">REST API</Link>
            <Link href="/docs/api-contract" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">API Contract</Link>
            <Link href="/docs/best-practices" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Best Practices</Link>
            <Link href="/trust" className="rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Trust Center</Link>
            <Link href="/pricing" className="rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-slate-300 hover:border-cyan/50 hover:text-cyan">Pricing</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
