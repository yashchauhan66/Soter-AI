import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs Lakera: Facts and Dates",
  description:
    "Looking for a Lakera alternative? Facts about Lakera from Check Point’s own pages, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/lakera",
});

const data: VsContent = {
  slug: "lakera",
  competitor: "Lakera",
  kind: "Vendor platform, now part of Check Point",
  readOn: "2026-11-10",
  summary:
    "Lakera is an AI security platform that Check Point announced it would acquire on 2025-09-16. Both check prompts and replies for injection and data leakage, and they differ in size, price model and proof.",
  facts: [
    { label: "Owner", value: "Check Point announced the agreement on 2025-09-16. Its Q3 2025 results release describes the Lakera acquisition as made." },
    { label: "What the owner says it does", value: "Pre-deployment posture assessment (AI Red Teaming) and real-time runtime enforcement (AI Agent Security) for LLMs, agents and multimodal workflows." },
    { label: "Vendor figures", value: "The announcement quotes its own detection, latency, false-positive and language figures. They are Check Point’s claims. We have not tested them." },
    { label: "Terms", value: "Commercial. Pricing was not published on the pages read." },
  ],
  chooseThem: [
    "You want a vendor backed by a large security company and its enterprise contracts.",
    "You want runtime protection and a red-teaming product from the same vendor.",
    "Your procurement requires a vendor of that size.",
  ],
  chooseUs: [
    "You want to try the real engine on your own text with no signup, and start on a free plan.",
    "You want published limits and known gaps beside every number.",
    "You want to self-host with Docker, Postgres and Redis.",
  ],
  sources: [
    { label: "Check Point press release, 2025-09-16", href: "https://www.checkpoint.com/press-releases/check-point-acquires-lakera-to-deliver-end-to-end-ai-security-for-enterprises/" },
    { label: "Check Point Q3 2025 results", href: "https://www.checkpoint.com/press-releases/check-point-software-reports-2025-third-quarter-financial-results/" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
