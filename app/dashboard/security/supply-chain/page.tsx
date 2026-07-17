import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import Link from "next/link";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { AI_BOM_PREVIEW_GAPS } from "@/lib/supply-chain";

export const dynamic = "force-dynamic";

export default async function SupplyChainPage() {
  const active = await getActiveOrganization();
  if (!active) return <p>No organization.</p>;
  const [providers, models, prompts, tools, boms, findings] = await Promise.all([
    countTable("AiProvider", active.org.id),
    countTable("AiModel", active.org.id),
    countTable("PromptVersion", active.org.id),
    countTable("ToolIntegration", active.org.id),
    countTable("AiBillOfMaterials", active.org.id),
    countTable("SupplyChainRiskFinding", active.org.id),
  ]);
  return (
    <div>
      <FeatureGuide
        eyebrow="AI supply chain - Preview"
        title="AI Bill of Materials and risk inventory"
        description="Preview inventory for model providers, prompt versions, tools, plugins, and AI BOM snapshots. Lifecycle workflows and exports are still being completed; raw system prompts are represented by hashes and redacted previews."
        useCase="You cannot secure an AI system you cannot enumerate. As applications wire together model providers, prompt versions, tools, and plugins, the real attack surface becomes hard to see. This inventory builds an AI Bill of Materials — a catalog of every provider, model, prompt version, and tool integration your organization uses — so you have a single place to understand what components are in play and where supply-chain risk findings sit."
        howItWorks={[
          { heading: "Inventory AI components", body: "Providers, models, prompt versions, tools, and plugins are cataloged per organization, giving you counts and a running record of what is in use." },
          { heading: "Snapshot the AI BOM", body: "AI Bill of Materials snapshots capture the set of components at a point in time so you can reason about what shipped together." },
          { heading: "Protect sensitive prompts", body: "Raw system prompts are not stored in the clear here — they are represented by content hashes and redacted previews to limit exposure of proprietary instructions." },
          { heading: "Track risk findings", body: "Supply-chain risk findings are surfaced against the inventory so open issues are visible alongside the components they affect." },
        ]}
        callout="Preview feature. The inventory and counts are live, but lifecycle workflows and exports are still being completed — review the preview gaps listed below before relying on this for production supply-chain governance. It records and surfaces risk; it does not block or enforce anything."
      />
      <Link href="/dashboard/security/model-scan" className="mt-4 inline-flex items-center gap-2 rounded-lg border border-cyan/30 bg-cyan/10 px-4 py-2 text-sm font-semibold text-cyan hover:bg-cyan/20">
        Scan a model artifact for malicious code →
      </Link>
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        {[["Providers", providers], ["Models", models], ["Prompt versions", prompts], ["Tools", tools], ["AI BOMs", boms], ["Open findings", findings]].map(([label, value]) => (
          <section className="card p-5" key={String(label)}>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="mt-2 text-2xl font-bold">{String(value)}</p>
          </section>
        ))}
      </div>
      <section className="card mt-7 p-5">
        <h2 className="text-lg font-semibold">Preview gaps before production use</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-400">
          {AI_BOM_PREVIEW_GAPS.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}

async function countTable(table: string, organizationId: string) {
  // SECURITY: table names cannot be bound parameters; validate the identifier
  // so this helper can never become a SQL-injection vector if a caller ever
  // passes non-constant input.
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(table)) throw new Error(`Invalid table identifier: ${table}`);
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`, organizationId);
  return Number(rows[0]?.count ?? 0);
}
