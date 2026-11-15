import type { Metadata } from "next";
import { VsCompetitor, type VsContent } from "@/components/marketing/VsCompetitor";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "SoterAI vs Guardrails AI: Facts and Dates",
  description:
    "Guardrails AI is an open-source Python framework. Facts from its own README and repository, facts about SoterAI, and when each is the better choice.",
  path: "/comparison/guardrails-ai",
});

const data: VsContent = {
  slug: "guardrails-ai",
  competitor: "Guardrails AI",
  kind: "Open-source Python framework",
  readOn: "2026-11-10",
  summary:
    "Guardrails AI is a library you run inside your own Python code. SoterAI is a service with an API. They solve overlapping problems in different ways.",
  facts: [
    { label: "What it is", value: "A Python framework that runs input and output guards to detect and reduce specific risks, and helps generate structured data from models." },
    { label: "License", value: "Apache-2.0, per its README badge. The repository was not archived on 2026-11-09, with a last push on 2026-11-05 (GitHub API)." },
    { label: "How you get it", value: "pip install guardrails-ai. Validators come from Guardrails Hub." },
    { label: "Change to note", value: "The README announces that validators are moving to standard PyPI packages and that hosted remote inferencing is being discontinued, with a planned cutoff of 2026-08-25." },
    { label: "Where it runs", value: "In your process. You host and operate it." },
  ],
  chooseThem: [
    "You are a Python team that wants Apache-2.0 code you can read, change and run without a vendor.",
    "You need model output checked against a schema or structure.",
    "You prefer to assemble checks from a library of validators and own the policy in code.",
  ],
  chooseUs: [
    "You want a hosted service with an approval queue and an audit record, without building them.",
    "You work in JavaScript or want a REST API from any language.",
    "You want to try an engine on your own text in a browser before you install anything.",
  ],
  sources: [
    { label: "Guardrails AI README", href: "https://github.com/guardrails-ai/guardrails" },
    { label: "GitHub API for the repository", href: "https://api.github.com/repos/guardrails-ai/guardrails" },
  ],
};

export default function Page() {
  return <VsCompetitor data={data} />;
}
