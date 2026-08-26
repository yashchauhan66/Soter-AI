/**
 * Markup tokenizer for the XML-shaped formats: SVG, OOXML parts, ODF content,
 * HTML, and the RELS files that carry a document's external references.
 *
 * Written by hand rather than pulled from a dependency for two reasons. The
 * browser build cannot take a Node parser, and a strict parser throws on exactly
 * the malformed input we most need to read — a hostile DOCX is not obliged to be
 * well-formed. So this tokenizer never throws: it reports what it recovered and
 * flags the document as malformed when the markup does not close cleanly.
 *
 * It is a tokenizer, not a DOM. Callers keep their own element stack, which is
 * what lets the OOXML parser know that a `<w:t>` sits inside a run marked
 * `<w:vanish/>` without holding the whole tree in memory.
 */

export type XmlTokenKind = "open" | "close" | "self" | "text" | "comment" | "cdata" | "pi" | "doctype" | "rawtext";

export interface XmlToken {
  kind: XmlTokenKind;
  /** Lowercased tag name including any prefix, e.g. "w:t". Empty for text nodes. */
  name: string;
  /** Text content for text/comment/cdata/rawtext tokens, entity-decoded for text. */
  text?: string;
  /** Present on open/self tokens. Names lowercased, values entity-decoded. */
  attributes?: Record<string, string>;
}

export interface TokenizeResult {
  /** True when a cap stopped the walk before the end of the input. */
  truncated: boolean;
  /** True when a tag never closed, or a close tag had no matching open. */
  malformed: boolean;
  tokenCount: number;
}

/** Elements whose content is text, not markup. Their bodies must not be re-parsed. */
const RAW_TEXT_ELEMENTS = new Set(["script", "style"]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  // Decoded to a plain space: analysis cares about the word boundary, not the width.
  nbsp: " ",
  // Invisible characters are written as codepoints, never as literals, so this
  // source file stays free of the characters it decodes. They are decoded rather
  // than dropped because countInvisibleCharacters must still be able to see them.
  shy: String.fromCodePoint(0x00ad),
  zwj: String.fromCodePoint(0x200d),
  zwnj: String.fromCodePoint(0x200c),
  lrm: String.fromCodePoint(0x200e),
  rlm: String.fromCodePoint(0x200f),
};

export function decodeXmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (whole, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      // Surrogate halves are not valid scalar values; leaving them encoded is
      // safer than producing a lone surrogate that later breaks a JSON encode.
      if (code >= 0xd800 && code <= 0xdfff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
  });
}

/**
 * Walk `source`, calling `onToken` for each token. Bounded by `maxTokens` so a
 * multi-megabyte generated XML part cannot stall a request.
 */
