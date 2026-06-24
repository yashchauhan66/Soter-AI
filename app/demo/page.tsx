import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "AI Security Demos | SoterAI",
  description:
    "Explore SoterAI guarded AI workflows: sample chatbot with input/output guard, RAG document security demo, and red-team validation. Interactive playground included.",
  alternates: { canonical: "/demo" },
  openGraph: {
    title: "AI Security Demos | SoterAI",
    description: "See SoterAI in action: chatbot guard, RAG document security, and red-team validation demos.",
  },
};

const demos=[["Sample chatbot","Inspect defensive input and output decisions.","/demo-chatbot"],["Sample RAG workflow","See document quarantine, ACL, and grounding stages.","/demo/rag"],["Red-team demo mode","Run safe scenarios only against an owned demo project.","/demo/red-team"],["Live playground","Test your own non-sensitive examples.","/playground"]];
export default function DemoPage(){return <main className="container-page py-16"><p className="eyebrow">Product demos</p><h1 className="mt-2 text-4xl font-bold">Explore guarded AI workflows</h1><p className="mt-4 max-w-3xl text-slate-400">These demos illustrate risk reduction and defense-in-depth behavior. They do not demonstrate offensive exploitation or guarantee complete detection.</p><div className="mt-10 grid gap-4 md:grid-cols-2">{demos.map(([title,copy,href])=><Link className="card p-6 hover:border-cyan/50" href={href} key={title}><h2 className="text-xl font-semibold">{title}</h2><p className="mt-2 text-sm text-slate-400">{copy}</p></Link>)}</div><section className="mt-12 border-t border-slate-800 pt-8"><h2 className="text-xl font-semibold">Demo video</h2><div className="mt-4 flex aspect-video max-w-3xl items-center justify-center border border-dashed border-slate-700 bg-slate-950 text-slate-500">Launch walkthrough video placeholder</div></section></main>}
