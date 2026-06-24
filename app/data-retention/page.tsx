import type { Metadata } from "next";
import { ReadinessPage } from "@/lib/compliance/publicContent";

export const metadata: Metadata = {
  title: "Data Retention Policy | SoterAI",
  description:
    "SoterAI data retention policies: configurable 7, 30, 90, 180, 365-day or custom retention windows for guard logs, webhook deliveries, and security events.",
  alternates: { canonical: "/data-retention" },
};

export default function PublicDataRetentionPage() {
  return (
    <ReadinessPage title="Data Retention">
      <p>Enterprise tenants can configure 7, 30, 90, 180, 365, or custom retention windows. Policies can apply to guard logs, webhook deliveries, and security events depending on operational requirements.</p>
      <p>Deletion workflows require explicit confirmation phrases, owner/admin authorization, job tracking, and audit logs. Export review is recommended before destructive deletion.</p>
    </ReadinessPage>
  );
}
