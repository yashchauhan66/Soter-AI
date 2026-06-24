import type { Metadata } from "next";
import { ReadinessPage } from "@/lib/compliance/publicContent";

export const metadata: Metadata = {
  title: "ISO 27001 Readiness | SoterAI",
  description:
    "SoterAI ISO 27001 readiness materials covering risk management, asset handling, access control, cryptography, operations security, and incident response planning.",
  alternates: { canonical: "/compliance/iso27001-readiness" },
};

export default function Iso27001ReadinessPage() {
  return (
    <ReadinessPage title="ISO 27001 Readiness">
      <p>SoterAI is not claiming ISO 27001 certification. Readiness materials cover risk management, asset handling, access control, cryptography, operations security, supplier risk, incident response, and continuity planning.</p>
      <p>Certification requires a scoped ISMS, internal audit, management review, corrective actions, and an accredited certification body.</p>
    </ReadinessPage>
  );
}
