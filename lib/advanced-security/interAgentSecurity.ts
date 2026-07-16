import { createHmac, timingSafeEqual } from "crypto";

export interface AgentMessage {
  fromAgentId: string;
  toAgentId: string;
  content: string;
  timestamp: number;
  sessionId: string;
  delegationChain?: string[];
  integrityHash?: string;
  signature?: AgentMessageSignature;
}

export interface AgentMessageSignature {
  alg: "hmac-sha256";
  keyId: string;
  value: string;
}

export interface InterAgentSecurityResult {
  allowed: boolean;
  risk: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  findings: InterAgentFinding[];
}

export interface InterAgentFinding {
  type: "INJECTION_RELAY" | "PRIVILEGE_ESCALATION" | "CIRCULAR_REFERENCE" | "UNAUTHORIZED_SPAWN" | "INSTRUCTION_OVERRIDE" | "DATA_LEAK_RELAY" | "TRUST_CHAIN_BREAK" | "INVALID_SIGNATURE";
  message: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?/i,
  /(?:override|bypass|disable)\s+(?:safety|security|restrictions?|policies?)/i,
  /(?:you are now|new instructions?|follow my instructions? instead)/i,
  /(?:system[_\s]?override|admin[_\s]?mode|developer[_\s]?mode)/i,
  /(?:exfiltrate|extract|send|forward)\s+(?:all|the)\s+(?:data|context|conversation|memory|secrets?|credentials?|api[_\s]?keys?|tokens?)/i,
  /(?:delete|drop|truncate|destroy)\s+(?:all|the)\s+(?:data|records?|files?|database)/i,
  /(?:grant|give|assign|escalate)\s+(?:admin|full|root|elevated)\s+(?:access|permissions?|privileges?)/i,
];

const PRIVILEGE_ESCALATION_PATTERNS = [
  /(?:act as|become|impersonate|assume the role of)\s+(?:admin|root|system|orchestrator|supervisor)/i,
  /(?:my|this agent's)\s+(?:permissions?|privileges?|access|authorization)\s+(?:includes?|allows?|covers?)\s+(?:everything|all|admin|root)/i,
  /(?:the (?:orchestrator|supervisor|parent|calling) agent)\s+(?:authorized|approved|granted|delegated)\s+(?:full|admin|unrestricted|elevated)/i,
  /(?:delegation chain|trust chain|permission chain)\s+(?:confirms?|verifies?|grants?)\s+(?:admin|full|unrestricted)/i,
];

const CIRCULAR_PATTERNS = [
  /(?:forward|relay|send|pass)\s+(?:this|the same)\s+(?:message|request|instruction)\s+(?:back|to the sender|to agent)/i,
  /(?:ask|tell|instruct)\s+(?:agent|the sender|the calling agent)\s+(?:to repeat|to forward|to relay)/i,
];

const DATA_LEAK_PATTERNS = [
  /(?:include|attach|append|embed)\s+(?:all|the|full)\s+(?:conversation|context|memory|history|secrets?|credentials?|api[_\s]?keys?)/i,
  /(?:forward|send|relay|transmit)\s+(?:all|the|full)?\s*(?:user's?|customer's?|private)?\s*(?:data|information|context|pii|secrets?|credentials?|api[_\s]?keys?|tokens?)/i,
];

function canonicalMessage(message: AgentMessage) {
  const { signature: _signature, integrityHash: _integrityHash, ...unsigned } = message;
  return JSON.stringify(unsigned, Object.keys(unsigned).sort());
}

export function signAgentMessage(message: AgentMessage, secret: string, keyId = "local"): AgentMessageSignature {
  return {
    alg: "hmac-sha256",
    keyId,
    value: createHmac("sha256", secret).update(canonicalMessage(message)).digest("hex"),
  };
}

export function verifyAgentMessageSignature(message: AgentMessage, secretForKey: (keyId: string) => string | undefined) {
  if (!message.signature) return { signed: false, valid: false, reason: "Inter-agent message is unsigned." };
  const secret = secretForKey(message.signature.keyId);
  if (!secret) return { signed: true, valid: false, reason: "Unknown inter-agent signing key." };
  const expected = createHmac("sha256", secret).update(canonicalMessage(message)).digest("hex");
  const actual = message.signature.value;
  const valid = /^[a-f0-9]{64}$/i.test(actual) && timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(actual, "hex"));
  return { signed: true, valid, reason: valid ? "Inter-agent message signature is valid." : "Inter-agent message signature mismatch." };
}

