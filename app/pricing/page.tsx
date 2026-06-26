import Link from "next/link";
import type { Metadata } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://soterai.dev";

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
const faqs = [
  {
    q: "What counts as a security check?",
    a: "Each API call to the Input Guard, Output Guard, PII Redactor, or RAG Scanner endpoints counts as one security check. Calls from any integration (n8n, Zapier, Make, Dify, Botpress, etc.) or direct API usage are counted the same way.",
  },
  {
    q: "Can I use SoterAI with n8n, Zapier, Make, and other platforms?",
    a: "Yes. SoterAI has ready-to-use integrations for n8n, Dify, Zapier, Make.com, Botpress, Flowise, Langflow, and Voiceflow. All integrations work with every plan, including Free.",
  },
  {
    q: "Does SoterAI store my prompts or AI outputs?",
    a: "No. SoterAI processes text in-memory for security analysis and does not persist raw prompts or AI responses. Only threat detection summaries (risk scores, categories, timestamps) are stored for your audit dashboard.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. The Free plan includes core Input and Output Guard with basic logs. No credit card required.",
  },
  {
    q: "Can I self-host SoterAI?",
    a: "Self-hosted deployment is available on the Enterprise plan. Contact sales for deployment options and pricing.",
  },
  {
    q: "Is SoterAI a replacement for human security review?",
    a: "No. SoterAI provides automated defense-in-depth to catch common AI threats. It reduces risk but does not replace human security oversight, code review, or incident response processes.",
  },
];

export default function PricingPage(){return <main><script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(pricingJsonLd) }}
      /><section className="container-page py-16"><p className="eyebrow">Pricing</p><h1 className="mt-2 text-4xl font-bold">Plans for guarded AI operations</h1><p className="mt-4 max-w-3xl text-slate-400">Server-enforced limits, transparent lifecycle states, and OWASP LLM Top 10 aligned defense-in-depth. No plan claims complete protection.</p><div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">{plans.map(plan=><article className="card flex flex-col p-5" key={plan.name}><h2 className="text-xl font-semibold">{plan.name}</h2><p className="mt-2 text-2xl font-bold text-cyan">{plan.price}</p><p className="mt-3 min-h-20 text-sm text-slate-400">{plan.copy}</p><div className="mt-4 space-y-2 text-sm">{plan.features.map(feature=><p key={feature}>✓ {feature}</p>)}</div><Link className="button-secondary mt-6 !px-3 !py-2" href={plan.name==="Enterprise"?"/enterprise/pilot":"/signup"}>{plan.name==="Enterprise"?"Request pilot":"Start"}</Link></article>)}</div></section><section className="border-y border-slate-800 py-12"><div className="container-page grid gap-8 md:grid-cols-2"><div><h2 className="text-xl font-semibold">Billing behavior</h2><p className="mt-3 text-sm leading-6 text-slate-400">Trials expire after the configured window. Payment failures enter a limited grace period. Plan activation and changes require server-verified Razorpay signatures.</p></div><div><h2 className="text-xl font-semibold">Need deployment review?</h2><p className="mt-3 text-sm leading-6 text-slate-400">Enterprise pricing depends on message volume, deployment model, support expectations, and integration scope.</p><Link href="/contact" className="mt-4 inline-block text-cyan hover:underline">Contact sales</Link></div></div></section><section className="container-page py-16"><h2 className="text-2xl font-semibold">Works with your favorite platforms</h2><p className="mt-3 text-slate-400">All integrations work with every plan. Install SoterAI guard nodes directly inside your workflow tools.</p><div className="mt-6 flex flex-wrap gap-3 text-sm">{["n8n","Dify","Zapier","Make.com","Botpress","Flowise","Langflow","Voiceflow","REST API","JavaScript SDK","Python SDK"].map(p=><span key={p} className="rounded-full border border-slate-700 px-4 py-1.5 text-slate-300">{p}</span>)}</div></section><section className="border-t border-slate-800 py-16"><div className="container-page"><h2 className="text-2xl font-semibold">Frequently asked questions</h2><div className="mt-8 grid gap-6 md:grid-cols-2">{faqs.map(faq=><div key={faq.q} className="card p-5"><h3 className="font-semibold text-white">{faq.q}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{faq.a}</p></div>)}</div></div></section></main>}
