import type { Metadata } from "next";
import { ReadinessPage } from "@/lib/compliance/publicContent";

export const metadata: Metadata = {
  title: "Subprocessors | SoterAI Data Processing",
  description:
    "SoterAI subprocessor list: Vercel, Upstash, Resend, Razorpay, Qdrant, Google Cloud KMS, and AWS/GCP for observability. Self-hosted deployments can run without managed subprocessors.",
  alternates: { canonical: "/subprocessors" },
};

export default function SubprocessorsPage() {
  const subprocessors = [
    { name: "Vercel", purpose: "Cloud hosting and edge functions", region: "Global (multi-region)", data: "Application logs, metadata" },
    { name: "Upstash", purpose: "Redis-compatible rate limiting and caching", region: "us-east-1 / eu-west-1", data: "Usage counters, rate limit state" },
    { name: "Resend", purpose: "Transactional email delivery", region: "us-east-1", data: "User email address" },
    { name: "Razorpay", purpose: "Payment processing and subscription billing", region: "India", data: "Organization billing details" },
    { name: "Qdrant", purpose: "Vector store for RAG semantic search", region: "Customer-configured", data: "Document embeddings" },
    { name: "Tesseract.js", purpose: "OCR document scanning", region: "In-process (no external transfer)", data: "Document images (transient)" },
    { name: "Google Cloud KMS", purpose: "Optional: customer-managed encryption keys", region: "Customer-configured", data: "Encryption key metadata" },
    { name: "AWS/GCP Observability", purpose: "Optional: SIEM export and metrics", region: "Customer-configured", data: "Anonymized security events" },
  ];

  return (
    <ReadinessPage title="Subprocessors">
      <p className="mb-6 max-w-2xl text-slate-400">
        Self-hosted deployments can run without SoterAI-operated subprocessors.
        Managed deployments use the following subprocessors to deliver the service.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-xs uppercase tracking-wider text-slate-500">
              <th className="pb-3 pr-4 font-medium">Provider</th>
              <th className="pb-3 pr-4 font-medium">Purpose</th>
              <th className="pb-3 pr-4 font-medium">Region</th>
              <th className="pb-3 font-medium">Data Categories</th>
            </tr>
          </thead>
          <tbody>
            {subprocessors.map((sp) => (
              <tr key={sp.name} className="border-b border-slate-800">
                <td className="py-3 pr-4 font-medium text-cyan">{sp.name}</td>
                <td className="py-3 pr-4 text-slate-300">{sp.purpose}</td>
                <td className="py-3 pr-4 text-slate-400">{sp.region}</td>
                <td className="py-3 text-slate-400">{sp.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReadinessPage>
  );
}