export function tokenizeMarkup(
  source: string,
  onToken: (token: XmlToken) => void,
  maxTokens = 200_000,
): TokenizeResult {
  const result: TokenizeResult = { truncated: false, malformed: false, tokenCount: 0 };
  let i = 0;
  let depth = 0;

  const emit = (token: XmlToken): boolean => {
    result.tokenCount += 1;
    if (result.tokenCount > maxTokens) {
      result.truncated = true;
      return false;
    }
    onToken(token);
    return true;
  };

  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      const trailing = source.slice(i);
      if (trailing.trim() && !emit({ kind: "text", name: "", text: decodeXmlEntities(trailing) })) break;
      i = source.length;
      break;
    }
    if (lt > i) {
      const text = source.slice(i, lt);
      if (text.trim() && !emit({ kind: "text", name: "", text: decodeXmlEntities(text) })) break;
    }

    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      const stop = end === -1 ? source.length : end;
      if (end === -1) result.malformed = true;
      if (!emit({ kind: "comment", name: "", text: source.slice(lt + 4, stop) })) break;
      i = end === -1 ? source.length : end + 3;
      continue;
    }

    if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      const stop = end === -1 ? source.length : end;
      if (end === -1) result.malformed = true;
      // CDATA is literal by definition, so it is NOT entity-decoded.
      if (!emit({ kind: "cdata", name: "", text: source.slice(lt + 9, stop) })) break;
      i = end === -1 ? source.length : end + 3;
      continue;
    }

    if (source.startsWith("<?", lt)) {
      const end = source.indexOf("?>", lt + 2);
      const stop = end === -1 ? source.length : end;
      if (end === -1) result.malformed = true;
      if (!emit({ kind: "pi", name: "", text: source.slice(lt + 2, stop) })) break;
      i = end === -1 ? source.length : end + 2;
      continue;
    }

    if (source.startsWith("<!", lt)) {
      const end = findDoctypeEnd(source, lt);
      if (end === -1) result.malformed = true;
      const stop = end === -1 ? source.length : end;
      if (!emit({ kind: "doctype", name: "", text: source.slice(lt + 2, stop) })) break;
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const gt = findTagEnd(source, lt);
    if (gt === -1) {
      // An unterminated tag at the end of the buffer: truncated or hostile input.
      result.malformed = true;
      break;
    }
    const inner = source.slice(lt + 1, gt);
    if (inner.startsWith("/")) {
      depth -= 1;
      if (depth < 0) {
        result.malformed = true;
        depth = 0;
      }
      if (!emit({ kind: "close", name: normalizeName(inner.slice(1)) })) break;
      i = gt + 1;
      continue;
    }

    const selfClosing = inner.endsWith("/");
    const body = selfClosing ? inner.slice(0, -1) : inner;
    const name = normalizeName(body);
    const attributes = parseAttributes(body.slice(name.length));
    if (!emit({ kind: selfClosing ? "self" : "open", name, attributes })) break;
    i = gt + 1;
    if (selfClosing) continue;
    depth += 1;

    if (RAW_TEXT_ELEMENTS.has(name)) {
      const closeAt = indexOfCloseTag(source, name, i);
      const stop = closeAt === -1 ? source.length : closeAt;
      const raw = source.slice(i, stop);
      if (raw.length > 0 && !emit({ kind: "rawtext", name, text: raw })) break;
      if (closeAt === -1) {
        result.malformed = true;
        i = source.length;
        continue;
      }
      depth -= 1;
      if (!emit({ kind: "close", name })) break;
      i = closeAt + name.length + 3;
    }
  }

  if (depth > 0) result.malformed = true;
  return result;
}

/** Tag name from the start of a tag body: up to the first whitespace or slash. */
function normalizeName(body: string): string {
  let end = 0;
  while (end < body.length && !/[\s/>]/.test(body[end])) end += 1;
  return body.slice(0, end).toLowerCase();
}

/**
 * End of a tag, honouring quoted attribute values so a `>` inside an attribute
 * does not truncate the tag. That trick is how a payload survives a naive
 * "everything between angle brackets" split.
 */
function findTagEnd(source: string, from: number): number {
  let quote = "";
  for (let i = from + 1; i < source.length; i += 1) {
    const char = source[i];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return i;
  }
  return -1;
}

/** DOCTYPE may carry an internal subset in brackets, which can itself hold `>`. */
function findDoctypeEnd(source: string, from: number): number {
  let bracket = 0;
  for (let i = from + 2; i < source.length; i += 1) {
    const char = source[i];
    if (char === "[") bracket += 1;
    else if (char === "]") bracket = Math.max(0, bracket - 1);
    else if (char === ">" && bracket === 0) return i;
  }
  return -1;
}

function indexOfCloseTag(source: string, name: string, from: number): number {
  const lower = source.toLowerCase();
  const needle = `</${name}`;
  let at = lower.indexOf(needle, from);
  while (at !== -1) {
    const after = lower[at + needle.length];
    if (after === undefined || after === ">" || /\s/.test(after)) return at;
    at = lower.indexOf(needle, at + needle.length);
  }
  return -1;
}

