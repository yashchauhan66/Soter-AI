import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

type Row = { id: string; serverName: string; toolName: string; riskLevel: string; detectedCapabilitiesJson: unknown; riskReasonsJson: unknown; createdAt: Date };

export default async function McpScannerPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  await requireProjectPermission(project.id, "logs:read");
  const rows = await safeRows<Row>`SELECT "id", "serverName", "toolName", "riskLevel", "detectedCapabilitiesJson", "riskReasonsJson", "createdAt" FROM "McpToolScan" WHERE "projectId" = ${project.id} ORDER BY "createdAt" DESC LIMIT 100`;
  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent firewall"
        title="MCP scanner"
        description="Scan the tools exposed by MCP servers, detect the dangerous capabilities each tool has, and assign a risk level with the reasons behind it."
        useCase="Model Context Protocol servers hand tools to your AI agents — file access, shell, network calls, and more. Before you let an agent use a tool, you need to know what it can actually do. The MCP scanner inspects each tool, extracts its detected capabilities (for example file-write, code-exec, or network egress), and rates the risk so a tool that can delete files or reach the internet cannot slip in unnoticed."
        howItWorks={[
          { heading: "Scan a server's tools", body: "Point the scanner at an MCP server and it enumerates every tool that server exposes, capturing tool and server names." },
          { heading: "Detect capabilities", body: "Each tool is analysed for the sensitive capabilities it holds — file access, command execution, network calls — recorded as a list per tool." },
          { heading: "Rate the risk", body: "Detected capabilities map to a risk level, and the specific reasons for that rating are stored alongside each result." },
          { heading: "Review the findings", body: "Scan results are listed newest-first with risk, capabilities, and reasons so you can decide which servers and tools an agent should be allowed to use." },
        ]}
        integrationCode={`import { Soter } from "@soterai/core";

const soter = new Soter({ apiKey: process.env.SOTER_API_KEY });

const scan = await soter.scanMcpServer({
  serverName: "filesystem-mcp",
  tools: mcpClient.listTools(),
});

const risky = scan.results.filter((t) => t.riskLevel === "HIGH" || t.riskLevel === "CRITICAL");
// gate agent access on the risky tools before enabling the server`}
        callout="The scanner records the capabilities and risk of MCP tools for review — it does not by itself block an agent from calling a risky tool at runtime. Use the results to decide which servers and tools to enable."
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>
      <section className="card overflow-x-auto p-5">
        <table className="w-full min-w-[780px] text-left text-sm">
          <thead className="text-xs uppercase text-slate-500"><tr><th className="py-2">Risk</th><th>Server</th><th>Tool</th><th>Capabilities</th><th>Reasons</th><th>Scanned</th></tr></thead>
          <tbody className="divide-y divide-slate-800">
            {rows.map((row) => <tr key={row.id}><td className="py-3 font-semibold">{row.riskLevel}</td><td>{row.serverName}</td><td className="font-mono text-xs">{row.toolName}</td><td>{jsonList(row.detectedCapabilitiesJson)}</td><td>{jsonList(row.riskReasonsJson)}</td><td>{row.createdAt.toLocaleString()}</td></tr>)}
            {rows.length === 0 && <tr><td className="py-5 text-slate-500" colSpan={6}>No MCP scans yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function jsonList(value: unknown) {
  return Array.isArray(value) ? value.join(", ") : "-";
}

async function safeRows<T>(strings: TemplateStringsArray, ...values: unknown[]) {
  try { return await db.$queryRawUnsafe<T[]>(strings.reduce((sql, chunk, i) => `${sql}${chunk}${i < values.length ? `$${i + 1}` : ""}`, ""), ...values); } catch { return []; }
}
