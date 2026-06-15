import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
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
      <p className="eyebrow">AI supply chain - Preview</p>
      <h1 className="mt-2 text-3xl font-bold">AI Bill of Materials and risk inventory</h1>
      <p className="mt-3 max-w-3xl text-slate-400">Preview inventory for model providers, prompt versions, tools, plugins, and AI BOM snapshots. Lifecycle workflows and exports are still being completed; raw system prompts are represented by hashes and redacted previews.</p>
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
  const rows = await db.$queryRawUnsafe<Array<{ count: bigint }>>(`SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "organizationId" = $1`, organizationId);
  return Number(rows[0]?.count ?? 0);
}
