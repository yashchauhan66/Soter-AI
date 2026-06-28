import { createHash } from "crypto";
import { snapshotTool, serverRiskLevel, type DriftRiskLevel, type McpToolInput } from "@/lib/advanced-security/mcpDrift";

export interface McpRiskScanInput {
  serverName: string;
  serverUrl?: string;
  repositoryUrl?: string;
  tools: McpToolInput[];
}

export interface McpRiskScanResult {
  scanId: string;
  serverName: string;
  serverUrl: string | null;
  repositoryUrl: string | null;
  riskLevel: DriftRiskLevel;
  riskScore: number;
  badge: {
    label: string;
    color: string;
    message: string;
  };
  findings: Array<{
    toolName: string;
    riskLevel: DriftRiskLevel;
    capabilities: string[];
    reasons: string[];
    recommendation: string;
  }>;
  summary: string;
}

const RISK_SCORE: Record<DriftRiskLevel, number> = { LOW: 15, MEDIUM: 45, HIGH: 75, CRITICAL: 95 };

export function scanMcpServerRisk(input: McpRiskScanInput): McpRiskScanResult {
  const snapshots = input.tools.map(snapshotTool);
  const riskLevel = serverRiskLevel(snapshots);
  const riskScore = Math.min(100, Math.max(RISK_SCORE[riskLevel], Math.round(snapshots.reduce((sum, item) => sum + RISK_SCORE[item.riskLevel], 0) / Math.max(1, snapshots.length))));
  const scanId = createHash("sha256").update(JSON.stringify({
    serverName: input.serverName,
    serverUrl: input.serverUrl ?? null,
    repositoryUrl: input.repositoryUrl ?? null,
    tools: snapshots.map((snapshot) => ({
      toolName: snapshot.toolName,
      toolDescriptionHash: snapshot.toolDescriptionHash,
      inputSchemaHash: snapshot.inputSchemaHash,
    })),
  })).digest("hex").slice(0, 24);

  const findings = snapshots
    .filter((snapshot) => snapshot.riskLevel !== "LOW" || snapshot.riskReasons.length > 0)
    .map((snapshot) => ({
      toolName: snapshot.toolName,
      riskLevel: snapshot.riskLevel,
      capabilities: snapshot.detectedCapabilities,
      reasons: snapshot.riskReasons,
      recommendation: recommendationFor(snapshot.riskLevel),
    }))
    .sort((a, b) => riskOrder(b.riskLevel) - riskOrder(a.riskLevel));

  return {
    scanId,
    serverName: input.serverName.trim(),
    serverUrl: input.serverUrl?.trim() || null,
    repositoryUrl: input.repositoryUrl?.trim() || null,
    riskLevel,
    riskScore,
    badge: badgeFor(riskLevel),
    findings,
    summary: `${input.serverName.trim()} scored ${riskLevel} with ${findings.length} risky MCP tool findings.`,
  };
}

export function mcpRiskBadgeSvg(input: { serverName?: string; riskLevel: DriftRiskLevel }) {
  const badge = badgeFor(input.riskLevel);
  const label = encodeXml(input.serverName ? `MCP ${input.serverName}` : "MCP risk");
  const value = encodeXml(badge.label);
  const labelWidth = Math.max(66, label.length * 7 + 16);
  const valueWidth = Math.max(58, value.length * 7 + 16);
  const width = labelWidth + valueWidth;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" role="img" aria-label="${label}: ${value}">
  <linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-opacity=".12"/></linearGradient>
  <rect width="${labelWidth}" height="20" fill="#101827"/>
  <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${badge.color}"/>
  <rect width="${width}" height="20" fill="url(#s)"/>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,sans-serif" font-size="11">
    <text x="${labelWidth / 2}" y="14">${label}</text>
    <text x="${labelWidth + valueWidth / 2}" y="14">${value}</text>
  </g>
</svg>`;
}

function badgeFor(riskLevel: DriftRiskLevel) {
  if (riskLevel === "CRITICAL") return { label: "critical", color: "#dc2626", message: "Block or quarantine this MCP server until reviewed." };
  if (riskLevel === "HIGH") return { label: "high", color: "#ea580c", message: "Require approval and least-privilege policy before use." };
  if (riskLevel === "MEDIUM") return { label: "medium", color: "#ca8a04", message: "Review tool scopes before connecting." };
  return { label: "low", color: "#16a34a", message: "No high-risk MCP capabilities detected." };
}

function recommendationFor(riskLevel: DriftRiskLevel) {
  if (riskLevel === "CRITICAL") return "Do not connect this MCP server until the tool is reviewed, scoped, or removed.";
  if (riskLevel === "HIGH") return "Require explicit approval, narrow credentials, and monitor every call.";
  if (riskLevel === "MEDIUM") return "Use least privilege and keep drift monitoring enabled.";
  return "Keep this tool in inventory and rescan when its schema changes.";
}

function riskOrder(level: DriftRiskLevel) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[level];
}

function encodeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
