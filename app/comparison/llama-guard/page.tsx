import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";

export const metadata: Metadata = {
  title: { absolute: "SoterAI and Meta Llama Guard 3 | Product Comparison" },
  description: "Llama Guard 3 and SoterAI: a source-linked overview of Meta's safety classifier, deployment choices, and evaluation considerations.",
  alternates: { canonical: "/comparison/llama-guard" },
  openGraph: { title: "SoterAI and Meta Llama Guard 3 | Product Comparison", description: "Llama Guard 3 and SoterAI: a source-linked overview of Meta's safety classifier, deployment choices, and evaluation considerations." },
};

const data: VsContent = {
  "slug": "llama-guard",
  "competitor": "Meta Llama Guard 3",
  "kind": "Open-weight safety classifier",
  "summary": "Llama Guard 3 is Meta's Llama-based safety classifier. Its 8B model classifies conversational content against defined safety categories. SoterAI offers application checks for prompts, replies and agent actions.",
  "facts": [
    {
      "label": "Provider",
      "value": "Meta"
    },
    {
      "label": "Model covered here",
      "value": "Llama Guard 3 8B, based on Llama 3.1 8B"
    },
    {
      "label": "Output",
      "value": "A safe or unsafe assessment, with violated categories for unsafe content"
    },
    {
      "label": "Access and terms",
      "value": "Model weights are subject to the model card access requirements and Llama 3.1 license."
    }
  ],
  "chooseThem": [
    "You want a model-based content safety classifier to integrate into your own inference stack.",
    "You can evaluate its safety categories, license and runtime requirements against your application."
  ],
  "chooseUs": [
    "You need application-level prompt and reply checks with configured redaction and agent action policies.",
    "You want to evaluate the hosted API or self-hosted service against your own traffic and documented limits."
  ],
  "sources": [
    {
      "label": "Meta: Llama Guard 3 8B model card",
      "href": "https://huggingface.co/meta-llama/Llama-Guard-3-8B"
    }
  ],
  "readOn": "2026-11-15"
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
