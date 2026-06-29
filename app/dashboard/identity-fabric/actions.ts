"use server";

import {
  createAgentPassport,
  verifyAgentPassport,
  exchangePassportForTask,
  delegateCredentials,
  createAuthChallenge,
  respondToAuthChallenge,
  verifyAuthResponse,
  registerAgentServicePrincipal,
  generateAgentScimExternalId,
  parseCapability,
  capabilityMatches,
  intersectCapabilities,
  normalizeCapabilities,
} from "@/lib/identity-fabric";
import {
  recordPassportIssuance,
} from "@/lib/identity-fabric/db";

// ── Issue Passport ───────────────────────────────────────────────────────────

export type IssuePassportResult = {
  success: boolean;
  raw?: string;
  claims?: {
    sub: string;
    cap: string[];
    iat: number;
    exp: number;
    jti: string;
    aud?: string;
    scope?: string;
    depth?: number;
  };
  error?: string;
};

export async function issueIdentityPassport(
  _prevState: IssuePassportResult | null,
  formData: FormData,
): Promise<IssuePassportResult> {
  const agentId = String(formData.get("agentId") ?? "").trim();
  const capabilitiesRaw = String(formData.get("capabilities") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim() || undefined;
  const scope = String(formData.get("scope") ?? "").trim() || undefined;

  if (!agentId) return { success: false, error: "Agent identity ID is required." };
  if (!capabilitiesRaw) return { success: false, error: "At least one capability is required." };

  const capabilities = capabilitiesRaw
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => parseCapability(c))
    .filter(Boolean)
    .map((c) => `${c!.action}:${c!.resource}` + (c!.subresource ? `/${c!.subresource}` : ""));

  if (capabilities.length === 0) {
    return { success: false, error: "No valid capabilities provided. Format: <action>:<resource>" };
  }

  const normalized = normalizeCapabilities(capabilities);
  const passport = createAgentPassport(agentId, normalized, { audience, scope });

  // Persist to database
  recordPassportIssuance("dashboard", passport.claims).catch(() => {});

  return {
    success: true,
    raw: passport.raw,
    claims: passport.claims,
  };
}

// ── Verify Passport ──────────────────────────────────────────────────────────

export type VerifyPassportResult = {
  success: boolean;
  status?: string;
  valid?: boolean;
  active?: boolean;
  claims?: {
    sub: string;
    cap: string[];
    iat: number;
    exp: number;
    jti: string;
    aud?: string;
    scope?: string;
    depth?: number;
    prt?: string;
  };
  remainingTtl?: number;
  error?: string;
};

export async function verifyIdentityPassport(
  _prevState: VerifyPassportResult | null,
  formData: FormData,
): Promise<VerifyPassportResult> {
  const token = String(formData.get("token") ?? "").trim();
  const requiredCap = String(formData.get("requiredCapability") ?? "").trim() || undefined;

  if (!token) return { success: false, error: "Passport token is required." };

  const decoded = verifyAgentPassport(token);

  if (!decoded.valid) {
    return {
      success: false,
      status: decoded.status,
      valid: false,
      active: false,
      error: `Passport verification failed: ${decoded.status}`,
    };
  }

  if (requiredCap && decoded.claims) {
    capabilityMatches(requiredCap, decoded.claims.cap[0] ?? "");
  }

  const remainingTtl = decoded.claims?.exp
    ? Math.max(0, decoded.claims.exp - Math.floor(Date.now() / 1000))
    : undefined;

  return {
    success: true,
    status: decoded.status,
    valid: decoded.valid,
    active: decoded.active,
    claims: decoded.claims
      ? {
          sub: decoded.claims.sub,
          cap: decoded.claims.cap,
          iat: decoded.claims.iat,
          exp: decoded.claims.exp,
          jti: decoded.claims.jti,
          aud: decoded.claims.aud,
          scope: decoded.claims.scope,
          depth: decoded.claims.depth,
          prt: decoded.claims.prt,
        }
      : undefined,
    remainingTtl,
  };
}

// ── Delegate Capabilities ────────────────────────────────────────────────────

export type DelegateResult = {
  success: boolean;
  allowed?: boolean;
  resultingCapabilities?: string[];
  proofFormat?: string;
  proofHash?: string;
  violations?: string[];
  error?: string;
};

export async function delegateIdentityCredentials(
  _prevState: DelegateResult | null,
  formData: FormData,
): Promise<DelegateResult> {
  const parentToken = String(formData.get("parentToken") ?? "").trim();
  const childId = String(formData.get("childAgentId") ?? "").trim();
  const capRaw = String(formData.get("delegateCapabilities") ?? "").trim();

  if (!parentToken) return { success: false, error: "Parent passport token is required." };
  if (!childId) return { success: false, error: "Child agent identity ID is required." };
  if (!capRaw) return { success: false, error: "At least one capability to delegate is required." };

  const caps = capRaw
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);

  const result = delegateCredentials({
    parentPassport: parentToken,
    childAgentIdentityId: childId,
    delegatedCapabilities: caps,
    intent: "Dashboard credential delegation",
  });

  return {
    success: result.allowed,
    allowed: result.allowed,
    resultingCapabilities: result.resultingCapabilities,
    proofFormat: result.proof?.format,
    proofHash: result.proof?.proofHash,
    violations: result.violations,
    error: result.allowed ? undefined : result.violations.join("; "),
  };
}

// ── Task Token Exchange ──────────────────────────────────────────────────────

export type TaskTokenResult = {
  success: boolean;
  raw?: string;
  expiresAt?: string;
  parentJti?: string;
  error?: string;
};

