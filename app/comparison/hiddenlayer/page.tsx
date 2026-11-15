import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs HiddenLayer: Facts and Dates",
  description:
    "HiddenLayer is an enterprise AI security platform. Facts from its own homepage, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/hiddenlayer",
});

const data: VsContent = {
  slug: "hiddenlayer",
  competitor: "HiddenLayer",
  kind: "Vendor platform",
  readOn: "2026-11-10",
  summary:
    "HiddenLayer sells a platform that covers models as well as applications. SoterAI is narrower: it checks prompts, replies and agent actions.",
  facts: [
    { label: "What it says it is", value: "An AI security platform for agentic, generative and predictive AI across the lifecycle." },
    { label: "Capabilities on its homepage", value: "Model scanning, red teaming, AI guardrails, agentic and MCP protection, and a firewall that monitors, detects and responds to adversarial threats in real time." },
    { label: "Integrations named", value: "It says agent and model detections can be sent to Splunk or Microsoft Sentinel." },
    { label: "Proof shown", value: "Named security leaders are quoted on its homepage. We did not check those quotes." },
    { label: "Terms", value: "Commercial. Pricing was not published on the page read." },
  ],
  chooseThem: [
    "You need to scan third-party models and test your defenses in the same platform.",
    "You want detections to flow into an existing Splunk or Sentinel workflow.",
    "You are a larger organization buying an enterprise platform.",
  ],
  chooseUs: [
    "Your need is checking prompts, replies and agent actions, not scanning models.",
    "You want a free plan and a no-signup playground on the real engine.",
    "You want published limits and known gaps next to every number.",
  ],
  sources: [{ label: "HiddenLayer homepage", href: "https://www.hiddenlayer.com/" }],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
