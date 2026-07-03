/**
 * XSS-safe serialization for JSON-LD injected via dangerouslySetInnerHTML.
 *
 * JSON.stringify does NOT escape `<`, `>`, or `&`, so a value containing
 * `</script>` would break out of the inline <script type="application/ld+json">
 * block and execute attacker-controlled markup. This helper escapes those
 * characters (plus the JS line separators U+2028/U+2029) as unicode sequences,
 * which are valid JSON and parse identically for search-engine crawlers.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