export function checkInterAgentMessage(message: AgentMessage): InterAgentSecurityResult {
  const findings: InterAgentFinding[] = [];
  const content = message.content;
  const signingSecret = process.env.INTER_AGENT_SIGNING_SECRET;

  if (signingSecret || message.signature) {
    const verification = verifyAgentMessageSignature(message, (keyId) =>
      signingSecret && (!message.signature || keyId === message.signature.keyId) ? signingSecret : undefined,
    );
    if (!verification.valid) {
      findings.push({
        type: "INVALID_SIGNATURE",
        message: verification.reason,
        severity: "CRITICAL",
      });
    }
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({
        type: "INJECTION_RELAY",
        message: "Inter-agent message contains instruction injection patterns that may compromise receiving agent.",
        severity: "HIGH",
      });
      break;
    }
  }

  for (const pattern of PRIVILEGE_ESCALATION_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({
        type: "PRIVILEGE_ESCALATION",
        message: "Inter-agent message attempts to escalate privileges via false delegation claims.",
        severity: "HIGH",
      });
      break;
    }
  }

  for (const pattern of CIRCULAR_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({
        type: "CIRCULAR_REFERENCE",
        message: "Inter-agent message may create infinite relay loop.",
        severity: "MEDIUM",
      });
      break;
    }
  }

  for (const pattern of DATA_LEAK_PATTERNS) {
    if (pattern.test(content)) {
      findings.push({
        type: "DATA_LEAK_RELAY",
        message: "Inter-agent message attempts to relay sensitive data to another agent.",
        severity: "HIGH",
      });
      break;
    }
  }

  if (message.delegationChain && message.delegationChain.length > 5) {
    findings.push({
      type: "TRUST_CHAIN_BREAK",
      message: "Delegation chain depth exceeds safe threshold, possible chain-of-trust attack.",
      severity: "MEDIUM",
    });
  }

  if (message.delegationChain) {
    const unique = new Set(message.delegationChain);
    if (unique.size < message.delegationChain.length) {
      findings.push({
        type: "CIRCULAR_REFERENCE",
        message: "Circular delegation detected: an agent appears multiple times in the chain.",
        severity: "HIGH",
      });
    }
  }

  const maxSeverity = findings.reduce((max, f) => {
    const order: Record<string, number> = { NONE: -1, LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
    return (order[f.severity] ?? 0) > (order[max] ?? -1) ? f.severity : max;
  }, "NONE" as "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL");

  return {
    allowed: maxSeverity !== "HIGH" && maxSeverity !== "CRITICAL",
    risk: maxSeverity === "NONE" ? "NONE" : maxSeverity,
    findings,
  };
}

export function validateAgentSpawn(
  parentAgentId: string,
  childAgentType: string,
  authorizedTypes: string[],
): InterAgentSecurityResult {
  const findings: InterAgentFinding[] = [];

  if (!authorizedTypes.includes(childAgentType)) {
    findings.push({
      type: "UNAUTHORIZED_SPAWN",
      message: `Agent "${parentAgentId}" attempted to spawn unauthorized agent type "${childAgentType}".`,
      severity: "HIGH",
    });
  }

  return {
    allowed: findings.length === 0,
    risk: findings.length > 0 ? "HIGH" : "NONE",
    findings,
  };
}
