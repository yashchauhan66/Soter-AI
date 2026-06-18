import { z } from "zod";
import { authenticateAgentFirewall, routeError } from "@/lib/agent-firewall/server";
import { readJson } from "@/lib/apiResponse";

// Reuse the agent-firewall authenticator: same x-api-key auth, same per-key rate
// limiting, same tenant isolation. The advanced-security routes are project-scoped.
export { authenticateAgentFirewall as authenticateAdvancedSecurity, routeError };

export async function readAdvancedJson<S extends z.ZodTypeAny>(request: Request, schema: S): Promise<z.infer<S>> {
  return schema.parse(await readJson(request));
}

const trustLevel = z.enum(["TRUSTED", "INTERNAL", "UNKNOWN", "UNTRUSTED", "MALICIOUS"]);
const sensitivity = z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SECRET", "REGULATED"]);
const sourceType = z.enum([
  "USER_PROMPT", "RAG_DOCUMENT", "BROWSER_PAGE", "EMAIL", "FILE", "MCP_TOOL",
  "API_RESPONSE", "MEMORY", "CLIPBOARD", "TERMINAL", "SYSTEM_PROMPT", "PRIVATE_CONTEXT", "CUSTOM",
]);
const destinationType = z.enum([
  "LLM", "TOOL", "EXTERNAL_API", "EMAIL", "BROWSER_FORM", "FILE_WRITE",
  "MEMORY", "FINAL_OUTPUT", "WEBHOOK", "CUSTOM",
]);
const destinationTrustLevel = z.enum(["TRUSTED", "INTERNAL", "UNKNOWN", "EXTERNAL", "BLOCKED"]);

export const sourceRegisterSchema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  sourceType,
  sourceName: z.string().trim().max(300).optional(),
  sourceTrustLevel: trustLevel,
  sensitivityLevel: sensitivity,
  content: z.string().max(50_000).default(""),
  metadata: z.record(z.unknown()).optional(),
});

export const flowCheckSchema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  sourceIds: z.array(z.string().trim().min(1).max(200)).max(50).default([]),
  destinationType,
  destinationName: z.string().trim().max(300).optional(),
  destinationTrustLevel,
  action: z.string().trim().max(200).optional(),
  content: z.string().max(50_000).default(""),
  regulatedEgress: z.enum(["BLOCK", "ASK_APPROVAL"]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const dataSource = z.object({
  type: z.string().trim().max(120),
  sensitivity: sensitivity.optional(),
});

export const blastSimulateSchema = z.object({
  agentName: z.string().trim().min(1).max(160),
  agentType: z.string().trim().max(120).optional(),
  tools: z.array(z.string().trim().max(200)).max(200).default([]),
  permissions: z.record(z.string()).optional(),
  dataSources: z.array(dataSource).max(100).default([]),
  externalDestinations: z.array(z.string().trim().max(200)).max(100).default([]),
  memoryAccess: z.object({ longTermMemory: z.boolean().optional(), projectMemory: z.boolean().optional() }).optional(),
  policies: z.object({
    secretsBlocked: z.boolean().optional(),
    terminalBlocked: z.boolean().optional(),
    fileAccessWorkspaceLimited: z.boolean().optional(),
    externalDomainsAllowlisted: z.boolean().optional(),
    memoryFirewallEnabled: z.boolean().optional(),
    lineageFirewallEnabled: z.boolean().optional(),
    auditEnabled: z.boolean().optional(),
    dataEgressPolicy: z.boolean().optional(),
  }).partial().optional(),
});

export const blastScenarioSchema = blastSimulateSchema.extend({
  scenarioName: z.string().trim().min(1).max(120),
});

// --- MVP 2: Memory Poisoning Detector ---

const memoryScope = z.enum(["USER", "PROJECT", "AGENT", "TOOL", "GLOBAL"]);
const memoryType = z.enum(["PREFERENCE", "FACT", "INSTRUCTION", "TOOL_CONFIG", "POLICY_HINT", "CUSTOM"]);

export const memoryCheckSchema = z.object({
  agentName: z.string().trim().min(1).max(160),
  memoryScope: memoryScope.default("USER"),
  memoryType: memoryType.default("CUSTOM"),
  content: z.string().max(50_000).default(""),
  metadata: z.record(z.unknown()).optional(),
});

export const memoryStoreSchema = memoryCheckSchema.extend({
  userId: z.string().trim().max(200).optional(),
  previousContent: z.string().max(50_000).optional(),
});

// --- MVP 2: MCP Tool Drift Monitor ---

const mcpTrustLevel = z.enum(["TRUSTED", "INTERNAL", "UNKNOWN", "UNTRUSTED"]);

export const mcpServerRegisterSchema = z.object({
  serverName: z.string().trim().min(1).max(200),
  serverUrl: z.string().trim().max(500).optional(),
  trustLevel: mcpTrustLevel.default("UNKNOWN"),
  metadata: z.record(z.unknown()).optional(),
});

export const mcpToolSnapshotSchema = z.object({
  serverName: z.string().trim().min(1).max(200),
  tools: z.array(z.object({
    name: z.string().trim().min(1).max(200),
    description: z.string().max(10_000).optional(),
    inputSchema: z.unknown().optional(),
    outputSchema: z.unknown().optional(),
    endpoint: z.string().trim().max(500).optional(),
  })).max(200).default([]),
});

// --- MVP 3: Agent Legal Boundary Guard ---

const legalActionCategory = z.enum([
  "READ_ONLY", "LOGIN", "FORM_SUBMIT", "MESSAGE_SEND", "PURCHASE", "PAYMENT",
  "BOOKING", "SCRAPING", "ACCOUNT_CHANGE", "TERMS_ACCEPTANCE", "DATA_UPLOAD", "UNKNOWN",
]);

export const legalBoundarySchema = z.object({
  sessionId: z.string().trim().max(200).optional(),
  agentName: z.string().trim().min(1).max(160),
  websiteUrl: z.string().trim().max(1000).optional(),
  domain: z.string().trim().max(300).optional(),
  action: z.string().trim().max(300).optional(),
  actionCategory: legalActionCategory.default("UNKNOWN"),
  content: z.string().max(20_000).optional(),
  userConsentProvided: z.boolean().default(false),
  metadata: z.object({
    loggedIn: z.boolean().optional(),
    paymentInvolved: z.boolean().optional(),
    personalDataInvolved: z.boolean().optional(),
    termsAcceptance: z.boolean().optional(),
    domainTrusted: z.boolean().optional(),
    bypassDetected: z.boolean().optional(),
    scrapeCount: z.number().optional(),
  }).partial().optional(),
});
