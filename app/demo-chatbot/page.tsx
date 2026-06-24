import type { Metadata } from "next";
import { DemoChatClient } from "@/components/guard/DemoChatClient";

export const metadata: Metadata = {
  title: "AI Chatbot Security Demo | SoterAI",
  description:
    "Interactive demo showing how SoterAI guards chatbot inputs and outputs. See prompt injection blocking and PII redaction in real time.",
  alternates: { canonical: "/demo-chatbot" },
};

export default function DemoChatbotPage() { return <main className="container-page py-16"><div className="mx-auto mb-10 max-w-3xl text-center"><p className="eyebrow">Before and after</p><h1 className="mt-3 text-4xl font-bold">Watch a chatbot flow change with a guard.</h1><p className="mt-4 text-lg leading-8 text-slate-400">This simulation demonstrates blocking and redaction without sending content to an external AI provider.</p></div><DemoChatClient/></main>; }
