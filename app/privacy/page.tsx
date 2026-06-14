import { ReadinessPage } from "@/lib/compliance/publicContent";

export default function PrivacyPage() {
  return (
    <ReadinessPage title="Privacy">
      <p>CyberRakshak Guard minimizes retained content by storing redacted text, hashes, previews, and structured findings where practical. Raw API keys, SCIM tokens, SAML secrets, integration tokens, and detected secrets are not stored.</p>
      <p>Enterprise administrators can configure retention windows and request deletion workflows from the dashboard. Billing and payment records may be retained where legally required.</p>
    </ReadinessPage>
  );
}
