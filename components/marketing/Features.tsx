import { Ban, DatabaseZap, FileSearch, Fingerprint, Gauge, ScanText } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const features = [
  [Ban, "Injection and jailbreak defense", "Pattern-based, explainable detection for instruction overrides, jailbreak personas, and control bypass attempts."],
  [Fingerprint, "India-specific PII", "Detect Aadhaar-like patterns, PAN, GSTIN, UPI IDs, IFSC, Indian mobile numbers, and contextual identifiers."],
  [DatabaseZap, "Secret leakage prevention", "Redact API keys, tokens, private keys, environment assignments, and database URLs without storing raw values."],
  [ScanText, "Output safety guard", "Inspect model responses for system prompt leakage, sensitive data, unsafe claims, and suspicious links."],
  [Gauge, "Risk scoring and decisions", "Turn findings into an understandable 0-100 risk score and allow, redact, review, rewrite, or block action."],
  [FileSearch, "Monitoring and reports", "Track recent decisions, usage, top risks, redactions, blocked requests, and monthly recommendations."],
];

export function Features() { return <section id="features" className="py-24"><div className="container-page"><SectionHeading eyebrow="Defense in depth" title="A practical security layer around every chatbot turn" copy="Rules are modular, decisions are explainable, and controls cover both user input and AI output." /><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{features.map(([Icon, title, copy]) => { const FeatureIcon = Icon as typeof Ban; return <article key={String(title)} className="card p-6"><span className="inline-flex rounded-xl bg-cyan/10 p-3 text-cyan"><FeatureIcon /></span><h3 className="mt-5 text-xl font-semibold">{String(title)}</h3><p className="mt-3 leading-7 text-slate-400">{String(copy)}</p></article>; })}</div></div></section>; }
