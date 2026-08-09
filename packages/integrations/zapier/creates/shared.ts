/**
 * Shared plumbing for every SoterAI Zapier create.
 *
 * These helpers used to live at the bottom of creates/guardActions.ts, private
 * to that file. Adding eight more actions made that untenable: each one needs
 * the same base-URL validation, and a second copy of an SSRF check is a second
 * chance to get it wrong. There is now exactly one.
 */

export const DEFAULT_BASE_URL = "https://soterai.in";
export const USER_AGENT = "soterai-zapier/1.0";

export interface ZapierZ {
  request(
    opts: Record<string, unknown>,
  ): Promise<{
    json: Record<string, unknown>;
    status?: number;
    getHeader?(name: string): string | undefined;
    throwForStatus(): void;
  }>;
}

export interface ZapierBundle {
  authData: Record<string, string>;
  inputData: Record<string, string>;
}

/**
 * Resolves the API base URL from the connection's Base URL field, falling back
 * to the public endpoint when unset.
 *
 * Honouring this field is a data-residency requirement: self-hosted and
 * regional (EU) customers must never have their traffic silently sent to the
 * default India endpoint. Validation mirrors the n8n node's `validateBaseUrl`
 * so both integrations enforce the same SSRF rules — HTTPS only (except
 * localhost for local development), and no credentials, query parameters, or
 * fragments in the URL.
 */
export function getBaseUrl(bundle: ZapierBundle): string {
  const raw = (bundle.authData?.baseUrl || "").trim();
  if (!raw) return DEFAULT_BASE_URL;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("SoterAI Base URL must be a valid URL.");
  }

  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "SoterAI Base URL must not include credentials, query parameters, or fragments.",
    );
  }

  const isLocalDevHost = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalDevHost)) {
    throw new Error(
      "SoterAI Base URL must use HTTPS, except http://localhost for local development.",
    );
  }

  parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString().replace(/\/$/, "");
}

export function tryParseJson(value?: string): Record<string, unknown> {
  if (!value?.trim()) return {};
  try {
    const p = JSON.parse(value);
    return typeof p === "object" && p && !Array.isArray(p) ? p : {};
  } catch {
    return {};
  }
}

/** Resolves the effective project id: per-action override, else the connection default. */
export function resolveProjectId(bundle: ZapierBundle): string | undefined {
  return bundle.inputData.project || bundle.authData.project || bundle.authData.projectId || undefined;
}

/**
 * Splits a comma or newline separated field into a trimmed list.
 *
 * Zapier has no native list-of-strings input for a plain text field, and topic
 * sets are the one place a user genuinely wants to type several values. Empty
 * entries are dropped so a trailing comma does not become an empty topic — an
 * empty topic would widen the vocabulary to nothing and silently disable the
 * off-topic guard.
 */
export function splitList(value?: string): string[] | undefined {
  if (!value?.trim()) return undefined;
  // Bounded to match the server schema (50 entries, 120 chars each), so a long
  // list is trimmed here instead of failing the whole Zap step with a 400 the
  // user cannot easily trace back to this field.
  const items = value
    .split(/[\n,]/)
    .map((entry) => entry.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, 50);
  return items.length ? items : undefined;
}

/**
 * A single POST to the SoterAI API.
 *
 * `undefined` body fields are stripped before serialization. That matters more
 * than it looks: several server schemas treat "field present but null" and
 * "field absent" differently — an explicit null `source` is a validation error
 * where an absent one defaults to USER.
 */
export async function soterPost(
  z: ZapierZ,
  bundle: ZapierBundle,
  path: string,
  body: Record<string, unknown>,
  options: { requireAuth?: boolean } = {},
): Promise<Record<string, unknown>> {
  const baseUrl = getBaseUrl(bundle);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT,
  };
  // analyzeText is a public endpoint; sending a key there is harmless but
  // pointless, and omitting it keeps the action usable before a key is issued.
  if (options.requireAuth !== false) headers["x-api-key"] = bundle.authData.apiKey;

  const response = await z.request({
    url: `${baseUrl}${path}`,
    method: "POST",
    headers,
    body: JSON.stringify(stripUndefined(body)),
  });
  response.throwForStatus();
  return response.json;
}

function stripUndefined(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = stripUndefined(value as Record<string, unknown>);
      if (Object.keys(nested).length) out[key] = nested;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * The four fields Phases 2–4 added to the guard response, normalized.
 *
 * Every guard-shaped action returns these so a Zap author sees the same field
 * names whichever action they picked. `primaryRiskType` in particular is the
 * one that makes the SQL-injection fix visible: it replaces the old habit of
 * reading `categories[0]`, which was ordered by detector registration and told
 * the user nothing about which risk actually drove the verdict.
 */
export function calibrationFields(raw: Record<string, unknown>) {
  return {
    primaryRiskType: (raw.primaryRiskType as string) ?? null,
    categoryConfidence: (raw.categoryConfidence as Record<string, number>) ?? {},
    latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : null,
  };
}

/** Output-field descriptors matching `calibrationFields`, for reuse in each action. */
export const CALIBRATION_OUTPUT_FIELDS = [
  { key: "primaryRiskType", label: "Primary Risk Type", type: "string" as const },
  { key: "categoryConfidence", label: "Category Confidence", dict: true },
  { key: "latencyMs", label: "Server Latency (ms)", type: "number" as const },
];

/** Input-field descriptors for the optional topical-alignment guard. */
export const TOPIC_INPUT_FIELDS = [
  {
    key: "allowedTopics",
    label: "Allowed Topics",
    type: "text" as const,
    required: false,
    helpText:
      "Optional. Comma or newline separated subjects this assistant is meant to handle (for example: billing, refunds, shipping). Leave blank to disable the off-topic guard entirely — it is a no-op without topics.",
  },
  {
    key: "systemPromptContext",
    label: "System Prompt Context",
    type: "text" as const,
    required: false,
    helpText:
      "Optional. Paste your system prompt to derive the topic vocabulary from it instead of listing topics by hand.",
  },
  {
    key: "minTopicRelevance",
    label: "Minimum Topic Relevance",
    type: "number" as const,
    required: false,
    helpText:
      "Optional, 0 to 1. Messages below this coverage are reported as OFF_TOPIC. Defaults to 0.25 (deliberately permissive). OFF_TOPIC is advisory — on its own it never blocks.",
  },
];

/** The topical fields as an API request fragment, or nothing when unconfigured. */
export function topicRequestFields(bundle: ZapierBundle) {
  const minTopicRelevance = bundle.inputData.minTopicRelevance;
  return {
    allowedTopics: splitList(bundle.inputData.allowedTopics),
    systemPromptContext: bundle.inputData.systemPromptContext?.trim() || undefined,
    minTopicRelevance:
      minTopicRelevance === undefined || minTopicRelevance === null || `${minTopicRelevance}`.trim() === ""
        ? undefined
        : Number(minTopicRelevance),
  };
}
