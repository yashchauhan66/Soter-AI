import { Check } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const plans = [
  ["Free", "INR 0", "Validate a small AI workflow"],
  ["Starter", "INR 999", "Protect production chatbot traffic"],
  ["Pro", "INR 2,999", "Team controls and deeper reporting"],
  ["Agency", "INR 9,999", "Multi-client security operations"],
];

export function Pricing() {
  return (
    <section className="py-24">
      <div className="container-page">
        <SectionHeading center eyebrow="Plans" title="Start lean, scale with security operations" copy="Pricing is a launch preview while billing is finalized." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {plans.map(([name, price, detail], i) => (
            <article key={name} className={`card p-6 ${i === 1 ? "border-cyan/60" : ""}`}>
              <p className="font-semibold text-cyan">{name}</p>
              <p className="mt-5 text-3xl font-bold">{price}<span className="text-sm font-normal text-slate-500">/mo</span></p>
              <p className="mt-3 text-sm text-slate-400">{detail}</p>
              <div className="mt-6 space-y-3 text-sm text-slate-300">
                {["Input and output guard", "Risk logs", "Redaction engine"].map((x) => <p key={x} className="flex gap-2"><Check size={16} className="text-lime" aria-hidden="true" />{x}</p>)}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}