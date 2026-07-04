import { detectPatterns, type PatternRule } from "./helpers";

const rules: PatternRule[] = [
  // ── JSON structure injection ───────────────────────────────────────
  { pattern: /["']\s*:\s*["'][^"']*(?:ignore|disregard|forget|override|bypass|reveal|system prompt|hidden instructions)[^"']*["']/i, label: "JSON value injection", message: "Instruction injection detected within JSON string value.", severity: "HIGH", score: 45 },
  { pattern: /\{\s*["'](?:role|system|instruction|command|directive)["']\s*:\s*["'](?:system|admin|override|ignore)[^"']*["']/i, label: "JSON role override", message: "Structured JSON attempts to inject a role or instruction override.", severity: "HIGH", score: 45 },
  { pattern: /\{\s*(?:["'][^"']+["']\s*:\s*["'][^"']*["']\s*,?\s*){3,}["'](?:_?(?:meta|hidden|system|internal|override|admin|config))["']\s*:\s*["'][^"']*(?:ignore|bypass|reveal|exfiltrate|override|safety|unrestricted)/i, label: "Hidden JSON field injection", message: "Extra JSON field with underscore/meta name injects instructions.", severity: "HIGH", score: 45 },
  { pattern: /\\n\s*\\n\s*(?:ignore|system|admin|override|reveal|forget|bypass)/i, label: "Escaped newline injection", message: "Escaped newlines in structured data hide instruction injection.", severity: "HIGH", score: 40 },

  // ── XML/HTML structure injection ───────────────────────────────────
  { pattern: /<!\[CDATA\[[\s\S]{0,300}(?:ignore|disregard|override|bypass|reveal|system prompt|forget all|hidden instructions)[\s\S]{0,300}\]\]>/i, label: "XML CDATA injection", message: "Instruction injection hidden within XML CDATA section.", severity: "HIGH", score: 45 },
  { pattern: /<(?:metadata|annotation|comment|hidden|note|config|system)[^>]*>[\s\S]{0,300}(?:ignore|override|bypass|reveal|disregard|forget|exfiltrate|safety disabled)[\s\S]{0,300}<\//i, label: "XML metadata injection", message: "Instructions hidden in XML metadata or non-visible elements.", severity: "HIGH", score: 45 },
  { pattern: /<!--[\s\S]{0,400}(?:ignore previous|override safety|system prompt|bypass|reveal hidden|exfiltrate|admin mode|unrestricted)[\s\S]{0,200}-->/i, label: "HTML comment injection", message: "Malicious instructions hidden in HTML/XML comments.", severity: "HIGH", score: 45 },
  { pattern: /<(?:div|span|p|section)\s+(?:style\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0|font-size\s*:\s*0|height\s*:\s*0|width\s*:\s*0)[^"']*["'])[^>]*>[\s\S]{0,400}(?:ignore|override|bypass|reveal|system prompt|exfiltrate)/i, label: "Hidden HTML element injection", message: "Instructions hidden in visually concealed HTML elements.", severity: "HIGH", score: 45 },

  // ── CSV/tabular injection ──────────────────────────────────────────
  { pattern: /(?:^|[,\t|;])["']?(?:ignore previous|override instructions|system prompt|bypass safety|reveal hidden|admin mode|unrestricted mode)["']?(?:[,\t|;]|$)/im, label: "CSV cell injection", message: "Instructions injected within CSV or tabular data cells.", severity: "HIGH", score: 40 },
  { pattern: /(?:=(?:CMD|EXEC|SYSTEM|IMPORTXML|HYPERLINK|WEBSERVICE)\s*\()/i, label: "Spreadsheet formula injection", message: "Dangerous spreadsheet formula injection in data.", severity: "HIGH", score: 45 },

  // ── Markdown structure injection ───────────────────────────────────
  { pattern: /```(?:text|plaintext|raw|system|instruction|hidden)?\s*\n[\s\S]{0,400}(?:ignore|override|bypass|reveal|disregard|forget|exfiltrate|admin mode|unrestricted)[\s\S]{0,400}\n```/i, label: "Markdown code block injection", message: "Instructions hidden in markdown code blocks claiming safe content.", severity: "HIGH", score: 40 },
  { pattern: /\[(?:translate|summarize|analyze|process|read) (?:this|the following|below)\][\s\S]{0,200}(?:ignore|override|bypass|reveal|system prompt|exfiltrate|hidden instructions)/i, label: "Translate-wrapper injection", message: "Injection disguised as content to be translated or processed.", severity: "HIGH", score: 45 },

  // ── Nested template injection ──────────────────────────────────────
  { pattern: /\{\{[\s\S]{0,200}(?:ignore|override|bypass|system|admin|reveal|exfiltrate|unrestricted)[\s\S]{0,200}\}\}/i, label: "Template injection", message: "Injection within template syntax (handlebars/mustache/jinja).", severity: "HIGH", score: 45 },
  { pattern: /\$\{[\s\S]{0,200}(?:ignore|override|bypass|system|admin|reveal|exfiltrate|process\.env)[\s\S]{0,200}\}/i, label: "Template literal injection", message: "Injection within template literal or string interpolation.", severity: "HIGH", score: 45 },
  { pattern: /<%[\s\S]{0,200}(?:ignore|override|bypass|system|admin|require|process|exec)[\s\S]{0,200}%>/i, label: "Server template injection", message: "Injection within server-side template tags.", severity: "HIGH", score: 45 },

  // ── URL parameter injection ────────────────────────────────────────
  { pattern: /(?:https?:\/\/[^\s]+[?&])(?:prompt|instruction|system|command|override|query)\s*=\s*[^&\s]*(?:ignore|bypass|reveal|admin|override|unrestricted)/i, label: "URL parameter injection", message: "Instructions smuggled via URL query parameters.", severity: "HIGH", score: 40 },

  // ── MIME/Email boundary injection ──────────────────────────────────
  { pattern: /(?:Content-Type|Content-Disposition|X-[\w-]+)\s*:\s*[^\n]*(?:ignore|override|bypass|system prompt|reveal hidden|admin mode)/i, label: "MIME header injection", message: "Instructions hidden in email/MIME headers.", severity: "HIGH", score: 40 },
  { pattern: /--(?:boundary|part|section|delimiter)[\s\S]{0,200}(?:ignore|override|bypass|reveal|system prompt|hidden instructions|admin mode)/i, label: "MIME boundary injection", message: "Instructions hidden at MIME multipart boundaries.", severity: "HIGH", score: 40 },

  // ── File metadata injection ────────────────────────────────────────
  { pattern: /(?:EXIF|XMP|IPTC|PDF|metadata|properties)\s*(?::\s*|=\s*|data\s*:?\s*)[\s\S]{0,200}(?:ignore|override|bypass|system prompt|reveal|admin|exfiltrate)/i, label: "File metadata injection", message: "Instructions hidden in file metadata fields.", severity: "HIGH", score: 40 },
  { pattern: /(?:\/Title|\/Subject|\/Author|\/Keywords|\/Creator)\s*\([^)]*(?:ignore|override|bypass|reveal|system|admin|exfiltrate)[^)]*\)/i, label: "PDF metadata injection", message: "Instructions hidden in PDF document metadata.", severity: "HIGH", score: 40 },

  // ── Base64 within structures ───────────────────────────────────────
  { pattern: /["']\s*:\s*["'][A-Za-z0-9+/]{20,}={0,2}["']/i, label: "Base64 in JSON value", message: "Encoded payload hidden in JSON string value.", severity: "MEDIUM", score: 35 },
  { pattern: /(?:data|payload|content|message|instruction)\s*(?:=|:)\s*["']?[A-Za-z0-9+/]{40,}={0,2}["']?/i, label: "Encoded structured payload", message: "Large encoded payload in a named field may contain hidden instructions.", severity: "MEDIUM", score: 35 },

  // ── Multi-level nesting ────────────────────────────────────────────
  { pattern: /\{[\s\S]*\{[\s\S]*\{[\s\S]*(?:ignore|override|bypass|reveal|system|exfiltrate|admin)[\s\S]*\}[\s\S]*\}[\s\S]*\}/i, label: "Deeply nested JSON injection", message: "Instructions hidden in deeply nested JSON structures.", severity: "HIGH", score: 40 },

  // ── YAML injection ─────────────────────────────────────────────────
  { pattern: /^[\w_-]+\s*:\s*[|>]-?\s*\n\s*(?:ignore|override|bypass|reveal|system prompt|admin mode|exfiltrate|unrestricted)/im, label: "YAML multiline injection", message: "Instructions hidden in YAML multiline scalar values.", severity: "HIGH", score: 40 },
];

export function recursiveInjectionDetector(text: string) {
  return detectPatterns(text, "RECURSIVE_INJECTION", rules);
}
