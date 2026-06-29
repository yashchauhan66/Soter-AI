import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Security Demos",
  description:
    "Explore SoterAI live demos: a guarded chatbot, a RAG workflow with document quarantine and ACL enforcement, and safe red-team scenarios against an owned demo project.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "AI Security Demos | SoterAI",
    description:
      "See SoterAI defend a chatbot, a RAG pipeline, and agents against real attack scenarios.",
    url: "/demo",
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
