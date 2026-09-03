import Link from "next/link";
import { ArrowRight, Gauge, Landmark, Shield, Users, FileText, Scale, Lock, Eye } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";

/**
 * The two-product split.
 *
 * The per-product colour identity (`accent`, `border`, `gradient`, `iconBg`) is
 * gone. Each card previously owned a full palette — orange for Agent Control,
 * violet for Usage Governance — applied to its border, background gradient,
 * decorative bloom, icon chip, subtitle, every feature icon, and its CTA.
 *
 * On the homepage that produced two large gradient panels in colours that appear
 * nowhere else in the brand, side by side, immediately below a teal hero. The
 * cards now share the product's own surface language, and the only colour left is
 * on the CTA — the single element that is actually an action.
 */
const products = [
  {
    title: "AI Agent Control",
    subtitle: "For companies using AI agents",
    description: "Your AI agents use email, CRM, database, and payments. SoterAI gives you action approval, audit logs, rollback, and compliance — a high-trust control layer between agents and your business systems.",
    href: "/ai-agent-security",
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
    href: "/ai-user-security",
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
    <section className="section border-y border-slate-800 bg-slate-950/40">
      <div className="container-page">
        <SectionHeading
          center
          eyebrow="Two platforms, one security layer"
          title="Control AI agents. Govern employee AI usage."
          copy="Whether your AI agents act on company systems or your employees paste sensitive data into AI tools, SoterAI covers both sides with one policy."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.title}
              href={product.href}
              className="card card-interactive group p-8"
            >
              <div className="flex items-center gap-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-md border border-slate-700/60 bg-slate-900/60 text-slate-300">
                  <product.Icon size={22} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-slate-100">{product.title}</h3>
                  <p className="text-sm text-slate-500">{product.subtitle}</p>
                </div>
              </div>

              <p className="mt-5 leading-7 text-slate-400">{product.description}</p>

              <ul className="mt-6 grid grid-cols-2 gap-2">
                {product.features.map((f) => {
                  const FIcon = f.icon;
                  return (
                    <li key={f.text} className="surface flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300">
                      <FIcon size={14} className="shrink-0 text-slate-500" aria-hidden="true" />
                      {f.text}
                    </li>
                  );
                })}
              </ul>

              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan">
                Explore {product.title.split(" ").pop()}
                <ArrowRight
                  size={15}
                  aria-hidden="true"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
