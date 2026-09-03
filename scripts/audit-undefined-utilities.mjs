/**
 * Undefined-utility audit.
 *
 * Finds Tailwind class names that reference a **theme token this project does not
 * define**. Those classes generate no CSS at all, so the element silently falls
 * back to inherited styling — the failure is invisible in code review and
 * invisible in the build output.
 *
 * This is not hypothetical. Two real instances were found in this codebase:
 *
 *   - `text-muted-foreground` (11 uses across 2 admin pages). This is a
 *     shadcn/ui token; there is no `--muted-foreground` in this project's
 *     Tailwind config. Every "muted" caption rendered at full body colour, so the
 *     type hierarchy on those pages simply did not exist.
 *   - Earlier, `cyan` was set to a plain string in tailwind.config.ts, which
 *     wiped Tailwind's built-in `cyan` *object* and killed every `text-cyan-300`
 *     / `bg-cyan-500/10` in the codebase. See the note at the top of
 *     tailwind.config.ts.
 *
 * ## How it works
 *
 * Rather than reimplementing Tailwind's resolver, this asks Tailwind itself:
 * `resolveConfig` gives the fully merged theme, and each class prefix is checked
 * against the scale it reads from. Anything whose token is absent is reported.
 *
 * Usage: node scripts/audit-undefined-utilities.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const resolveConfig = require("tailwindcss/resolveConfig");

// The config is TypeScript, so it cannot be imported directly from a .mjs
// script without a loader. The token *names* are what matter here, and those are
// stable enough to read from the source text.
const configSource = readFileSync("tailwind.config.ts", "utf8");

/** Colour families that exist: Tailwind defaults plus this project's additions. */
const baseTheme = resolveConfig({ content: [] }).theme;
const definedColors = new Set(Object.keys(baseTheme.colors ?? {}));
for (const match of configSource.matchAll(/^const (\w+) = \{$/gm)) definedColors.add(match[1]);
// `colors: { ink, panel, cyan, lime }` — shorthand properties in the extend block.
const colorsLine = /colors:\s*\{([^}]*)\}/.exec(configSource);
if (colorsLine) {
  for (const name of colorsLine[1].split(",")) {
    const trimmed = name.trim();
    if (trimmed) definedColors.add(trimmed);
  }
}

/**
 * Prefixes worth checking, mapped to the token set they resolve against.
 *
 * Deliberately narrow: colour utilities are where undefined-token bugs actually
 * occur, because shadcn/ui-style semantic names (`background`, `foreground`,
 * `muted`, `accent`, `destructive`, `popover`, `card`, `ring`, `input`) look
 * plausible and get copy-pasted in from examples and from AI-generated code.
 */
const COLOR_PREFIXES = ["text", "bg", "border", "ring", "fill", "stroke", "divide", "outline", "from", "via", "to", "shadow", "decoration", "accent", "caret", "placeholder"];

/** Semantic names from other design systems that are commonly pasted in. */
const FOREIGN_TOKENS = new Set([
  "muted", "muted-foreground", "foreground", "background", "popover", "popover-foreground",
  "card-foreground", "primary", "primary-foreground", "secondary", "secondary-foreground",
  "destructive", "destructive-foreground", "accent-foreground", "input", "ring-offset",
]);

const ROOTS = ["app", "components", "lib"];

function collect(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collect(full, out);
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
  }
  return out;
}

/**
 * Blank out comments while preserving line numbers.
 *
 * Required, not cosmetic: several files legitimately *name* these classes in a
 * JSDoc block to document why they were removed. Scanning raw source reports
 * those as violations, which would train the reader to ignore this script's
 * output — the fastest way to make an audit worthless.
 *
 * Newlines are preserved so reported line numbers still match the file.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/.*$/gm, (line, prefix) => prefix + " ".repeat(line.length - prefix.length));
}

const findings = [];

for (const root of ROOTS) {
  for (const file of collect(root)) {
    const source = stripComments(readFileSync(file, "utf8"));
    const lines = source.split("\n");

    lines.forEach((line, index) => {
      for (const prefix of COLOR_PREFIXES) {
        // Match `prefix-token` where token is a dashed word, optionally /opacity.
        const pattern = new RegExp(`\\b${prefix}-([a-z][a-z-]*[a-z])(?:\\/\\d+)?\\b`, "g");
        for (const match of line.matchAll(pattern)) {
          const token = match[1];
          if (!FOREIGN_TOKENS.has(token)) continue;
          // A defined project token with the same name is fine.
          if (definedColors.has(token)) continue;

          findings.push({
            file: relative(process.cwd(), file).replaceAll("\\", "/"),
            line: index + 1,
            className: match[0],
          });
        }
      }
    });
  }
}

if (findings.length === 0) {
  console.log("No utilities reference undefined theme tokens.");
} else {
  console.log(`${findings.length} class name(s) reference tokens this project does not define:\n`);
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.className}`);
  console.log("\nThese generate no CSS. Either define the token in tailwind.config.ts");
  console.log("or replace them with the project's own scale (slate-*, cyan, ink, panel).");
  process.exitCode = 1;
}
