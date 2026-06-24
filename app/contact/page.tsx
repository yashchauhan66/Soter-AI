import type { Metadata } from "next";
import { ContactSalesForm } from "@/components/ops/ContactSalesForm";

export const metadata: Metadata = {
  title: "Contact Sales | SoterAI AI Security",
  description:
    "Contact SoterAI sales to discuss your AI security workflow. Share architecture and scale requirements for chatbot, RAG, and agent protection.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage(){return <main className="container-page py-16"><p className="eyebrow">Contact sales</p><h1 className="mt-2 text-4xl font-bold">Discuss your AI security workflow</h1><p className="mb-10 mt-4 max-w-2xl text-slate-400">Share architecture and scale requirements without credentials, raw secrets, or unredacted customer conversations.</p><div className="max-w-3xl"><ContactSalesForm /></div></main>}
