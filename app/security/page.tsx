import { ReadinessPage } from "@/lib/compliance/publicContent";

export default function SecurityPage() {
  return (
    <ReadinessPage title="Security Overview">
      <p>Controls include tenant isolation, RBAC, hashed API and SCIM tokens, redacted logs, webhook signing, KMS-backed secret storage options, SAML SSO, SCIM v2 provisioning, audit exports, and SIEM delivery.</p>
      <p>For AI-specific risk reduction, the gateway can detect, block, redact, monitor, and report prompt injection, secrets, PII, unsafe outputs, system prompt leakage, RAG poisoning, and grounding failures.</p>
      <p>Security is operated as defense-in-depth. No public page should be read as a promise of complete protection.</p>
    </ReadinessPage>
  );
}
