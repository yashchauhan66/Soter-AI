/**
 * MCP enforcement engine.
 *
 * The single decision point for a gateway session. It reuses the guard-core
 * MCP verdict engine (evaluateMCPToolInvocation) and the guard inspection
 * pipeline — it does NOT introduce a second policy engine — and adds session
 * identity binding, capability/inventory validation, structural overlays,
 * reliability bounds, and approval gating. Every `tools/call` is evaluated
 * here BEFORE the proxy is allowed to forward it upstream.
 */
import {
  evaluateMCPToolInvocation,
  type MCPPermission,
  type TaintedSource,
} from "@soterai/guard-core";
import { createHash } from "crypto";
import {
  type McpSessionIdentity,
  type McpGatewayLimits,
  type McpCallDecisionResult,
  type McpResultDecisionResult,
  RPC,
} from "./types";
import { inspectArguments, inspectResult, canonicalStringify } from "./inspect";
import {
  buildMcpDecision,
  fromEnforcementAction,
  argsFingerprint as fingerprintArgs,
  type McpDecisionEvidence,
} from "./decision";
import { ApprovalStore } from "./approvals";
import type { CanonicalDecision } from "../decision";
import type { ProtectionMode } from "@soterai/guard-core";

const DANGEROUS_COMMAND_RE =
  /(\brm\s+-rf\b|\bmkfs\b|\bdd\s+if=|:\(\)\s*\{|\bshutdown\b|\breboot\b|\bformat\s+[a-z]:|\bdel\s+\/|\|\s*sh\b|\|\s*bash\b|\bcurl\b[^|]*\|\s*(sh|bash)|\bchmod\s+777\b)/i;
const PRIVATE_DEST_RE =
  /(169\.254\.169\.254|metadata\.google|127\.0\.0\.1|localhost|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)/i;

const RANK: Record<CanonicalDecision, number> = {
  ALLOW: 0,
  ABSTAIN: 0,
  WARN: 1,
  REDACT: 2,
  TRANSFORM: 3,
  REQUIRE_APPROVAL: 4,
  QUARANTINE: 5,
  BLOCK: 6,
};

function strictest(a: CanonicalDecision, b: CanonicalDecision): CanonicalDecision {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface ToolCallParams {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface EngineDeps {
  identity: McpSessionIdentity;
  limits: McpGatewayLimits;
  protectionMode?: ProtectionMode;
  approvals?: ApprovalStore;
  mcpConfig?: string | Record<string, unknown>;
  now?: () => number;
}

interface ToolInfo {
  capability?: string;
}

export class McpEnforcementEngine {
  readonly approvals: ApprovalStore;
  private readonly now: () => number;
  private initialized = false;
  private boundServerId: string | null = null;
  private negotiatedCapabilities: string[] = [];
  private toolInventory: Map<string, ToolInfo> | null = null;
  private quarantined = false;
  private activeCalls = 0;
  private rateWindow: number[] = [];
  /** True once a forwarded call touched an external destination/command. */
  private sawExternalData = false;
  private readonly policyVersionValue: string;

  constructor(private readonly deps: EngineDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.approvals = deps.approvals ?? new ApprovalStore(this.now);
    this.policyVersionValue = this.computePolicyVersion();
  }

  private computePolicyVersion(): string {
    const shape = {
      perms: [...(this.deps.identity.allowedPermissions ?? [])].sort(),
      roots: [...(this.deps.identity.allowedRoots ?? [])].sort(),
      mode: this.deps.protectionMode ?? "standard",
      limits: this.deps.limits,
    };
    return `mcp.policy.v1:${createHash("sha256").update(JSON.stringify(shape)).digest("hex").slice(0, 12)}`;
  }

  get policyVersion(): string {
    return this.policyVersionValue;
  }

  /**
   * Config passed to guard-core's analyzer. The gateway explicitly proxies a
   * known, bound upstream server, so when the caller supplies no MCP config we
   * synthesize a minimal known-server entry — otherwise guard-core would treat
   * the (legitimately bound) server as UNKNOWN_MCP_SERVER and hard-DENY every
   * call. A real supplied config still drives permission/prompt-injection risk.
   */
  private effectiveMcpConfig(server: string): string | Record<string, unknown> {
    if (this.deps.mcpConfig) return this.deps.mcpConfig;
    return { mcpServers: { [server]: { command: server } } };
  }

  isQuarantined(): boolean {
    return this.quarantined;
  }

  quarantineSession(): void {
    this.quarantined = true;
  }

  /** Emergency lockdown: no further tool calls or approvals succeed. */
  lockdown(): void {
    this.quarantined = true;
    this.approvals.engageLockdown();
  }

  // --- lifecycle -----------------------------------------------------------

  /**
   * Bind the upstream server identity from the initialize result. A server
   * identity change vs. the session binding is rejected (fail-closed).
   */
  recordInitialize(result: unknown): { ok: boolean; reason?: string } {
    const info = (result as { serverInfo?: { name?: string }; capabilities?: Record<string, unknown> }) ?? {};
    const actual = info.serverInfo?.name ?? "unknown";
    if (this.boundServerId && this.boundServerId !== actual) {
      this.quarantined = true;
      return { ok: false, reason: "SERVER_IDENTITY_CHANGED" };
    }
    if (this.deps.identity.serverId && this.deps.identity.serverId !== actual) {
      this.quarantined = true;
      return { ok: false, reason: "SERVER_IDENTITY_MISMATCH" };
    }
    this.boundServerId = actual;
    this.negotiatedCapabilities = Object.keys(info.capabilities ?? {});
    this.initialized = true;
    return { ok: true };
  }

  /** Record the tool inventory from a tools/list result. */
  recordToolInventory(result: unknown): void {
    const tools = (result as { tools?: Array<Record<string, unknown>> })?.tools;
    if (!Array.isArray(tools)) return;
    const inv = new Map<string, ToolInfo>();
    for (const t of tools) {
      const name = typeof t.name === "string" ? t.name : undefined;
      if (!name) continue;
      const annotations = (t.annotations as Record<string, unknown> | undefined) ?? undefined;
      const capability = typeof annotations?.capability === "string" ? (annotations.capability as string) : undefined;
      inv.set(name, { capability });
    }
    this.toolInventory = inv;
  }

  private sessionInvalidReason(): string | null {
    const id = this.deps.identity;
    if (id.revoked) return "REVOKED";
    if (this.now() > id.expiresAt) return "EXPIRED";
    if (this.quarantined) return "QUARANTINED";
    return null;
  }

  private checkRate(): boolean {
    const cutoff = this.now() - 60_000;
    this.rateWindow = this.rateWindow.filter((t) => t > cutoff);
    if (this.rateWindow.length >= this.deps.limits.rateLimitPerMinute) return false;
    this.rateWindow.push(this.now());
    return true;
  }

  /** Call after an upstream tool call completes (success or failure). */
  completeCall(): void {
    if (this.activeCalls > 0) this.activeCalls -= 1;
  }

  // --- the gate ------------------------------------------------------------

  evaluateToolCall(rawParams: unknown, traceId: string): McpCallDecisionResult {
    const identity = {
      projectId: this.deps.identity.projectId,
      organizationId: this.deps.identity.tenantId,
      userId: this.deps.identity.principalId,
      sessionId: this.deps.identity.clientId,
    };
    const server = this.boundServerId ?? this.deps.identity.serverId ?? "unknown";
    const transport = `mcp:${server}`;

    const reject = (
      decision: CanonicalDecision,
      code: number,
      reason: string,
      evidence: McpDecisionEvidence,
      tool: string,
      fp: string,
      riskScore = 90,
      approvalId?: string,
    ): McpCallDecisionResult => {
      const dec = buildMcpDecision({
        decision,
        riskScore,
        identity,
        server,
        tool,
        transport,
        argsFingerprint: fp,
        approvalId,
        reason,
        policyVersion: this.policyVersionValue,
        traceId,
        direction: "INPUT",
        enforcement: "ENFORCED",
        evidence,
      });
      const outcome = decision === "REQUIRE_APPROVAL" ? "HOLD" : "REJECT";
      return {
        outcome,
        decision: dec,
        rpcError: { code, message: reason, data: { traceId, decision, approvalId } },
      };
    };

    const emptyEvidence = (reasonCodes: string[]): McpDecisionEvidence => ({
      reasonCodes,
      categories: [],
      findingSummaries: [],
      redactedArgsPreview: "",
    });

    // 1. Session validity — fail closed.
    const invalid = this.sessionInvalidReason();
    if (invalid) {
      return reject("BLOCK", RPC.SOTER_SESSION_INVALID, `session invalid: ${invalid}`, emptyEvidence([`SESSION_${invalid}`]), "unknown", "af_none");
    }

    // 2. Malformed params — fail closed.
    const params = rawParams as ToolCallParams | undefined;
    if (!params || typeof params.name !== "string") {
      return reject("BLOCK", RPC.INVALID_PARAMS, "malformed tools/call params", emptyEvidence(["MALFORMED_TOOL_CALL"]), "unknown", "af_none");
    }
    const tool = params.name;
    const args = (params.arguments && typeof params.arguments === "object" ? params.arguments : {}) as Record<string, unknown>;
    const canonicalArgs = canonicalStringify(args);
    const fp = fingerprintArgs(canonicalArgs);

    // 3. Argument size bound — fail closed.
    if (Buffer.byteLength(canonicalArgs, "utf8") > this.deps.limits.maxArgsBytes) {
      return reject("BLOCK", RPC.SOTER_LIMIT_EXCEEDED, "arguments exceed size bound", emptyEvidence(["ARGS_TOO_LARGE"]), tool, fp);
    }

    // 4. Rate limit.
    if (!this.checkRate()) {
      return reject("BLOCK", RPC.SOTER_LIMIT_EXCEEDED, "rate limit exceeded", emptyEvidence(["RATE_LIMITED"]), tool, fp);
    }

    // 5. Undeclared tool (inventory known but tool absent) — tool-name substitution.
    if (this.toolInventory && !this.toolInventory.has(tool)) {
      return reject("BLOCK", RPC.SOTER_BLOCKED, "undeclared tool", emptyEvidence(["UNDECLARED_TOOL"]), tool, fp);
    }
    const capability = this.toolInventory?.get(tool)?.capability;

    // 6. Core evaluation — any failure here fails CLOSED for this high-impact op.
    try {
      const inspection = inspectArguments(args, {
        allowedRoots: this.deps.identity.allowedRoots,
        serialized: canonicalArgs,
      });

      const taintedSources: TaintedSource[] = [];
      const argRisks = inspection.guard.riskTypes;
      if (argRisks.includes("PROMPT_INJECTION") || argRisks.includes("MCP_TOOL_POISONING")) {
        taintedSources.push({ id: "mcp_args", trust: "untrusted", labels: ["prompt_injection"] });
      }

      const core = evaluateMCPToolInvocation({
        mcpConfig: this.effectiveMcpConfig(server),
        serverName: server,
        toolName: tool,
        args,
        protectionMode: this.deps.protectionMode ?? "standard",
        allowedPermissions: this.deps.identity.allowedPermissions as MCPPermission[] | undefined,
        taintedSources,
        callerEnforcesPreExecution: true,
      });

      let decision = fromEnforcementAction(core.action);
      const reasonCodes = [...core.reasonCodes, ...inspection.evidence.reasonCodes];
      const categories = [...new Set([...core.categories, ...inspection.evidence.categories.map(String)])];

      // Structural overlays (strictest wins).
      const s = inspection.structural;
      if (argRisks.includes("SECRET_DETECTED")) {
        decision = strictest(decision, "BLOCK");
      }
      if (argRisks.includes("PII_DETECTED") || argRisks.includes("INDIA_PII_DETECTED")) {
        decision = strictest(decision, "REDACT");
      }
      if (argRisks.includes("PROMPT_INJECTION") || argRisks.includes("MCP_TOOL_POISONING")) {
        decision = strictest(decision, "BLOCK");
      }
      if (s.commands.some((c) => DANGEROUS_COMMAND_RE.test(c))) {
        decision = strictest(decision, "BLOCK");
        reasonCodes.push("DANGEROUS_COMMAND");
      } else if (s.commands.length) {
        decision = strictest(decision, "REQUIRE_APPROVAL");
      }
      if (s.filesystemScopeViolation) {
        decision = strictest(decision, this.deps.protectionMode === "strict" || this.deps.protectionMode === "enterprise_locked" ? "BLOCK" : "REQUIRE_APPROVAL");
      }
      if (s.destinations.some((d) => PRIVATE_DEST_RE.test(d))) {
        decision = strictest(decision, "BLOCK");
        reasonCodes.push("PRIVATE_OR_METADATA_DESTINATION");
      } else if (s.destinations.length) {
        decision = strictest(decision, "REQUIRE_APPROVAL");
      }
      if (s.credentialKeys.length) {
        decision = strictest(decision, "REQUIRE_APPROVAL");
      }

      // Multi-tool action-chain escalation: once this session has forwarded a
      // call that touched an external destination/command, any later egress
      // call is escalated (a classic read-then-exfiltrate chain).
      const egress = s.commands.length > 0 || s.destinations.length > 0;
      if (this.sawExternalData && egress) {
        decision = strictest(decision, "REQUIRE_APPROVAL");
        reasonCodes.push("MULTI_TOOL_CHAIN_ESCALATION");
      }

      const riskScore = Math.max(core.riskScore, inspection.guard.riskScore);
      // `redactedArgsPreview` is a lazy getter: building the preview re-runs the
      // output guard over every argument leaf, which is pure waste on the common
      // ALLOW path where no consumer ever reads it. Evidence sinks that DO read
      // it (approval records, persisted decisions) still get the same value.
      const evidence: McpDecisionEvidence = {
        reasonCodes: [...new Set(reasonCodes)],
        categories,
        findingSummaries: inspection.evidence.findingSummaries,
        get redactedArgsPreview() {
          return inspection.redactedPreview;
        },
      };

      // 7. Approval gating.
      let approvalId: string | undefined;
      if (decision === "REQUIRE_APPROVAL") {
        const binding = {
          tenantId: this.deps.identity.tenantId,
          projectId: this.deps.identity.projectId,
          sessionId: this.deps.identity.clientId,
          server,
          tool,
          argsFingerprint: fp,
        };
        const consumed = this.approvals.consume(binding);
        if (consumed.ok) {
          decision = "ALLOW"; // valid, unused, matching approval → forward once
        } else {
          const req = this.approvals.create({
            ...binding,
            redactedPreview: inspection.redactedPreview,
            reason: core.explanation || "approval required",
          });
          approvalId = req.id;
        }
      }

      // 8. Map decision → outcome.
      const reason = (core.explanation || `mcp gateway decision ${decision}`).slice(0, 300);
      if (decision === "BLOCK" || decision === "QUARANTINE") {
        if (decision === "QUARANTINE") this.quarantined = true;
        return reject(
          decision,
          RPC.SOTER_BLOCKED,
          reason,
          evidence,
          tool,
          fp,
          riskScore,
        );
      }
      if (decision === "REQUIRE_APPROVAL") {
        return reject("REQUIRE_APPROVAL", RPC.SOTER_APPROVAL_REQUIRED, reason, evidence, tool, fp, riskScore, approvalId);
      }

      // FORWARD path (ALLOW / WARN / REDACT / TRANSFORM).
      if (this.activeCalls >= this.deps.limits.maxConcurrentCalls) {
        return reject("BLOCK", RPC.SOTER_LIMIT_EXCEEDED, "concurrency limit exceeded", emptyEvidence(["CONCURRENCY_LIMITED"]), tool, fp, riskScore);
      }
      this.activeCalls += 1;
      if (egress) this.sawExternalData = true;
      const forwardArgs = decision === "REDACT" || decision === "TRANSFORM" ? inspection.redactedArgs : args;
      const dec = buildMcpDecision({
        decision,
        riskScore,
        identity,
        server,
        tool,
        capability,
        transport,
        argsFingerprint: fp,
        reason,
        policyVersion: this.policyVersionValue,
        traceId,
        direction: "INPUT",
        enforcement: "ENFORCED",
        evidence,
      });
      return { outcome: "FORWARD", decision: dec, forwardArgs };
    } catch (err) {
      // Critical failure on a high-impact op → fail CLOSED.
      return reject(
        "BLOCK",
        RPC.INTERNAL_ERROR,
        `engine error (fail-closed): ${(err as Error).message}`.slice(0, 200),
        emptyEvidence(["ENGINE_ERROR_FAIL_CLOSED"]),
        (rawParams as ToolCallParams)?.name ?? "unknown",
        "af_error",
      );
    }
  }

  // --- result inspection ---------------------------------------------------

  inspectToolResult(tool: string, result: unknown, traceId: string): McpResultDecisionResult {
    const identity = {
      projectId: this.deps.identity.projectId,
      organizationId: this.deps.identity.tenantId,
      userId: this.deps.identity.principalId,
      sessionId: this.deps.identity.clientId,
    };
    const server = this.boundServerId ?? this.deps.identity.serverId ?? "unknown";
    const transport = `mcp:${server}`;

    const serialized = canonicalStringify(result);
    let outcome: McpResultDecisionResult["outcome"] = "RELEASE";
    let decision: CanonicalDecision = "ALLOW";
    let safeResult: unknown = result;
    let riskScore = 0;
    let evidence: McpDecisionEvidence = { reasonCodes: [], categories: [], findingSummaries: [], redactedArgsPreview: "" };

    try {
      if (Buffer.byteLength(serialized, "utf8") > this.deps.limits.maxResultBytes) {
        outcome = "BLOCK";
        decision = "BLOCK";
        safeResult = { content: [{ type: "text", text: "[blocked: oversized tool result]" }], isError: true };
        evidence = { reasonCodes: ["RESULT_TOO_LARGE"], categories: [], findingSummaries: [], redactedArgsPreview: "" };
        riskScore = 80;
      } else {
        const insp = inspectResult(result);
        riskScore = insp.guard.riskScore;
        evidence = {
          reasonCodes: [],
          categories: insp.evidence.categories.map(String),
          findingSummaries: insp.evidence.findingSummaries,
          redactedArgsPreview: insp.redactedPreview,
        };
        const risks = insp.guard.riskTypes;
        if (risks.includes("SECRET_DETECTED")) {
          outcome = "REDACT";
          decision = "REDACT";
          safeResult = insp.redactedResult;
        } else if (risks.includes("PROMPT_INJECTION") || risks.includes("MCP_TOOL_POISONING")) {
          // Untrusted instructions embedded in a tool result → quarantine.
          outcome = "QUARANTINE";
          decision = "QUARANTINE";
          safeResult = { content: [{ type: "text", text: "[quarantined: tool result contained untrusted instructions]" }], isError: true };
          evidence.reasonCodes.push("UNTRUSTED_INSTRUCTIONS_IN_RESULT");
        } else if (risks.includes("PII_DETECTED") || risks.includes("INDIA_PII_DETECTED") || risks.includes("DATA_EXFILTRATION")) {
          outcome = "REDACT";
          decision = "REDACT";
          safeResult = insp.redactedResult;
        }
      }
    } catch (err) {
      // Result-inspection failure → do NOT release potentially unsafe content.
      outcome = "BLOCK";
      decision = "BLOCK";
      safeResult = { content: [{ type: "text", text: "[blocked: result inspection failed]" }], isError: true };
      evidence = { reasonCodes: [`RESULT_INSPECTION_ERROR:${(err as Error).name}`], categories: [], findingSummaries: [], redactedArgsPreview: "" };
      riskScore = 80;
    }

    const dec = buildMcpDecision({
      decision,
      riskScore,
      identity,
      server,
      tool,
      transport,
      argsFingerprint: "af_result",
      reason: `result inspection ${outcome}`,
      policyVersion: this.policyVersionValue,
      traceId,
      direction: "OUTPUT",
      enforcement: "ENFORCED",
      evidence,
    });
    return { outcome, decision: dec, safeResult };
  }
}
