import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export default async function SemanticEgressPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Detect"
        title="Semantic Egress"
        description="Catch paraphrased or reworded confidential data leaving your system, even when it no longer matches the original text."
        useCase="Traditional DLP breaks the moment sensitive data is rephrased — a model or an insider can summarize, translate, or reword a confidential record and slip past exact pattern matching. Semantic Egress fingerprints your sensitive sources by meaning, then compares outbound content against those fingerprints so leakage is caught even when the wording is completely different from the source."
        howItWorks={[
          { heading: "Fingerprint sensitive sources", body: "Register confidential sources with a sensitivity level. Each is reduced to a semantic fingerprint — keywords, entities, phrases, and signals — plus a content hash. Raw content is redacted, so the fingerprint captures meaning without storing the secret verbatim." },
          { heading: "Check outbound content", body: "Before content leaves for a destination (final output, external API, email, webhook, browser form, tool, memory, or file), submit it for an egress check against the relevant source fingerprints." },
          { heading: "Score similarity and destination risk", body: "A semantic risk score combines how closely the content matches a sensitive source with how risky the destination is — external destinations weigh heavier than internal ones — and each match is reported with its similarity and sensitivity level." },
          { heading: "Decide and record", body: "The check returns a decision — ALLOW, REDACT, ASK_APPROVAL, REVIEW, or BLOCK — with findings and matched sources, and persists a redacted record of the check for audit and traceability." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({
  apiKey: process.env.SOTER_API_KEY,
});

// 1. Fingerprint a confidential source (stored by meaning, redacted)
await soter.semanticEgress.fingerprintSource({
  sourceId: "customer-db",
  sourceType: "database",
  sensitivityLevel: "CONFIDENTIAL",
  content: customerData,
});

// 2. Check LLM output before it leaves the system
const result = await soter.semanticEgress.checkEgress({
  destinationType: "EMAIL",
  content: llmResponse,
  sourceIds: ["customer-db"],
});

if (result.decision === "BLOCK" || result.decision === "ASK_APPROVAL") {
  // paraphrased confidential data detected — hold or drop the output
}`}
        callout="The decision Semantic Egress returns is only enforced if your application acts on it — the API scores and records the egress check, but blocking or redacting outbound content is up to the caller that receives the decision. Similarity scoring is heuristic, so tune sensitivity thresholds and expect both misses and false positives."
        relatedDocs={[
          { label: "Semantic Egress", href: "/docs/services/semantic-egress" },
          { label: "Agent Firewall", href: "/docs/services/agent-firewall" },
        ]}
      />
      <div>Semantic Egress Dashboard</div>
    </div>
  );
}