const ATTRIBUTE_PATTERN = /([^\s=/>]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function parseAttributes(body: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  if (!body.trim()) return attributes;
  ATTRIBUTE_PATTERN.lastIndex = 0;
  let match = ATTRIBUTE_PATTERN.exec(body);
  let count = 0;
  while (match && count < 256) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    // A repeated attribute keeps its first value, matching browser behaviour.
    if (!(key in attributes)) attributes[key] = decodeXmlEntities(value);
    count += 1;
    match = ATTRIBUTE_PATTERN.exec(body);
  }
  return attributes;
}

/** All text nodes of a markup document, joined with spaces. */
export function collectMarkupText(source: string, maxLength = 200_000): string {
  const parts: string[] = [];
  let total = 0;
  tokenizeMarkup(source, (token) => {
    if (total >= maxLength) return;
    if (token.kind !== "text" && token.kind !== "cdata") return;
    const text = (token.text ?? "").trim();
    if (!text) return;
    parts.push(text);
    total += text.length;
  });
  return parts.join(" ");
}

/**
 * True when an inline style or presentation attribute set would keep text out of
 * a human's view while leaving it in the document for a model to read.
 */
export function isVisuallyHiddenStyle(style: string): boolean {
  const value = style.toLowerCase().replace(/\s+/g, "");
  if (!value) return false;
  return (
    value.includes("display:none") ||
    value.includes("visibility:hidden") ||
    value.includes("opacity:0") ||
    /font-size:0(?:[a-z%]{0,4})?(?:;|$)/.test(value) ||
    /font-size:0\.\d+(?:px|pt)/.test(value) ||
    // Pushed far off-canvas: a real layout never needs -9999px.
    /(?:left|top|right|bottom|text-indent):-\d{4,}/.test(value) ||
    value.includes("clip:rect(0,0,0,0)") ||
    /width:0(?:px|pt)?;?height:0/.test(value)
  );
}

/** True when two colours are close enough that text in one is unreadable on the other. */
export function colorsCollide(foreground: string, background: string): boolean {
  const a = parseColor(foreground);
  const b = parseColor(background);
  if (!a || !b) return false;
  const distance = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  return distance <= 24;
}

/** Hex or named colour to RGB. Returns null for anything else, e.g. a gradient. */
export function parseColor(value: string): [number, number, number] | null {
  const clean = value.trim().toLowerCase().replace(/^#/, "");
  const NAMED: Record<string, [number, number, number]> = {
    white: [255, 255, 255],
    black: [0, 0, 0],
    transparent: [255, 255, 255],
  };
  if (NAMED[clean]) return NAMED[clean];
  if (/^[0-9a-f]{6}$/.test(clean)) {
    return [
      Number.parseInt(clean.slice(0, 2), 16),
      Number.parseInt(clean.slice(2, 4), 16),
      Number.parseInt(clean.slice(4, 6), 16),
    ];
  }
  if (/^[0-9a-f]{3}$/.test(clean)) {
    return [
      Number.parseInt(clean[0] + clean[0], 16),
      Number.parseInt(clean[1] + clean[1], 16),
      Number.parseInt(clean[2] + clean[2], 16),
    ];
  }
  const rgb = clean.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * URL schemes that make a document reach outside itself when opened. `file:` and
 * `\\host\share` are included because a fetched template is how a document
 * turns into an SSRF or credential-capture primitive.
 */
export function classifyReference(target: string): "remote" | "local-file" | "script" | "data" | "internal" {
  const value = target.trim().toLowerCase();
  if (value.startsWith("javascript:") || value.startsWith("vbscript:")) return "script";
  if (value.startsWith("data:")) return "data";
  if (/^(?:https?|ftp|ftps|ws|wss|smb|ldap|gopher):\/\//.test(value)) return "remote";
  if (value.startsWith("//") || value.startsWith("\\\\")) return "remote";
  if (value.startsWith("file:") || /^[a-z]:[\\/]/.test(value)) return "local-file";
  return "internal";
}
