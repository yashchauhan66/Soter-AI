import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs NeMo Guardrails: Facts and Dates",
  description:
    "NeMo Guardrails is an open-source toolkit from NVIDIA. Facts from its README and repository, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/nemo-guardrails",
});

const data: VsContent = {
  slug: "nemo-guardrails",
  competitor: "NVIDIA NeMo Guardrails",
  kind: "Open-source toolkit",
  readOn: "2026-11-10",
  summary:
    "NeMo Guardrails controls how a conversational app behaves. SoterAI checks the text and actions that pass through it. Some teams use both.",
  facts: [
    { label: "What it is", value: "An open-source toolkit for adding programmable guardrails between application code and the model in conversational apps: topics to avoid, dialog paths, response style, tool use and structured data." },
    { label: "License", value: "The LICENSE.md header names Apache-2.0, while GitHub’s license field shows “Other” (2026-11-09). The repository was not archived." },
    { label: "Release", value: "Its README names 0.24.1 as the latest release. Python 3.11 to 3.13." },
    { label: "Documentation", value: "docs.nvidia.com/nemo/guardrails" },
    { label: "Where it runs", value: "In your process. You host and operate it." },
  ],
  chooseThem: [
    "You need programmable control of conversation flow, not only detection of bad inputs.",
    "You are building on the NVIDIA ecosystem and want an open-source toolkit you can change.",
    "You are comfortable writing and testing guardrail configuration yourself.",
  ],
  chooseUs: [
    "You want detection of injection, secrets and personal data, with a verdict you can act on, from a hosted API.",
    "You want risky agent actions held for approval and each decision logged.",
    "You want to try it on your own text without installing anything.",
  ],
  sources: [
    { label: "NeMo Guardrails README", href: "https://github.com/NVIDIA-NeMo/Guardrails" },
    { label: "LICENSE.md header", href: "https://github.com/NVIDIA-NeMo/Guardrails/blob/develop/LICENSE.md" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
