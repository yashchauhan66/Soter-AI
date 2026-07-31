/**
 * Employee enrollment flow for the Soter extension.
 *
 * Supports two modes:
 * A. Managed Enterprise Mode - config from chrome.storage.managed
 * B. Self-Service Enrollment Mode - enrollment code/magic link
 */

import { getState, setState } from "./storage";
import type { ExtensionConfig, PolicyTrustedKeyConfig } from "./types";
import { DEFAULT_EXTENSION_API_BASE_URL } from "../../../../packages/shared/src/constants";
import { buildTrustedUrl, normalizeEndpoint } from "./trusted-endpoint";

export const ENROLLMENT_STATUS_KEY = "soter.enrollment.status";

export type EnrollmentMode = "managed" | "self_service" | "unenrolled";
export type EnrollmentStatus = "enrolled" | "pending" | "expired" | "unenrolled";

export interface EnrollmentInfo {
  mode: EnrollmentMode;
  status: EnrollmentStatus;
  organizationId?: string;
  employeeId?: string;
  department?: string;
  role?: string;
  deviceToken?: string;
  enrolledAt?: string;
  managedValid: boolean;
  /** Set when enrollment was refused because the configured endpoint is not trusted. */
  endpointError?: string;
}

export interface ManagedConfig {
  apiBaseUrl?: string;
  organizationId?: string;
  employeeId?: string;
  email?: string;
  department?: string;
  role?: string;
  deviceToken?: string;
  policyChannel?: string;
  enrollmentMode?: "managed" | "self_service";
  logLevel?: string;
  /**
   * Enterprise enforcement flags. Settable via Chrome/Edge managed policy
   * (Intune/GPO/MDM). These are applied on top of the cached org policy so a
   * regulated org can force hard-block / fail-closed even before the first
   * signed policy sync completes.
   */
  hardEnforcement?: boolean;
  offlineFailClosed?: boolean;
  /**
   * Refuse any policy bundle that is not cryptographically verified. Requires
   * `policyTrustedKeys` to be set, otherwise every sync fails closed.
   */
  requirePolicySignature?: boolean;
  /** Base64 SPKI ECDSA P-256 public keys the fleet trusts to sign policy bundles. */
  policyTrustedKeys?: PolicyTrustedKeyConfig[];
}

/**
 * Validates the trusted-key list pushed by managed policy. A malformed entry is dropped
 * rather than trusted, and an entry is never accepted without an explicit algorithm —
 * silently defaulting the algorithm is how signature-confusion bugs start.
 */
export function parseManagedTrustedKeys(value: unknown): PolicyTrustedKeyConfig[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const keys: PolicyTrustedKeyConfig[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const keyId = typeof record.keyId === "string" ? record.keyId.trim() : "";
    const publicKey = typeof record.publicKey === "string" ? record.publicKey.trim() : "";
    const algorithm = record.algorithm;
    if (!keyId || !publicKey) continue;
    if (algorithm !== "ecdsa-p256-sha256" && algorithm !== "hmac-sha256") continue;
    keys.push({ keyId, algorithm, publicKey });
  }
  return keys.length > 0 ? keys : undefined;
}

/**
 * Check chrome.storage.managed for enterprise-managed configuration.
 * This is set via Chrome/Edge group policy (ADM/GPO/MDM).
 */
export async function readManagedConfig(): Promise<ManagedConfig | null> {
  try {
    const storage = (typeof chrome !== "undefined" ? chrome : null) as {
      storage?: { managed?: { get: (keys: string | string[] | null, callback: (result: Record<string, unknown>) => void) => void } }
    } | null;
    if (!storage?.storage?.managed) return null;
    const config = await new Promise<ManagedConfig>((resolve) => {
      storage.storage!.managed!.get(null, (result: Record<string, unknown>) => resolve(result as unknown as ManagedConfig));
    });
    if (!config.organizationId && !config.apiBaseUrl) return null;
    return config;
  } catch {
    return null;
  }
}

/**
 * Validate that a managed config has the minimum required fields.
 */
export function validateManagedConfig(config: ManagedConfig): { valid: boolean; missing: string[] } {
  const required: Array<keyof ManagedConfig> = ["organizationId"];
  const missing = required.filter(key => !config[key]);
  return { valid: missing.length === 0, missing };
}

