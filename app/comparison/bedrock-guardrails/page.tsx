import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs Bedrock Guardrails: Facts",
  description:
    "Amazon Bedrock Guardrails is AWS’s built-in guardrails service. Facts from AWS’s own docs, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/bedrock-guardrails",
});

const data: VsContent = {
  slug: "bedrock-guardrails",
  competitor: "Amazon Bedrock Guardrails",
  kind: "Cloud guardrails, AWS",
  readOn: "2026-11-10",
  summary:
    "Bedrock Guardrails is built into AWS. If you already run your models there, it is the closest fit. SoterAI is not tied to one cloud.",
  facts: [
    { label: "Filters", value: "Content filters (hate, insults, sexual, violence, misconduct and prompt attack), denied topics, word filters, sensitive-information filters, contextual grounding checks and automated reasoning checks." },
    { label: "Sensitive data", value: "Blocks or masks sensitive information such as PII using probabilistic detection, and supports custom regular expressions." },
    { label: "How you call it", value: "During a model invocation by guardrail ID and version, or on its own through the ApplyGuardrail API without invoking a model." },
    { label: "Tiers", value: "Classic and Standard tiers. The Standard tier extends some protections to harmful content in code elements." },
    { label: "Terms", value: "Hosted by AWS and billed through AWS." },
  ],
  chooseThem: [
    "You already run your models on AWS and want guardrails inside the same account, billing and permissions.",
    "You need content-safety categories or grounding checks for model answers.",
    "You want to configure and test guardrails in the AWS console.",
  ],
  chooseUs: [
    "You are not tied to AWS, or you use several clouds and providers.",
    "You want the same checks in an editor, a browser and automation workflows, not only in API calls.",
    "You want to try it on your own text with no cloud account.",
  ],
  sources: [
    { label: "Amazon Bedrock Guardrails, AWS documentation", href: "https://docs.aws.amazon.com/bedrock/latest/userguide/guardrails.html" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
