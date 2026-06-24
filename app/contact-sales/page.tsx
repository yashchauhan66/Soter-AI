import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Enterprise Sales | SoterAI",
  description:
    "Plan your enterprise AI security deployment with SoterAI. SSO, SCIM, compliance readiness, data retention, SIEM, and self-hosting for high-scale AI workloads.",
  alternates: { canonical: "/contact-sales" },
};

export default function ContactSalesPage() {
  return (
    <main className="container-page py-16">
      <p className="eyebrow">Contact sales</p>
      <h1 className="mt-2 text-4xl font-bold">Plan an enterprise deployment</h1>
      <p className="mt-5 max-w-3xl text-slate-300">Use this route to connect enterprise buyers with deployment planning for SSO, SCIM, compliance readiness, retention, SIEM, and self-hosting.</p>
    </main>
  );
}
