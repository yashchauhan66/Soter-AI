import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust Center | SoterAI Security",
  description:
    "SoterAI trust center: OWASP LLM Top 10 aligned AI security command layer for chatbots, RAG apps, and AI agents. Defense-in-depth risk reduction with transparent limitations.",
  alternates: { canonical: "/trust" },
  openGraph: {
    title: "Trust Center | SoterAI",
    description: "Transparent AI security with OWASP LLM Top 10 alignment, defense-in-depth controls, and honest scope limitations.",
  },
};

export default function TrustPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Trust</p>
      <h1 className="mt-3 text-4xl font-bold">SoterAI Trust Center</h1>
      <div className="mt-8 max-w-3xl space-y-5 leading-7 text-slate-400">
        <p>SoterAI is an OWASP LLM Top 10 aligned AI security command layer focused on risk reduction for chatbots, RAG apps, and AI agents.</p>
        <p>It does not claim complete protection or certification. Customers remain responsible for secure design, access control, monitoring, incident response, and human oversight.</p>
      </div>
    </main>
  );
}