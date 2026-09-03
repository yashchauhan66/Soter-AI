/**
 * One-off design audit: find `.card` call sites that are *interactive* elements
 * (Link / a / button) but do not opt into `.card-interactive`.
 *
 * Context: `.card:hover` used to light a teal border on every card in the
 * product, including the ~140 that are not clickable. That global hover was
 * removed in favour of the existing `.card-interactive` opt-in, so any card that
 * genuinely *is* a link now needs the class added explicitly. This script lists
 * them rather than relying on a regex that cannot see multi-line JSX.
 *
 * Usage: node scripts/audit-card-affordance.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components"];
const CARD_CLASS = /\bcard\b/;

/** Recursively collect .tsx files under a directory. */
function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collect(full, out);
    } else if (entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Walk backwards from a className match to the `<Tag` that opens it.
 *
 * A simple line-based regex misses the common formatting where the tag and its
 * className sit on different lines, which is most of the multi-prop call sites.
 */
function enclosingTag(source, classNameIndex) {
  const open = source.lastIndexOf("<", classNameIndex);
  if (open === -1) return null;
  const match = /^<\s*([A-Za-z][A-Za-z0-9.]*)/.exec(source.slice(open, open + 40));
  return match ? match[1] : null;
}

const INTERACTIVE_TAGS = new Set(["Link", "a", "button"]);
const findings = [];

for (const root of ROOTS) {
  for (const file of collect(root)) {
    const source = readFileSync(file, "utf8");
    const pattern = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

    let match;
    while ((match = pattern.exec(source)) !== null) {
      const classes = match[1] ?? match[2] ?? "";
      if (!CARD_CLASS.test(classes)) continue;
      if (classes.includes("card-interactive")) continue;

      const tag = enclosingTag(source, match.index);
      if (!tag || !INTERACTIVE_TAGS.has(tag)) continue;

      findings.push({
        file: relative(process.cwd(), file).replaceAll("\\", "/"),
        line: source.slice(0, match.index).split("\n").length,
        tag,
        classes: classes.trim().slice(0, 80),
      });
    }
  }
}

if (findings.length === 0) {
  console.log("No interactive .card call sites are missing .card-interactive.");
} else {
  console.log(`${findings.length} interactive card(s) missing .card-interactive:\n`);
  for (const f of findings) {
    console.log(`${f.file}:${f.line}  <${f.tag}>  ${f.classes}`);
  }
}
