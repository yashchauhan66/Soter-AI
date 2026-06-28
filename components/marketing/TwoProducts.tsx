import Link from "next/link";
import { ArrowRight, Gauge, Landmark, Shield, Users, FileText, Scale, Lock, Eye } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

const products = [
  {
    title: "AI Agent Control",
    subtitle: "For companies using AI agents",
    description: "Your AI agents use email, CRM, database, and payments. SoterAI gives you action approval, audit logs, rollback, and compliance — a high-trust control layer between agents and your business systems.",
    href: "/dashboard/agent-control",
    accent: "text-orange-300",
    border: "border-orange-500/30 hover:border-orange-500/50",
    gradient: "from-orange-500/10 via-amber-500/5 to-transparent",
    iconBg: "bg-orange-500/15",
    Icon: Gauge,
    features: [
      { icon: Shield, text: "Action approval queue" },
      { icon: FileText, text: "Reversibility ledger" },
      { icon: Lock, text: "Agent identity & passports" },
      { icon: Scale, text: "Compliance proof" },
    ],
  },
  {
    title: "AI Usage Governance",
    subtitle: "For 50-500 employee companies",
    description: "Employees paste company data into ChatGPT, Claude, and Cursor daily. SoterAI enforces provider policies, department rules, data classification, and keeps a complete audit trail for legal accountability.",
    href: "/dashboard/usage-governance",
    accent: "text-violet-300",
    border: "border-violet-500/30 hover:border-violet-500/50",
    gradient: "from-violet-500/10 via-blue-500/5 to-transparent",
    iconBg: "bg-violet-500/15",
    Icon: Landmark,
    features: [
      { icon: Shield, text: "Provider allow/block lists" },
      { icon: Users, text: "Department-level rules" },
      { icon: Eye, text: "Employee DLP monitoring" },
      { icon: Scale, text: "Legal audit trail" },
    ],
  },
];

export function TwoProducts() {
  return (
    <section className="border-y border-slate-800 bg-slate-950/40 py-24">
      <div className="container-page">
        <SectionHeading
          center
          eyebrow="Two platforms, one security layer"
          title="Control AI agents. Govern employee AI usage."
          copy="Whether your AI agents act on company systems or your employees use AI tools with sensitive data — SoterAI protects both sides."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.title}
              href={product.href}
              className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-br p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${product.border} ${product.gradient}`}
            >
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.03] blur-2xl transition-all duration-500 group-hover:bg-white/[0.06]" />

              <div className="relative">
                <div className="flex items-center gap-4">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-xl ${product.iconBg}`}>
                    <product.Icon size={24} className={product.accent} />
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-white">{product.title}</h3>
                    <p className={`text-sm ${product.accent}`}>{product.subtitle}</p>
                  </div>
                </div>

                <p className="mt-5 leading-7 text-slate-400">{product.description}</p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  {product.features.map((f) => {
                    const FIcon = f.icon;
                    return (
                      <div
                        key={f.text}
                        className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-300"
                      >
                        <FIcon size={15} className={product.accent} />
                        {f.text}
                      </div>
                    );
                  })}
                </div>

                <div className={`mt-6 flex items-center gap-2 text-sm font-semibold ${product.accent} transition-transform duration-300 group-hover:translate-x-1`}>
                  Explore {product.title.split(" ").pop()} <ArrowRight size={16} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
