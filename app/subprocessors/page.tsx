import { ReadinessPage } from "@/lib/compliance/publicContent";

export default function SubprocessorsPage() {
  return (
    <ReadinessPage title="Subprocessors">
      <p>Self-hosted deployments can run without CyberRakshak-operated subprocessors. Managed deployments should list cloud hosting, email, payment, observability, OCR, vector, and KMS providers used by the customer environment.</p>
      <p>This placeholder should be completed with provider names, processing purpose, region, and data categories before production launch.</p>
    </ReadinessPage>
  );
}