/**
 * Try to enroll from managed configuration.
 *
 * SS-2: the managed endpoint is validated and *pinned*. Managed config is written by the
 * browser's enterprise policy layer, which neither a web page nor this extension can
 * write, so it is a higher authority than any previously stored pin and may re-point the
 * fleet. An endpoint that fails validation refuses enrollment instead of silently falling
 * back to the public cloud endpoint — a regulated org that configured a self-hosted
 * control plane must never have its data quietly redirected somewhere else.
 */
export async function enrollFromManagedConfig(): Promise<EnrollmentInfo> {
  const managed = await readManagedConfig();
  if (!managed) {
    return { mode: "unenrolled", status: "unenrolled", managedValid: false };
  }

  const validation = validateManagedConfig(managed);
  if (!validation.valid) {
    return {
      mode: "managed",
      status: "unenrolled",
      managedValid: false,
      organizationId: managed.organizationId,
    };
  }

  const endpoint = normalizeEndpoint(managed.apiBaseUrl || DEFAULT_EXTENSION_API_BASE_URL);
  if (!endpoint.allowed || !endpoint.origin) {
    return {
      mode: "managed",
      status: "unenrolled",
      managedValid: false,
      organizationId: managed.organizationId,
      endpointError: endpoint.reason ?? endpoint.code,
    };
  }

  // Build config from managed settings
  const config: Partial<ExtensionConfig> = {
    apiBaseUrl: endpoint.origin,
    pinnedApiOrigin: endpoint.origin,
    organizationId: managed.organizationId!,
    employeeId: managed.employeeId || managed.email || "unknown",
    employeeEmail: managed.email,
    department: managed.department,
    role: managed.role,
    deviceToken: managed.deviceToken,
    hardEnforcement: managed.hardEnforcement === true,
    offlineFailClosed: managed.offlineFailClosed === true,
    requirePolicySignature: managed.requirePolicySignature === true,
    policyTrustedKeys: parseManagedTrustedKeys(managed.policyTrustedKeys),
  };

  await setState({
    config: config as ExtensionConfig,
    enrollmentStatus: "enrolled",
    enrollmentMode: "managed",
  });

  return {
    mode: "managed",
    status: "enrolled",
    organizationId: managed.organizationId,
    employeeId: managed.employeeId || managed.email,
    department: managed.department,
    role: managed.role,
    deviceToken: managed.deviceToken,
    enrolledAt: new Date().toISOString(),
    managedValid: true,
  };
}

/**
 * Self-service enrollment using an enrollment code.
 * Calls POST /api/extension/enroll with the code.
 *
 * SS-2 (endpoint trust). Three rules are enforced here:
 *  1. The endpoint the user typed must pass `normalizeEndpoint` (https-only, no embedded
 *     credentials, no remote IP literal, no punycode host).
 *  2. If this profile is already pinned, the endpoint must match the pin. Re-pointing an
 *     enrolled device requires an explicit `unenroll()`, which clears the pin.
 *  3. The origin returned by the *server* (`data.apiBaseUrl`) is never stored. Previously
 *     it was, which let whichever host answered the first enrollment permanently rebind
 *     every later policy fetch, audit event and heartbeat — including the device token in
 *     `x-soter-extension-token`. The origin the operator typed is the only authority.
 */
