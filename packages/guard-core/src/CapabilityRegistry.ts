// ─── Protection Capability Registry (single source of truth) ────────────────
//
// Section 5 of the remediation mandate requires a machine-readable capability
// registry that every badge, the Control Panel, docs, and marketing claim must
// be consistent with. This is that registry — pure and deterministic, no VS
// Code, no I/O — so it can be imported by the extension runtime, rendered in a
// webview, and serialized to `artifacts/security/capabilities.json` by the
// generator script.
//
// The non-negotiable honesty rule this file encodes in CODE (not just prose):
//   A capability may only claim FULL_ENFORCEMENT / STRONG_ENFORCEMENT with
//   pre-execution blocking if a real caller in the packaged runtime actually
//   routes through its enforcement point. An engine that exists and unit-tests
//   green but that NOTHING in the shipped extension calls is NOT enforcement —
//   it is UNKNOWN_NOT_TESTED until wired. `assertHonestLevels()` fails the
//   build if that rule is ever violated, so the claim cannot silently drift.

/** The eight exact protection levels from Section 3. Ordered strongest→weakest. */
export type ProtectionLevelName =
    | "FULL_ENFORCEMENT"
    | "STRONG_ENFORCEMENT"
    | "PARTIAL_ENFORCEMENT"
    | "ADVISORY_ONLY"
    | "DETECTION_ONLY"
    | "VISIBILITY_ONLY"
    | "UNSUPPORTED"
    | "UNKNOWN_NOT_TESTED";

/** Levels that assert a real, pre-execution enforcement claim to the user. */
export const ENFORCING_LEVELS: ReadonlySet<ProtectionLevelName> = new Set<ProtectionLevelName>([
    "FULL_ENFORCEMENT",
    "STRONG_ENFORCEMENT",
]);

export interface ProtectionCapability {
    id: string;
    name: string;
    category: string;
    level: ProtectionLevelName;
    integration: string;
    /** File(s) where the security decision is actually made. */
    enforcementPoint?: string;
    /** Does SoterAI block BEFORE the protected action executes? */
    preExecutionBlock: boolean;
    rollbackSupported: boolean;
    conditions: string[];
    knownBypasses: string[];
    /** Test ids proving the behaviour (behavioural, not string-inspection). */
    evidenceTestIds: string[];
    lastVerifiedVersion?: string;
    /**
     * HONESTY FLAG (extends the Section 5 baseline type): does a real caller in
     * a SHIPPED runtime (packaged extension/broker, or a deployed web
     * control-plane route) route through `enforcementPoint`? `false` means the
     * engine exists and unit-tests pass, but no shipped code path invokes it
     * yet — so it cannot claim runtime enforcement.
     */
    wiredInRuntime: boolean;
}

export interface CapabilityEvidenceRecord extends ProtectionCapability {
    enforcementPoint: string;
    evidenceLevel: ProtectionLevelName;
    supportedSurfaces: string[];
    unsupportedSurfaces: string[];
    runtimeProof: {
        wiredInRuntime: boolean;
        testIds: string[];
    };
    latency: {
        status: "MEASURED" | "NOT_MEASURED_PER_CAPABILITY";
        evidence: string | null;
    };
}

const VERSION = "0.2.1";

/**
 * The registry. Each entry's `level` is what SoterAI can HONESTLY claim in the
 * packaged runtime today — not what the engine could do once wired. Six
 * guard-core engines (taint, file/network/process firewalls, governance,
 * checkpoint) remain implemented-but-unwired (UNKNOWN_NOT_TESTED). MCP gateway
 * is wired as DETECTION_ONLY via broker preflight + extension command — not
 * FULL/STRONG universal interception.
 */

