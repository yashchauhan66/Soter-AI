import { ReadinessPage } from "@/lib/compliance/publicContent";

export default function ResponsibleDisclosurePage() {
  return (
    <ReadinessPage title="Responsible Disclosure">
      <p>Report suspected vulnerabilities to the security contact listed in your enterprise agreement or deployment runbook. Include affected URLs, impact, reproduction steps, and whether any data was accessed.</p>
      <p>Only test systems you own or are authorized to assess. Do not access, modify, delete, or exfiltrate data that is not yours.</p>
    </ReadinessPage>
  );
}