export async function enrollWithCode(
  apiBaseUrl: string,
  enrollmentCode: string
): Promise<{ ok: true; info: EnrollmentInfo } | { ok: false; error: string }> {
  const state = await getState();
  const endpoint = normalizeEndpoint(apiBaseUrl, { pinnedOrigin: state.config.pinnedApiOrigin });
  if (!endpoint.allowed || !endpoint.origin) {
    return { ok: false, error: endpoint.reason ?? `Endpoint refused (${endpoint.code}).` };
  }
  const origin = endpoint.origin;

  try {
    const response = await fetch(buildTrustedUrl(origin, "/api/extension/enroll"), {
      method: "POST",
      // The enrollment code is the only authority; no ambient cookies, and a redirect
      // (the classic way to move a POST onto another origin) is a hard failure.
      credentials: "omit",
      redirect: "error",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enrollmentCode }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { ok: false, error: body.message || `Enrollment failed: ${response.status}` };
    }

    const data = await response.json();

    // Store only safe credentials locally
    const config: ExtensionConfig = {
      apiBaseUrl: origin,
      pinnedApiOrigin: origin,
      organizationId: data.organizationId,
      organizationName: data.organizationName,
      employeeId: data.employeeId,
      employeeEmail: data.employeeEmail,
      department: data.department,
      role: data.role,
      deviceToken: data.deviceToken,
      // Enforcement strength is set by enterprise policy, never by an enrollment
      // response, so it is carried across rather than reset. Without this, a
      // self-service re-enrollment would silently downgrade a hardened profile.
      hardEnforcement: state.config.hardEnforcement,
      offlineFailClosed: state.config.offlineFailClosed,
      requirePolicySignature: state.config.requirePolicySignature,
      policyTrustedKeys: state.config.policyTrustedKeys,
      policySigningSecret: state.config.policySigningSecret,
    };

    await setState({
      config,
      enrollmentStatus: "enrolled",
      enrollmentMode: "self_service",
      policySyncStatus: "fresh",
    });

    return {
      ok: true,
      info: {
        mode: "self_service",
        status: "enrolled",
        organizationId: data.organizationId,
        employeeId: data.employeeId,
        department: data.department,
        role: data.role,
        deviceToken: data.deviceToken,
        enrolledAt: new Date().toISOString(),
        managedValid: false,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enrollment request failed",
    };
  }
}

/**
 * Get the current enrollment status from state.
 */
export async function getEnrollmentStatus(): Promise<EnrollmentInfo> {
  const state = await getState();

  // Check managed config first
  const managed = await readManagedConfig();
  if (managed && managed.organizationId) {
    const validation = validateManagedConfig(managed);
    return {
      mode: "managed",
      status: validation.valid ? "enrolled" : "unenrolled",
      organizationId: managed.organizationId,
      employeeId: managed.employeeId || managed.email,
      department: managed.department,
      role: managed.role,
      managedValid: validation.valid,
      enrolledAt: state.enrollmentStatus === "enrolled" ? state.lastHeartbeatAt : undefined,
    };
  }

  if (state.enrollmentStatus === "enrolled") {
    return {
      mode: "self_service",
      status: "enrolled",
      organizationId: state.config.organizationId,
      employeeId: state.config.employeeId,
      department: state.config.department,
      role: state.config.role,
      deviceToken: state.config.deviceToken,
      enrolledAt: state.lastHeartbeatAt,
      managedValid: false,
    };
  }

  return { mode: "unenrolled", status: "unenrolled", managedValid: false };
}

/**
 * Unenroll (remove local state). This is the only way to release the endpoint pin, so
 * re-pointing a device at a different control plane is always an explicit local action.
 */
export async function unenroll(): Promise<void> {
  await setState({
    enrollmentStatus: "unenrolled",
    enrollmentMode: undefined,
    // `setState` merges config, so every credential-bearing field must be cleared
    // explicitly — otherwise the device token and the pin survive an unenrollment.
    config: {
      apiBaseUrl: DEFAULT_EXTENSION_API_BASE_URL,
      organizationId: "",
      organizationName: undefined,
      employeeId: "",
      employeeEmail: undefined,
      department: undefined,
      role: undefined,
      deviceToken: undefined,
      pinnedApiOrigin: undefined,
    },
    policySyncStatus: "never",
    policy: undefined,
    // `policyTrust` is deliberately NOT cleared. It is the trust ratchet: once this
    // profile has seen a signed bundle, a local unenroll/re-enroll cycle must not become
    // a way to get back to accepting unsigned policy. `policyIntegrity` is only a stale
    // diagnostic, so it is cleared.
    policyIntegrity: undefined,
  });
  // Clear enrollment-specific storage (chrome.storage available at runtime only)
  try {
     
    const ext = (typeof chrome !== "undefined" ? (chrome as any) : null) as { storage?: { local?: { remove?: (keys: string[]) => void } } } | null;
    if (ext?.storage?.local?.remove) ext.storage.local.remove([ENROLLMENT_STATUS_KEY]);
  } catch { /* storage not available */ }
}
