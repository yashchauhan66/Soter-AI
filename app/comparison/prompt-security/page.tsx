import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs Prompt Security: Facts and Dates",
  description:
    "Prompt Security is now part of SentinelOne. Facts from SentinelOne’s own announcement, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/prompt-security",
});

const data: VsContent = {
  slug: "prompt-security",
  competitor: "Prompt Security",
  kind: "Vendor platform, now part of SentinelOne",
  readOn: "2026-11-10",
  summary:
    "Prompt Security is an AI runtime security vendor that SentinelOne agreed to acquire in 2025. Both aim to control AI use and data leakage, and they differ in size and in how you buy.",
  facts: [
    { label: "Owner", value: "SentinelOne announced a definitive agreement to acquire Prompt Security on 2025-08-05. A later SentinelOne release describes the acquisition as completed." },
    { label: "What the owner says it does", value: "Secures AI in runtime, prevents AI-related data leakage and protects agents." },
    { label: "Terms", value: "Commercial. Pricing was not checked for this page." },
  ],
  chooseThem: [
    "You already use SentinelOne and want AI controls from the same vendor.",
    "You want a vendor with a large security company behind it and enterprise contracts.",
  ],
  chooseUs: [
    "You want a free plan and a no-signup playground on the real engine.",
    "You want published limits and known gaps next to every number.",
    "You want to self-host with Docker, Postgres and Redis.",
  ],
  sources: [
    { label: "SentinelOne: to acquire Prompt Security, 2025-08-05", href: "https://www.sentinelone.com/press/sentinelone-to-acquire-prompt-security-to-advance-genai-security/" },
    { label: "SentinelOne release naming the completed acquisition (via Nasdaq)", href: "https://www.nasdaq.com/press-release/sentineloner-named-leader-gartnerr-magic-quadranttm-endpoint-protection-platforms-6th" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
