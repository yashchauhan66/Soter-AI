import { detectPatterns, type PatternRule } from "./helpers";

// Classic application-security injection syntax: SQL, XSS, shell/command, XXE,
// template injection. These target downstream systems (a database, a browser, an
// OS), NOT the model, which is why the category is weighted below
// PROMPT_INJECTION (20 vs 40). A payload like `' OR 1=1--` is weak evidence that
// the sender is attacking the *LLM*; it was previously reported as
// PROMPT_INJECTION, which both mislabelled it and over-scored it.
//
// Every rule here is deliberately narrow. A guard that fires on ordinary prose is
// worse than one that misses a payload, because the categories exist to make the
// verdict legible — and this repo has already paid for that lesson once (see the
// Hinglish benign-commerce regression suite). So each pattern requires either a
// multi-token SQL/HTML construct or a metacharacter *adjacent to* a real command;
// none of them can match on punctuation alone. Notably absent, and intentionally:
// a bare `--` / `'` / `#` terminator rule (matches any prose with a dash or an
// apostrophe) and an LDAP filter rule (matches `(cn=...)` in ordinary text).
const rules: PatternRule[] = [
  // ── SQL injection ──
  {
    // Each object name is `\w+`, not `\w`: the rule ends in `\b`, and a single
    // `\w` leaves the cursor inside the identifier (`DROP TABLE u|sers`), where
    // `\b` can never match. That silently disabled every alternative below.
    pattern:
      /\b(?:union\s+(?:all\s+)?select|select\s+.{0,60}\s+from\s+\w+|drop\s+(?:table|database|schema)\s+\w+|truncate\s+table\s+\w+|delete\s+from\s+\w+|insert\s+into\s+\w+.{0,80}\bvalues\b|grant\s+all\s+privileges|xp_cmdshell|sp_executesql)\b/i,
    label: "SQL statement syntax",
    message:
      "A complete SQL DDL/DML statement appears in the payload — classic SQL injection, not an LLM-directed instruction.",
    severity: "HIGH",
    score: 35,
  },
  {
    // The canonical tautology bypass: a quote, a boolean operator, and two
    // comparands that are trivially equal. Requires the quote AND the operator
    // AND the comparison, so `don't or 1 thing` cannot reach it.
    pattern: /['"`]\s*(?:or|and)\s+(?:['"`]?\w{1,12}['"`]?)\s*(?:=|<>|!=|\blike\b)\s*(?:['"`]?\w{1,12}['"`]?)\s*(?:--|#|\/\*|;|$)/i,
    label: "SQL boolean tautology",
    message: "A quote-escape plus an always-true comparison is the classic SQL authentication bypass.",
    severity: "HIGH",
    score: 40,
  },
  {
    // Statement-stacking: terminate the current statement, start a destructive
    // one. The second keyword is what makes this unambiguous.
    pattern: /['"`]?\s*;\s*(?:drop|delete|truncate|update|insert|grant|alter|create)\s+\w+/i,
    label: "SQL statement stacking",
    message: "A statement terminator followed by a second SQL command indicates stacked-query injection.",
    severity: "HIGH",
    score: 40,
  },

  // ── Cross-site scripting (XSS) ──
  {
    pattern: /<script\b[^>]*>[\s\S]{0,500}?<\/script\s*>/i,
    label: "HTML script tag",
    message: "A complete HTML `<script>` element in user content indicates a reflected or stored XSS payload.",
    severity: "HIGH",
    score: 35,
  },
  {
    // Requires the protocol AND a real sink. Bare `javascript:` appears in
    // ordinary technical writing ("the javascript: URL scheme").
    pattern: /javascript\s*:\s*(?:alert|prompt|confirm|eval|fetch|document\s*\.\s*(?:cookie|write|location)|window\s*\.\s*location)\s*[(=]/i,
    label: "JavaScript URI with DOM sink",
    message: "A `javascript:` URI invoking a DOM sink indicates an XSS payload.",
    severity: "HIGH",
    score: 35,
  },
  {
    // Inline event handler carrying an actual call — `onerror=alert(1)`. The
    // trailing `(` is what separates a payload from prose about event handlers.
    pattern: /\bon(?:load|error|click|mouseover|focus|toggle|animationstart)\s*=\s*['"]?\s*(?:alert|eval|fetch|prompt|confirm|document|window|this)\s*[(.]/i,
    label: "Inline event-handler payload",
    message: "An inline HTML event handler invoking script indicates an XSS payload.",
    severity: "MEDIUM",
    score: 30,
  },

  // ── Shell / command injection ──
  {
    // A shell metacharacter immediately followed by a command. The adjacency is
    // load-bearing: `cat` alone is a word, `; cat /etc/passwd` is an injection.
    pattern: /[;&|`]\s*(?:cat|curl|wget|nc|netcat|rm|dd|chmod|chown|sudo|eval|exec|system|passthru|shell_exec|proc_open|bash|sh|zsh|powershell)\s+[-\/\w$]/i,
    label: "Shell command injection",
    message: "A shell metacharacter directly followed by a system command indicates command injection.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\$\((?:\s*(?:cat|curl|wget|whoami|id|uname|nc|bash|sh)\b|\s*`)/i,
    label: "Shell command substitution",
    message: "Shell command substitution `$(...)` around a system command indicates command injection.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\|\s*(?:sh|bash|zsh|python\d?|perl|nc|netcat)\b/i,
    label: "Pipe to interpreter",
    message: "Piping output into a shell or interpreter indicates remote code execution.",
    severity: "HIGH",
    score: 40,
  },

  // ── XML external entity (XXE) ──
  {
    pattern: /<!(?:DOCTYPE|ENTITY)\b[^>]{0,200}\b(?:SYSTEM|PUBLIC)\b[^>]{0,200}>/i,
    label: "XML external entity (XXE)",
    message: "An XML entity declaration referencing an external SYSTEM/PUBLIC resource indicates XXE.",
    severity: "HIGH",
    score: 40,
  },

  // ── Server-side template injection (SSTI) ──
  {
    pattern: /\{\{[^}]{0,200}(?:__class__|__mro__|__subclasses__|__globals__|__builtins__|self\s*\.\s*_?_?class)[^}]{0,200}\}\}/i,
    label: "Python template injection (SSTI)",
    message: "A template expression reaching into Python introspection attributes indicates SSTI.",
    severity: "HIGH",
    score: 40,
  },
  {
    pattern: /\$\{[^}]{0,200}(?:java\.lang|Runtime\s*\.\s*getRuntime|ProcessBuilder|Class\s*\.\s*forName|jndi:(?:ldap|rmi|dns))[^}]{0,200}\}/i,
    label: "JVM expression injection",
    message: "A `${...}` expression reaching Java reflection, runtime, or JNDI indicates template/log injection.",
    severity: "HIGH",
    score: 45,
  },
];

export function codeInjectionDetector(text: string) {
  return detectPatterns(text, "CODE_INJECTION", rules);
}