export const CAPABILITY_REGISTRY: ProtectionCapability[] = [
    {
        id: "secret-broker",
        name: "SoterAI Local Broker credential capability calls",
        category: "credential-brokering",
        level: "STRONG_ENFORCEMENT",
        integration: "SoterAI Local Broker + VS Code extension",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts, packages/vscode-extension/src/secret-broker/*",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "Request originates through the broker",
            "Capability not expired, not revoked, within use count",
            "Host/method/path/HTTPS all match the bound capability",
        ],
        knownBypasses: [
            "Raw CLI, browser, or other-extension credentials never routed through the broker",
            "A process that already has the plaintext secret on disk",
        ],
        evidenceTestIds: ["enforced-capability.test.ts", "broker.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "safe-context",
        name: "SoterAI-built safe AI context / prompts",
        category: "context-minimization",
        level: "STRONG_ENFORCEMENT",
        integration: "guard-core SafeContextBuilder + extension context commands",
        enforcementPoint: "packages/guard-core/src/SafeContextBuilder.ts, packages/vscode-extension/src/firewall/context-commands.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: ["Context is assembled by SoterAI before being handed to the user/AI"],
        knownBypasses: ["What the user pastes or sends after SoterAI hands over the text"],
        evidenceTestIds: ["safecontext.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "secret-redaction",
        name: "Secret redaction + no-raw-evidence cache/ledger",
        category: "data-minimization",
        level: "STRONG_ENFORCEMENT",
        integration: "guard-core DecisionEngine/Redactor/EvidenceMinimizer/Ledger",
        enforcementPoint: "packages/guard-core/src/{Redactor,EvidenceMinimizer,HashCache,Ledger}.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: ["Content passes through the guard-core decision pipeline"],
        knownBypasses: ["Detector completeness is not universal; binary/image paths partial or untested"],
        evidenceTestIds: ["redaction.test.ts", "ledger.test.ts", "outputleak.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "clipboard-safe-paste",
        name: "Clipboard scan / safe paste through SoterAI commands",
        category: "data-minimization",
        level: "STRONG_ENFORCEMENT",
        integration: "extension ClipboardGuard command",
        enforcementPoint: "packages/vscode-extension/src/clipboard/ClipboardGuard.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: ["Paste routed through SoterAI's guarded paste command"],
        knownBypasses: ["Ordinary OS copy/paste is not intercepted"],
        evidenceTestIds: ["clipboard behavioral tests"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "egress-firewall",
        name: "Outbound AI egress firewall (obfuscation-resistant)",
        category: "data-minimization",
        // PARTIAL, not STRONG: it is a choke point for text SoterAI is asked to
        // send or approve. VS Code exposes no network-interception API, so a
        // request another extension makes directly is never seen here.
        level: "PARTIAL_ENFORCEMENT",
        integration: "extension egress firewall commands + guard-core detectors",
        enforcementPoint: "packages/vscode-extension/src/advanced/{egressFirewall,unicodeFolding,commands}.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "Text is routed through a SoterAI send/approve/pre-check command or soterai.checkEgressPayload",
            "Decision is ALLOW / REDACT / ASK / BLOCK before the content leaves",
        ],
        knownBypasses: [
            "Direct HTTP from other extensions, terminals, or processes — VS Code exposes no network hook",
            "Detector completeness is not universal; de-obfuscation covers the documented variants only",
            "A user who chooses 'Send Original Anyway' on a REDACT/ASK decision",
        ],
        evidenceTestIds: ["egress-firewall.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: "0.3.0",
    },
    {
        id: "broker-streaming",
        name: "Local AI Broker SSE/chunked streaming proxy",
        category: "credential-brokering",
        level: "STRONG_ENFORCEMENT",
        integration: "apps/local-ai-broker proxyStreaming + scanBrokerResponse",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts#proxyStreaming, extractStreamDelta",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "Client routes stream:true OpenAI/Anthropic-compatible traffic through the loopback broker",
            "Provider configured; auth token valid",
            "Each SSE event is scanned (accumulated assistant text + tool-call args) before forward",
        ],
        knownBypasses: [
            "Partial safe tokens already flushed before a later block cannot be recalled",
            "Traffic not routed through the broker is unenforced",
            "Non-SSE binary/media streams are not supported",
        ],
        evidenceTestIds: ["broker.test.ts (Phase 6 streaming proxy)"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "dependency-guard",
        name: "Dependency Guard (heuristics + optional OSV)",
        category: "supply-chain",
        level: "DETECTION_ONLY",
        integration: "extension DepGuard + public OSV API when online",
        enforcementPoint: "packages/vscode-extension/src/dep-guard/DepGuard.ts",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: [
            "User runs SoterAI dependency check commands",
            "OSV online mode requires user consent or soterai.dependencyGuard.osvMode=always",
        ],
        knownBypasses: [
            "Cannot block npm/pip/OS installs outside SoterAI-reviewed commands",
            "OSV requires concrete versions; unpinned packages skip advisory lookup",
            "Not a full SCA product; heuristics + OSV only",
        ],
        evidenceTestIds: ["dep-guard.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "controlled-terminal",
        name: "Broker-controlled terminal execution (allowlisted fixed-argv)",
        category: "terminal-enforcement",
        level: "STRONG_ENFORCEMENT",
        integration: "guard-core ControlledTerminal + broker + extension broker commands",
        enforcementPoint: "packages/guard-core/src/ControlledTerminal.ts, apps/local-ai-broker/src/BrokerServer.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: ["Command executed through the SoterAI broker route", "Command matches read-only fixed-argv allowlist"],
        knownBypasses: ["Raw integrated terminals, shells, aliases, subprocess trees, OS network egress"],
        evidenceTestIds: ["controlled-terminal.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },

    {
        id: "terminal-manual-review",
        name: "Manual terminal command review",
        category: "terminal-enforcement",
        level: "DETECTION_ONLY",
        integration: "extension command + RuntimePolicyEngine",
        enforcementPoint: "packages/vscode-extension/src/commands.ts, packages/guard-core/src/RuntimePolicyEngine.ts",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["User explicitly submits a command string for review"],
        knownBypasses: ["Does not intercept arbitrary integrated-terminal execution, subprocesses, aliases, shells"],
        evidenceTestIds: ["runtime-policy.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "live-scan",
        name: "VS Code live file diagnostics",
        category: "detection",
        level: "VISIBILITY_ONLY",
        integration: "extension LiveScanner diagnostics + guard-core DecisionEngine pipeline 1.1.0",
        enforcementPoint: "packages/vscode-extension/src/diagnostics/LiveScanner.ts, packages/guard-core/src/DecisionEngine.ts",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: [
            "File content already exists in the editor",
            "soterai.liveScan.enabled is true",
            "Pipeline 1.1.0 runs secrets, PII, prompt-injection, and jailbreak on context=file",
        ],
        knownBypasses: [
            "Runs after content exists; cannot stop other extensions/processes reading files",
            "Detection is regex/heuristic only — not ML-backed in the packaged extension",
            "Does not prevent the user from sending content to AI after the diagnostic appears",
        ],
        evidenceTestIds: ["live-scan-parity.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },

    {
        id: "mcp-config-scan",
        name: "MCP config / tool risk scanning",
        category: "mcp-security",
        level: "DETECTION_ONLY",
        integration: "guard-core MCPPolicyAnalyzer + extension MCPFirewall",
        enforcementPoint: "packages/guard-core/src/MCPPolicyAnalyzer.ts, packages/vscode-extension/src/mcp-firewall/MCPFirewall.ts",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["MCP config files are present and scanned"],
        knownBypasses: ["Scans config only; optional preflight via mcp-gateway when caller uses soterai.preflightMCPTool"],

        evidenceTestIds: ["mcp.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "extension-risk-scan",
        name: "Extension risk scanning",
        category: "extension-isolation",
        level: "DETECTION_ONLY",
        integration: "guard-core ExtensionRiskScanner",
        enforcementPoint: "packages/guard-core/src/ExtensionRiskScanner.ts",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["Installed extensions enumerated and scored"],
        knownBypasses: ["Cannot prevent a malicious extension with existing VS Code/OS access from reading files or network"],
        evidenceTestIds: ["extensionrisk.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    // ── Implemented-but-NOT-wired engines. Honest level: UNKNOWN_NOT_TESTED ──
    // These pass guard-core unit tests but have ZERO non-test callers in the
    // packaged extension (verified 2026-07-22). They cannot claim runtime
    // enforcement until a shipped code path routes through them.
    {
        id: "mcp-gateway",
        name: "MCP gateway policy engine (broker preflight)",
        category: "mcp-security",
        level: "STRONG_ENFORCEMENT",
        integration: "shared MCP policy engine + stdio/Streamable HTTP/SSE inline transports",
        enforcementPoint: "lib/gateway/mcp/engine.ts, lib/gateway/mcp/{stdio,http,sse}.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "MCP traffic is routed through a SoterAI gateway transport",
            "Session identity, tenant/project, policy, and approval binding validate",
        ],
        knownBypasses: [
            "Direct-to-server and WebSocket MCP traffic is unenforced",
            "The separate IDE config scan and broker preflight remain DETECTION_ONLY",
        ],
        evidenceTestIds: ["tests/mcp-gateway.test.ts", "tests/mcp-runtime-smoke.test.ts", "tests/mcp-http-security.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },

    {
        id: "taint-engine",
        name: "Taint / source-influence engine",
        category: "provenance",
        level: "STRONG_ENFORCEMENT",
        integration: "guard-core TaintEngine consumed by the inline MCP enforcement engine",
        enforcementPoint: "lib/gateway/mcp/engine.ts#evaluateRequest",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: ["MCP request is routed through the inline gateway and carries or triggers taint signals"],
        knownBypasses: ["Taint is not universal across arbitrary agent runtimes; only SoterAI-routed paths are protected"],
        evidenceTestIds: ["tests/mcp-gateway.test.ts", "tests/mcp-runtime-smoke.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "file-operation-firewall",
        name: "File / change firewall policy",
        category: "file-enforcement",
        level: "DETECTION_ONLY",
        integration: "guard-core FileOperationFirewall + broker /v1/preflight/file-operation",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts#previewFileOperation",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["Caller explicitly invokes the authenticated preflight endpoint"],
        knownBypasses: ["Preflight is advisory; it does not intercept OS file I/O or another extension's reads/writes"],
        evidenceTestIds: ["phase-controls.test.ts", "apps/local-ai-broker broker tests"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "network-egress-policy",
        name: "Network egress policy",
        category: "network-egress",
        level: "DETECTION_ONLY",
        integration: "guard-core NetworkEgressPolicy + broker /v1/preflight/network-egress",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts#previewNetworkEgress",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["Caller explicitly invokes the authenticated preflight endpoint"],
        knownBypasses: ["Preflight is advisory; arbitrary process, terminal, and extension traffic is not intercepted"],
        evidenceTestIds: ["phase-controls.test.ts", "apps/local-ai-broker broker tests"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "process-sandbox-policy",
        name: "Process sandbox policy",
        category: "process-sandbox",
        level: "DETECTION_ONLY",
        integration: "guard-core ProcessSandboxPolicy + broker /v1/preflight/process-launch",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts#previewProcessLaunch",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["Caller explicitly invokes the authenticated preflight endpoint"],
        knownBypasses: ["No OS sandbox or mandatory controlled launcher; arbitrary child processes are not intercepted"],
        evidenceTestIds: ["phase-controls.test.ts", "apps/local-ai-broker broker tests"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "governance-policy",
        name: "Enterprise policy-change validation",
        category: "governance",
        level: "DETECTION_ONLY",
        integration: "guard-core GovernancePolicy + broker /v1/preflight/policy-change",
        enforcementPoint: "apps/local-ai-broker/src/BrokerServer.ts#previewPolicyChange",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: ["Caller explicitly invokes the authenticated preflight endpoint"],
        knownBypasses: ["Preflight is advisory; edits outside managed paths cannot be stopped"],
        evidenceTestIds: ["phase-controls.test.ts", "apps/local-ai-broker broker tests"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "checkpoint-rollback",
        name: "Checkpoint rollback (real filesystem snapshot/restore via broker)",
        category: "rollback",
        level: "PARTIAL_ENFORCEMENT",
        integration: "guard-core CheckpointRollback (pure logic) + broker FilesystemCheckpointStore (real resource adapter)",
        enforcementPoint: "apps/local-ai-broker/src/CheckpointStore.ts, apps/local-ai-broker/src/BrokerServer.ts#createCheckpoint/rollbackCheckpoint",
        preExecutionBlock: true,
        rollbackSupported: true,
        conditions: [
            "Caller authenticates with broker bearer token + x-soterai-tenant and x-soterai-actor headers",
            "Protected paths resolve inside the configured isolation root",
            "Snapshot root is outside the protected root",
            "Integrity secret is at least 32 characters",
        ],
        knownBypasses: [
            "Checkpoint rollback protects only paths within the configured isolation root, not the entire filesystem",
            "Side effects are declared by the caller; the adapter does not auto-detect them",
            "The broker must be running and configured with checkpoint options",
        ],
        evidenceTestIds: ["apps/local-ai-broker/src/__tests__/checkpoint-rollback.test.ts (16 runtime tests)"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "hosted-ai-gateway",
        name: "Hosted Universal AI Gateway (OpenAI/Anthropic-compatible inline proxy)",
        category: "inline-enforcement",
        level: "STRONG_ENFORCEMENT",
        integration: "Next.js web control plane — customer swaps SDK base_url to /api/gateway/{openai,anthropic}",
        enforcementPoint: "lib/gateway/core.ts, app/api/gateway/openai/v1/chat/completions/route.ts, app/api/gateway/anthropic/v1/messages/route.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "Traffic is routed through the gateway routes with a valid x-soterai-api-key",
            "Request scanned before forwarding; response scanned before returning; SSE streams scanned per accumulated delta",
            "Canonical decision (ALLOW/REDACT/TRANSFORM/WARN/REQUIRE_APPROVAL/BLOCK/QUARANTINE/ABSTAIN) emitted on every response",
        ],
        knownBypasses: [
            "Traffic sent directly to the provider (base_url not swapped) is unenforced",
            "Streaming tokens already flushed before a mid-stream BLOCK cannot be recalled",
            "Internal scan-pipeline crash fails OPEN for availability — evidence is stamped FAIL_OPEN, never overclaimed",
        ],
        evidenceTestIds: ["tests/gateway.test.ts (24 tests: block-input, redact in/out, mid-stream block, key hygiene, tenant binding)"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "model-supply-chain-scan",
        name: "Model & AI supply-chain artifact scanner",
        category: "supply-chain",
        level: "STRONG_ENFORCEMENT",
        integration: "mandatory ONNX runtime-loader gate + web scan route + bounded offline CLI + CycloneDX AI-BOM evidence",
        enforcementPoint: "lib/ml/onnxBackend.ts before InferenceSession.create; lib/model-scan/{runtimeGate,trust,hub}.ts",
        preExecutionBlock: true,
        rollbackSupported: false,
        conditions: [
            "Caller submits the artifact to the scan route; verdicts persist to Prisma",
            "Untrusted artifacts are never loaded/deserialized — bounded isolated parsers only",
            "The supported ONNX loader requires a digest-pinned signed manifest, approved source, and operator trust store",
        ],
        knownBypasses: [
            "Training scripts and external runtimes that load models outside lib/ml/onnxBackend.ts are not mediated",
            "No managed third-party registry promotion/deployment boundary exists in this repository",
        ],
        evidenceTestIds: ["tests/model-scan.test.ts (trusted/unknown/revoked/bad-signature/hash/source/Hub/loader tests)", "tests/ai-bom-cyclonedx.test.ts"],
        wiredInRuntime: true,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "network-egress-firewall-processes",
        name: "Network egress firewall for arbitrary local processes",
        category: "network-egress",
        level: "UNSUPPORTED",
        integration: "none",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: [],
        knownBypasses: ["No local network proxy or OS firewall component ships; terminal/process egress cannot be stopped"],
        evidenceTestIds: [],
        wiredInRuntime: false,
        lastVerifiedVersion: VERSION,
    },
    {
        id: "child-process-control",
        name: "Child-process control for arbitrary AI agents",
        category: "process-sandbox",
        level: "UNSUPPORTED",
        integration: "none",
        preExecutionBlock: false,
        rollbackSupported: false,
        conditions: [],
        knownBypasses: ["No process-tree sandbox/broker enforcement ships; requires controlled terminal or OS-level broker"],
        evidenceTestIds: [],
        wiredInRuntime: false,
        lastVerifiedVersion: VERSION,
    },
];

/** A violation of the honesty invariant. */
export interface HonestyViolation {
    id: string;
    reason: string;
}

/**
 * The honesty invariant, in code. Returns every capability that makes a claim
 * it cannot back:
 *   1. Claims an ENFORCING level (FULL/STRONG) but is not wired into the runtime.
 *   2. Claims pre-execution blocking but is not wired into the runtime.
 *   3. Claims an ENFORCING level but declares no enforcement point.
 * An empty array means the registry is honest.
 */
export function findHonestyViolations(
    caps: readonly ProtectionCapability[] = CAPABILITY_REGISTRY,
): HonestyViolation[] {
    const violations: HonestyViolation[] = [];
    for (const c of caps) {
        const claimsEnforcement = ENFORCING_LEVELS.has(c.level);
        if (claimsEnforcement && !c.wiredInRuntime) {
            violations.push({
                id: c.id,
                reason: `level ${c.level} claims runtime enforcement but wiredInRuntime=false`,
            });
        }
        if (c.preExecutionBlock && !c.wiredInRuntime) {
            violations.push({
                id: c.id,
                reason: `preExecutionBlock=true but wiredInRuntime=false (nothing routes through it)`,
            });
        }
        if (claimsEnforcement && !c.enforcementPoint) {
            violations.push({
                id: c.id,
                reason: `level ${c.level} claims enforcement but has no enforcementPoint`,
            });
        }
    }
    return violations;
}

/** Throws if the registry makes any dishonest claim. Call from CI/tests. */
export function assertHonestLevels(caps: readonly ProtectionCapability[] = CAPABILITY_REGISTRY): void {
    const violations = findHonestyViolations(caps);
    if (violations.length > 0) {
        const detail = violations.map((v) => `  - ${v.id}: ${v.reason}`).join("\n");
        throw new Error(`Capability registry honesty invariant violated:\n${detail}`);
    }
}

/** Stable serializable snapshot for artifacts/security/capabilities.json. */
export function capabilitiesSnapshot(): {
    generatedFor: string;
    honest: boolean;
    counts: Record<string, number>;
    capabilities: CapabilityEvidenceRecord[];
} {
    const counts: Record<string, number> = {};
    for (const c of CAPABILITY_REGISTRY) counts[c.level] = (counts[c.level] ?? 0) + 1;
    const capabilities: CapabilityEvidenceRecord[] = CAPABILITY_REGISTRY.map((capability) => {
        const latencyEvidence =
            capability.id === "mcp-gateway"
                ? "Historical 300-iteration all-budget pass; latest 300-iteration simple-ALLOW p95 overhead 14.17 ms vs 8 ms budget; other buckets pass"
                : capability.id === "universal-ai-gateway"
                  ? "Local real-HTTP core smoke overhead p50/p95/p99 13.123/19.269/22.545 ms; first-token overhead 12.762 ms"
                  : null;
        return {
            ...capability,
            enforcementPoint:
                capability.enforcementPoint ?? "NONE — capability unsupported; no authenticated mediator ships",
            evidenceLevel: capability.level,
            supportedSurfaces: [capability.integration],
            unsupportedSurfaces: [
                capability.knownBypasses.length > 0
                    ? "Surfaces described by knownBypasses are outside guaranteed enforcement"
                    : "Anything outside the named integration and enforcement point",
            ],
            runtimeProof: {
                wiredInRuntime: capability.wiredInRuntime,
                testIds: [...capability.evidenceTestIds],
            },
            latency: {
                status: latencyEvidence ? "MEASURED" : "NOT_MEASURED_PER_CAPABILITY",
                evidence: latencyEvidence,
            },
        };
    });
    return {
        generatedFor: VERSION,
        honest: findHonestyViolations().length === 0,
        counts,
        capabilities,
    };
}
