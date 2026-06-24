import Link from "next/link";
import type { Metadata } from "next";

const siteUrl = "https://soterai.publicvm.com";

const pricingJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "SoterAI",
  "applicationCategory": "SecurityApplication",
  "description": "AI security command layer for chatbots, RAG apps, and autonomous agents.",
  "url": `${siteUrl}/pricing`,
  "brand": { "@type": "Brand", "name": "SoterAI" },
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "INR",
    "lowPrice": "0",
    "highPrice": "9999",
    "offerCount": "5",
    "offers": [
      { "@type": "Offer", "name": "Free", "price": "0", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Starter", "price": "999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Pro", "price": "2999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Agency", "price": "9999", "priceCurrency": "INR", "availability": "https://schema.org/InStock" },
      { "@type": "Offer", "name": "Enterprise", "price": "0", "priceCurrency": "INR", "availability": "https://schema.org/ContactForPricing" },
    ],
  },
};

export const metadata: Metadata = {
  title: "Pricing | SoterAI AI Security Plans",
  description:
    "SoterAI pricing for guarded AI operations — Free, Starter, Pro, Agency, and Enterprise. Server-enforced limits, signed webhooks, white-label reports, SAML/SCIM, and SIEM.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | SoterAI AI Security Plans",
    description: "Free, Starter, Pro, Agency, and Enterprise plans for AI security guardrails. India PII detection, RAG security, and agent firewall included.",
  },
};
const plans=[
  {name:"Free",price:"₹0",copy:"Evaluate core guard behavior and one project.",features:["Input/output guard","Playground","Basic logs"]},
  {name:"Starter",price:"₹999/mo",copy:"For a production chatbot with operational alerts.",features:["Signed webhooks","Monthly reports","5 projects"]},
  {name:"Pro",price:"₹2,999/mo",copy:"For growing product and security teams.",features:["Higher limits","Security badge","20 projects"]},
  {name:"Agency",price:"₹9,999/mo",copy:"For agencies protecting multiple client chatbots.",features:["Client management","White-label reports","Partner resources"]},
  {name:"Enterprise",price:"Custom",copy:"For regulated, high-scale, or self-hosted deployments.",features:["SAML and SCIM","SIEM and retention","Pilot and SLA review"]},
];
export default function PricingPage(){return <main><script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      /><section className="container-page py-16"><p className="eyebrow">Pricing</p><h1 className="mt-2 text-4xl font-bold">Plans for guarded AI operations</h1><p className="mt-4 max-w-3xl text-slate-400">Server-enforced limits, transparent lifecycle states, and OWASP LLM Top 10 aligned defense-in-depth. No plan claims complete protection.</p><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{plans.map(plan=><article className="card flex flex-col p-5" key={plan.name}><h2 className="text-xl font-semibold">{plan.name}</h2><p className="mt-2 text-2xl font-bold text-cyan">{plan.price}</p><p className="mt-3 min-h-20 text-sm text-slate-400">{plan.copy}</p><div className="mt-4 space-y-2 text-sm">{plan.features.map(feature=><p key={feature}>✓ {feature}</p>)}</div><Link className="button-secondary mt-6 !px-3 !py-2" href={plan.name==="Enterprise"?"/enterprise/pilot":"/signup"}>{plan.name==="Enterprise"?"Request pilot":"Start"}</Link></article>)}</div></section><section className="border-y border-slate-800 py-12"><div className="container-page grid gap-8 md:grid-cols-2"><div><h2 className="text-xl font-semibold">Billing behavior</h2><p className="mt-3 text-sm leading-6 text-slate-400">Trials expire after the configured window. Payment failures enter a limited grace period. Plan activation and changes require server-verified Razorpay signatures.</p></div><div><h2 className="text-xl font-semibold">Need deployment review?</h2><p className="mt-3 text-sm leading-6 text-slate-400">Enterprise pricing depends on message volume, deployment model, support expectations, and integration scope.</p><Link href="/contact" className="mt-4 inline-block text-cyan hover:underline">Contact sales</Link></div></div></section></main>}
