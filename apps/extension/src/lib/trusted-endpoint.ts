/**
 * Endpoint trust for the SoterAI extension control plane (SS-2).
 *
 * Before this module the extension would `fetch` any string as its API base URL and,
 * worse, would persist the origin the *server* returned in its enrollment response —
 * letting whichever host answered the first enrollment permanently rebind every later
 * policy fetch, audit event and heartbeat, including the `x-soter-extension-token`
 * device token. See docs/SOTERAI-BROWSER-GUARD-SUPREMACY-REPORT.md SS-2.
 *
 * Rules enforced here:
 *  - https only. Plaintext http is accepted for loopback hosts only, which are a
 *    secure context by W3C definition and cannot be intercepted on the network.
 *  - No credentials embedded in the URL.
 *  - No remote IP literals (a bare IP cannot be pinned meaningfully and is a common
 *    way to dodge an allowlist).
 *  - No punycode/IDN control-plane hosts: an operator-chosen endpoint never needs one,
 *    and allowing them re-opens homograph confusion on the most sensitive origin.
 *  - Trailing-dot and case normalisation, so `Example.COM.` cannot slip past a pin.
 *  - When a pin exists, the origin must match it exactly.
 */

export type EndpointDecisionCode =
  | "ok"
  | "malformed"
  | "insecure_scheme"
  | "ip_literal"
  | "credentials_in_url"
  | "punycode_host"
  | "pin_mismatch";

export interface EndpointDecision {
  allowed: boolean;
  code: EndpointDecisionCode;
  /** Canonical `scheme://host[:port]` to store and use. Present only when allowed. */
  origin?: string;
  reason?: string;
  /** True when the endpoint is a loopback address. */
  loopback?: boolean;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;

export function isLoopbackHost(hostname: string) {
  const host = hostname.toLowerCase();
  return LOOPBACK_HOSTS.has(host) || host.endsWith(".localhost");
}

/**
 * Validates and canonicalises a control-plane endpoint.
 *
 * @param candidate raw user, managed-config or server-supplied URL
 * @param options.pinnedOrigin previously pinned origin the candidate must match
 */
export function normalizeEndpoint(
  candidate: unknown,
  options: { pinnedOrigin?: string } = {},
): EndpointDecision {
  if (typeof candidate !== "string" || candidate.trim().length === 0) {
    return { allowed: false, code: "malformed", reason: "Endpoint must be a non-empty URL string." };
  }

  let url: URL;
  try {
    url = new URL(candidate.trim());
  } catch {
    return { allowed: false, code: "malformed", reason: "Endpoint is not a valid absolute URL." };
  }

  if (url.username || url.password) {
    return { allowed: false, code: "credentials_in_url", reason: "Endpoint must not embed credentials." };
  }

  const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
  const loopback = isLoopbackHost(hostname);

  // Scheme first: an opaque scheme such as `javascript:` or `data:` also has no host, and
  // reporting it as "malformed" would hide the far more important fact that it is not a
  // transport at all.
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    return {
      allowed: false,
      code: "insecure_scheme",
      reason: `Endpoint scheme ${url.protocol} is not allowed. Use https (http is permitted for loopback only).`,
    };
  }

  if (!hostname) {
    return { allowed: false, code: "malformed", reason: "Endpoint has no host." };
  }

  const bracketed = hostname.startsWith("[") && hostname.endsWith("]");
  if (!loopback && (IPV4_PATTERN.test(hostname) || bracketed || hostname.includes(":"))) {
    return { allowed: false, code: "ip_literal", reason: "Endpoint must be a hostname, not an IP literal." };
  }

  if (!loopback && hostname.split(".").some((label) => label.startsWith("xn--"))) {
    return {
      allowed: false,
      code: "punycode_host",
      reason: "Internationalised (punycode) control-plane hosts are not accepted.",
    };
  }

  const port = url.port ? `:${url.port}` : "";
  const origin = `${url.protocol}//${hostname}${port}`;

  if (options.pinnedOrigin) {
    const pinned = normalizePinnedOrigin(options.pinnedOrigin);
    if (pinned && pinned !== origin) {
      return {
        allowed: false,
        code: "pin_mismatch",
        reason: `Endpoint origin ${origin} does not match the pinned origin ${pinned}.`,
      };
    }
  }

  return { allowed: true, code: "ok", origin, loopback };
}

/** Canonicalises a stored pin the same way a candidate is canonicalised. */
export function normalizePinnedOrigin(pinned: unknown): string | undefined {
  if (typeof pinned !== "string" || !pinned.trim()) return undefined;
  try {
    const url = new URL(pinned.trim());
    const hostname = url.hostname.replace(/\.$/, "").toLowerCase();
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${hostname}${port}`;
  } catch {
    return undefined;
  }
}

/** Convenience guard used by the API client on every request. */
export function assertTrustedEndpoint(candidate: unknown, pinnedOrigin?: string): string {
  const decision = normalizeEndpoint(candidate, { pinnedOrigin });
  if (!decision.allowed || !decision.origin) {
    throw new Error(`Soter endpoint refused: ${decision.reason ?? decision.code}`);
  }
  return decision.origin;
}

/**
 * Builds a request URL that is guaranteed to sit on the trusted origin. Any path that
 * tries to escape the origin (absolute URL, protocol-relative, or a traversal that
 * resolves elsewhere) is refused rather than silently followed.
 */
export function buildTrustedUrl(origin: string, path: string, pinnedOrigin?: string): URL {
  const trusted = assertTrustedEndpoint(origin, pinnedOrigin);
  const url = new URL(path, `${trusted}/`);
  if (`${url.protocol}//${url.hostname.toLowerCase()}${url.port ? `:${url.port}` : ""}` !== trusted) {
    throw new Error("Soter endpoint refused: request path resolved to a different origin.");
  }
  return url;
}