export async function exchangeForTaskToken(
  _prevState: TaskTokenResult | null,
  formData: FormData,
): Promise<TaskTokenResult> {
  const parentToken = String(formData.get("parentToken") ?? "").trim();
  const requiredCap = String(formData.get("requiredCap") ?? "").trim();
  const audience = String(formData.get("audience") ?? "").trim();
  const context = String(formData.get("context") ?? "").trim() || undefined;

  if (!parentToken) return { success: false, error: "Parent passport token is required." };
  if (!requiredCap) return { success: false, error: "Required capability is required." };
  if (!audience) return { success: false, error: "Target audience is required." };

  const task = exchangePassportForTask({
    parentToken,
    requiredCapability: requiredCap,
    audience,
    context,
  });

  if (!task) return { success: false, error: "Token exchange failed. Check that the parent passport has the required capability." };

  return {
    success: true,
    raw: task.raw,
    expiresAt: task.expiresAt.toISOString(),
    parentJti: task.parentJti,
  };
}

// ── Cross-Agent Verification ─────────────────────────────────────────────────

export type CrossAgentVerifyResult = {
  success: boolean;
  challengeToken?: string;
  responseSignature?: string;
  verified?: boolean;
  agentIdentityId?: string;
  step?: string;
  error?: string;
};

export async function crossAgentVerify(
  _prevState: CrossAgentVerifyResult | null,
  formData: FormData,
): Promise<CrossAgentVerifyResult> {
  const sourceAgentId = String(formData.get("sourceAgentId") ?? "").trim();
  const targetAgentId = String(formData.get("targetAgentId") ?? "").trim();
  const targetPassport = String(formData.get("targetPassport") ?? "").trim();

  if (!sourceAgentId || !targetAgentId || !targetPassport) {
    return { success: false, error: "Source agent, target agent, and target passport are required." };
  }

  // Step 1: Create challenge
  const challenge = createAuthChallenge(sourceAgentId, targetAgentId);

  // Step 2: Respond to challenge
  const response = respondToAuthChallenge(challenge, targetPassport);
  if (!response) {
    return {
      success: false,
      step: "response",
      error: "Failed to respond to challenge. Check that the target passport is valid and matches the target agent ID.",
    };
  }

  // Step 3: Verify response
  const verification = verifyAuthResponse(challenge, response);

  return {
    success: verification.verified,
    challengeToken: challenge.challenge,
    responseSignature: response.signature,
    verified: verification.verified,
    agentIdentityId: verification.agentIdentityId,
    step: "complete",
    error: verification.reason,
  };
}

// ── IdP Registration ─────────────────────────────────────────────────────────

export type IdpRegisterResult = {
  success: boolean;
  principalId?: string;
  provider?: string;
  mappedAgentId?: string;
  scimExternalId?: string;
  error?: string;
};

export async function registerIdpPrincipal(
  _prevState: IdpRegisterResult | null,
  formData: FormData,
): Promise<IdpRegisterResult> {
  const provider = String(formData.get("provider") ?? "").trim();
  const principalId = String(formData.get("principalId") ?? "").trim();
  const agentId = String(formData.get("agentId") ?? "").trim();
  const scopesStr = String(formData.get("scopes") ?? "").trim();

  if (!provider || !principalId || !agentId) {
    return { success: false, error: "Provider, principal ID, and agent identity ID are required." };
  }

  if (!["okta", "azure-ad", "generic-saml"].includes(provider)) {
    return { success: false, error: "Provider must be one of: okta, azure-ad, generic-saml." };
  }

  const scopes = scopesStr
    ? scopesStr.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  try {
    const principal = registerAgentServicePrincipal(
      principalId,
      provider as "okta" | "azure-ad" | "generic-saml",
      agentId,
      scopes,
    );

    const scimId = generateAgentScimExternalId(agentId, "org-dashboard");

    return {
      success: true,
      principalId: principal.principalId,
      provider: principal.provider,
      mappedAgentId: principal.agentIdentityId,
      scimExternalId: scimId,
    };
  } catch (error: unknown) {
    return { success: false, error: String(error) };
  }
}

// ── Utility ──────────────────────────────────────────────────────────────────

export type CapabilityParseResult = {
  success: boolean;
  parsed?: Array<{ action: string; resource: string; subresource?: string; conditions: Record<string, string> }>;
  error?: string;
};

export async function parseCapabilityString(formData: FormData): Promise<CapabilityParseResult> {
  const raw = String(formData.get("capability") ?? "").trim();
  if (!raw) return { success: false, error: "Capability string is required." };

  const parsed = parseCapability(raw);
  if (!parsed) return { success: false, error: "Invalid capability format. Use: <action>:<resource>[/<subresource>][?<key>=<value>]" };

  return {
    success: true,
    parsed: [parsed],
  };
}

export type CapabilityIntersectResult = {
  success: boolean;
  parentCaps?: string[];
  childCaps?: string[];
  intersection?: string[];
  error?: string;
};

export async function intersectCapabilityAction(formData: FormData): Promise<CapabilityIntersectResult> {
  const parentRaw = String(formData.get("parentCaps") ?? "").trim();
  const childRaw = String(formData.get("childCaps") ?? "").trim();

  if (!parentRaw || !childRaw) return { success: false, error: "Both parent and child capabilities are required." };

  const parentCaps = parentRaw.split("\n").map((c) => c.trim()).filter(Boolean);
  const childCaps = childRaw.split("\n").map((c) => c.trim()).filter(Boolean);

  const intersection = intersectCapabilities(parentCaps, childCaps);

  return {
    success: true,
    parentCaps,
    childCaps,
    intersection,
  };
}
