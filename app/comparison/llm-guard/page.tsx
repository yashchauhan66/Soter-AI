import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs LLM Guard: Facts and Dates",
  description:
    "LLM Guard is an MIT scanner library that is now archived. Facts from its repository, facts about SoterAI, and what to check before you choose.",
  path: "/comparison/llm-guard",
});

const data: VsContent = {
  slug: "llm-guard",
  competitor: "LLM Guard",
  kind: "Open-source scanner library, archived",
  readOn: "2026-11-10",
  summary:
    "LLM Guard was a Python library of scanners for prompts and replies. Its repository is archived, so the main question is whether you want to depend on code that nobody maintains.",
  facts: [
    { label: "What it is", value: "A Python toolkit of scanners for sanitizing prompts and replies, detecting harmful language, preventing data leakage and resisting prompt injection." },
    { label: "License", value: "MIT." },
    { label: "Status", value: "The README warns that the project is archived and that it and its models on Hugging Face are no longer under active development or maintained. Last push 2026-07-08 (GitHub API, 2026-11-09)." },
    { label: "Owner", value: "Protect AI. Palo Alto Networks announced that it had completed its acquisition of Protect AI in 2025." },
    { label: "Where it runs", value: "In your process. You host and operate it." },
  ],
  chooseThem: [
    "You want MIT code you can fork and own, and you accept that you would maintain it.",
    "You need a few offline scanners and can keep them updated yourself.",
  ],
  chooseUs: [
    "You want a product that is under active development, with a changelog.",
    "You want a hosted API, an approval queue and an audit record.",
    "You want published limits next to the numbers.",
  ],
  sources: [
    { label: "LLM Guard README and repository", href: "https://github.com/protectai/llm-guard" },
    { label: "GitHub API for the repository", href: "https://api.github.com/repos/protectai/llm-guard" },
    { label: "Palo Alto Networks: completes acquisition of Protect AI", href: "https://www.paloaltonetworks.com/company/press/2025/palo-alto-networks-completes-acquisition-of-protect-ai" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
