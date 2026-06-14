import { ReadinessPage, trustPrinciples } from "@/lib/compliance/publicContent";

export default function TrustPage() {
  return (
    <ReadinessPage title="CyberRakshak Guard Trust Center">
      <p>CyberRakshak Guard is an OWASP LLM Top 10 aligned AI security gateway focused on risk reduction for chatbots, RAG apps, and AI agents.</p>
      <ul className="list-disc space-y-2 pl-5">{trustPrinciples.map((item) => <li key={item}>{item}</li>)}</ul>
      <p>Current public materials cover security architecture, privacy, subprocessors, data retention, responsible disclosure, and SOC 2 / ISO 27001 readiness status.</p>
    </ReadinessPage>
  );
}
