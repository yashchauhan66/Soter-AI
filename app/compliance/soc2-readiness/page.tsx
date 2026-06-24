import type { Metadata } from "next";
import { ReadinessPage } from "@/lib/compliance/publicContent";

export const metadata: Metadata = {
  title: "SOC 2 Readiness | SoterAI",
  description:
    "SoterAI SOC 2 readiness program covering access control, change management, vulnerability management, audit logging, backup/restore, incident response, and vendor risk.",
  alternates: { canonical: "/compliance/soc2-readiness" },
};

export default function Soc2ReadinessPage() {
  return (
    <ReadinessPage title="SOC 2 Readiness">
      <p>SoterAI is not claiming SOC 2 certification. The readiness program tracks access control, change management, vulnerability management, audit logging, backup/restore, incident response, and vendor risk controls.</p>
      <p>Production certification requires an independent audit, evidence collection, management assertions, and environment-specific control operation.</p>
    </ReadinessPage>
  );
}
