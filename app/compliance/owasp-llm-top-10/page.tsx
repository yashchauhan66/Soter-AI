import { owaspMappings, ReadinessPage } from "@/lib/compliance/publicContent";

export default function OwaspLlmTop10Page() {
  return (
    <ReadinessPage title="OWASP LLM Top 10 Alignment">
      <p>SoterAI maps product controls to OWASP LLM Top 10 risk categories as a practical alignment guide. Alignment is not certification.</p>
      <div className="space-y-3">
        {owaspMappings.map(([risk, control]) => (
          <div className="rounded-lg border border-slate-800 p-4" key={risk}>
            <h2 className="font-semibold">{risk}</h2>
            <p className="mt-2 text-sm text-slate-400">{control}</p>
          </div>
        ))}
      </div>
    </ReadinessPage>
  );
}
