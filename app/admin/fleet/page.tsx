import { buildFleetInventory, type FleetRisk } from "@/lib/fleet-inventory";
import { getCurrentProject } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/dashboard/PageHeader";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { Table, THead, TBody, TH, TR, TD, TEmpty } from "@/components/ui/DataTable";
import { TableWrapper } from "@/components/dashboard/TableWrapper";
import { RISK_LEVEL } from "@/lib/dashboard/status";
import { ServerCog } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Fleet inventory — estate-wide view of discovered AI assets.
 *
 * This page was rendering as a **light-theme page inside a dark console**. Three
 * separate causes, all fixed here:
 *
 * 1. `text-muted-foreground` (used 8 times) is not defined in this project's
 *    Tailwind config — there is no shadcn-style `--muted-foreground` token here.
 *    It therefore generated *no CSS at all*, so every "muted" caption rendered at
 *    full `text-slate-100` body colour. Nothing looked muted; it looked like the
 *    hierarchy had been forgotten.
 * 2. The risk tiles and badges used `bg-red-100 text-red-800` — a light-mode
 *    palette. On `--surface-0` those paint near-white blocks.
 * 3. `<thead className="bg-slate-50 border-b">` was the only light-background
 *    table header in the codebase, and `border-b` with no colour resolved to the
 *    global hairline, so the header had a near-white fill with a dark rule.
 *
 * Risk styling now comes from `RISK_LEVEL` in `lib/dashboard/status.ts`, which is
 * the same ordered ramp the rest of the console uses, so "CRITICAL" here matches
 * "CRITICAL" on the agent pages.
 */

const KIND_LABEL: Record<string, string> = {
  provider: "AI Provider",
  "mcp-server": "MCP Server",
  sdk: "SDK",
  tool: "Tool",
  model: "Model",
};

/**
 * Risk tile tone. Mirrors the four-step `RISK_LEVEL` ramp so HIGH and CRITICAL
 * stay distinguishable — collapsing both to red is what the old light-mode
 * palette did, and it hid the difference that matters most on this page.
 */
const RISK_TONE: Record<FleetRisk, "red" | "orange" | "yellow" | "green"> = {
  CRITICAL: "red",
  HIGH: "orange",
  MEDIUM: "yellow",
  LOW: "green",
};

export default async function FleetPage() {
  const project = await getCurrentProject();
  const organizationId = project?.organizationId ?? null;

  if (!organizationId) {
    return (
      <div>
        <PageHeader eyebrow="Estate" title="Fleet inventory" icon={ServerCog} />
        <EmptyState
          title="No organization context"
          description="This session is not attached to an organization, so there is no estate to inventory."
        />
      </div>
    );
  }

  const inv = await buildFleetInventory(organizationId);

  return (
    <div>
      <PageHeader
        eyebrow="Estate"
        title="Fleet inventory"
        icon={ServerCog}
        description={`Estate-wide view of AI assets discovered by Shadow AI across your organization. Generated ${new Date(inv.generatedAt).toLocaleString()}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((risk) => (
          <MetricCard
            key={risk}
            label={RISK_LEVEL[risk]?.label ?? risk}
            value={inv.byRisk[risk]}
            tone={RISK_TONE[risk]}
          />
        ))}
        <MetricCard label="Total assets" value={inv.totalAssets} hint="All discovered AI surfaces" />
      </div>

      <div className="card mt-6 overflow-hidden">
        <TableWrapper label="Fleet inventory">
          <Table label="Discovered AI assets" minWidth="52rem">
            <THead sticky={false}>
              <TR>
                <TH>Asset</TH>
                <TH>Type</TH>
                <TH>Risk</TH>
                <TH>Policy</TH>
                <TH numeric>Seen</TH>
                <TH>Last seen</TH>
              </TR>
            </THead>
            <TBody>
              {inv.entries.map((entry) => (
                <TR key={entry.fingerprint} interactive>
                  <TD className="font-medium text-slate-100">{entry.displayName}</TD>
                  <TD className="text-slate-400">{KIND_LABEL[entry.kind] ?? entry.kind}</TD>
                  <TD>
                    <span className={`text-xs font-semibold ${RISK_LEVEL[entry.risk]?.className ?? "text-slate-400"}`}>
                      {RISK_LEVEL[entry.risk]?.label ?? entry.risk}
                    </span>
                  </TD>
                  <TD className="text-slate-400">{entry.policyState}</TD>
                  <TD numeric className="text-slate-400">
                    {entry.seenCount}
                  </TD>
                  <TD className="text-slate-400">
                    {entry.lastSeenAt ? new Date(entry.lastSeenAt).toLocaleDateString() : "—"}
                  </TD>
                </TR>
              ))}
              {inv.entries.length === 0 && (
                <TEmpty
                  colSpan={6}
                  message="No assets discovered yet. Run a Shadow AI scan to populate the estate view."
                />
              )}
            </TBody>
          </Table>
        </TableWrapper>
      </div>
    </div>
  );
}
