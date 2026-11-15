import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: { absolute: "SoterAI and PromptArmor | Product Comparison" },
  description: "PromptArmor and SoterAI: compare AI vendor risk intelligence with application security checks, using current product sources.",
  alternates: { canonical: "/comparison/prompt-armor" },
  openGraph: { title: "SoterAI and PromptArmor | Product Comparison", description: "PromptArmor and SoterAI: compare AI vendor risk intelligence with application security checks, using current product sources." },
};

const data: VsContent = {
  "slug": "prompt-armor",
  "competitor": "PromptArmor",
  "kind": "AI risk intelligence platform",
  "summary": "PromptArmor provides AI risk intelligence for assessing vendors and other AI assets. SoterAI provides checks that applications can integrate around prompts, replies and agent actions. These address different parts of an AI security program.",
  "facts": [
    {
      "label": "Focus",
      "value": "Assessing and monitoring AI risks in vendors and other assets"
    },
    {
      "label": "Asset coverage",
      "value": "Vendors, models, skills, connectors and MCP servers"
    },
    {
      "label": "Monitoring",
      "value": "Tracks changes in AI vendor behavior and surfaces risk intelligence"
    },
    {
      "label": "Integration",
      "value": "API access connects intelligence to existing systems and workflows"
    }
  ],
  "chooseThem": [
    "Your team needs intelligence for AI vendor reviews and ongoing risk monitoring.",
    "You want to enrich your inventory of AI assets with risk information."
  ],
  "chooseUs": [
    "You need checks inside an application around prompt, reply or tool-call boundaries.",
    "You want to test configured detection, redaction and action policies with your application traffic."
  ],
  "sources": [
    {
      "label": "PromptArmor: official product website",
      "href": "https://www.promptarmor.com/"
    }
  ],
  "readOn": "2026-11-15"
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
