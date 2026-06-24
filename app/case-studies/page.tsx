import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Case Studies | SoterAI AI Security",
  description:
    "SoterAI customer case studies showing AI security deployment for chatbots, RAG apps, and autonomous agents with measurable risk reduction.",
  alternates: { canonical: "/case-studies" },
};

export default function CaseStudiesPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Case studies</p>
      <h1 className="mt-2 text-4xl font-bold">AI security case study template</h1>
      <p className="mt-5 max-w-3xl text-slate-300">Describe the customer AI workflow, risk categories, deployed guardrails, measurable risk reduction, operational lessons, and approved defensive testing scope.</p>
    </main>
  );
}
