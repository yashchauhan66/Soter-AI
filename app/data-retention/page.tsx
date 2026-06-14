import { ReadinessPage } from "@/lib/compliance/publicContent";

export default function PublicDataRetentionPage() {
  return (
    <ReadinessPage title="Data Retention">
      <p>Enterprise tenants can configure 7, 30, 90, 180, 365, or custom retention windows. Policies can apply to guard logs, webhook deliveries, and security events depending on operational requirements.</p>
      <p>Deletion workflows require explicit confirmation phrases, owner/admin authorization, job tracking, and audit logs. Export review is recommended before destructive deletion.</p>
    </ReadinessPage>
  );
}
