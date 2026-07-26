/**
 * Minimal, injection-safe CSV serialization for redacted admin exports.
 *
 * - Every field is quoted and internal quotes are doubled (RFC 4180).
 * - Leading =, +, -, @ are prefixed with a single quote to neutralise
 *   spreadsheet formula injection (CSV injection / CWE-1236).
 * - Maximum row limit prevents unbounded memory allocation from large datasets.
 */

/** Maximum number of rows to serialize in a single CSV export. */
const MAX_CSV_ROWS = 100_000;
/** Maximum total CSV output bytes. */
const MAX_CSV_BYTES = 50 * 1024 * 1024;

export function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  if (rows.length > MAX_CSV_ROWS) {
    throw new Error(`CSV export limited to ${MAX_CSV_ROWS.toLocaleString()} rows.`);
  }
  const lines = [headers.map(csvCell).join(",")];
  let totalBytes = 0;
  for (const row of rows) {
    const line = row.map(csvCell).join(",");
    totalBytes += Buffer.byteLength(line, "utf8") + 2; // +2 for \r\n
    if (totalBytes > MAX_CSV_BYTES) {
      throw new Error(`CSV export exceeds the ${(MAX_CSV_BYTES / 1024 / 1024).toFixed(0)} MB limit.`);
    }
    lines.push(line);
  }
  return lines.join("\r\n");
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(" | ") : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
