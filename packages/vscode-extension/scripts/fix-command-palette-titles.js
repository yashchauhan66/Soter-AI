/**
 * Palette hygiene: 47 of 158 commands carried BOTH `category: "SoterAI"` and a
 * title starting with "SoterAI:", so VS Code rendered them as
 * "SoterAI: SoterAI: Open Control Panel" in the Command Palette.
 *
 * VS Code's contract is that `category` is the prefix and `title` is the bare
 * action. The fix is therefore uniform: every command gets `category: "SoterAI"`
 * and a title with the redundant prefix stripped. The palette string a user
 * sees ("SoterAI: Open Control Panel") is unchanged for the 111 commands that
 * were already correct, and de-duplicated for the 47 that were not.
 */
const fs = require("fs");
const path = require("path");

const manifestPath = path.join(__dirname, "..", "package.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const before = manifest.contributes.commands.map((c) => ({
    command: c.command,
    palette: `${c.category ? c.category + ": " : ""}${c.title}`,
}));

let stripped = 0;
let categorized = 0;
for (const c of manifest.contributes.commands) {
    const bare = c.title.replace(/^SoterAI:\s*/i, "");
    if (bare !== c.title) {
        c.title = bare;
        stripped++;
    }
    if (c.category !== "SoterAI") {
        c.category = "SoterAI";
        categorized++;
    }
}

// Every command must still resolve to exactly one palette entry, and the
// user-visible string must only ever LOSE a duplicated prefix, never change
// meaning. Refuse to write if that does not hold.
const problems = [];
for (const c of manifest.contributes.commands) {
    const wasIt = before.find((b) => b.command === c.command);
    const now = `${c.category}: ${c.title}`;
    const expected = wasIt.palette.replace(/^SoterAI:\s*SoterAI:\s*/i, "SoterAI: ");
    if (now !== expected) problems.push(`${c.command}\n     was: ${wasIt.palette}\n     now: ${now}\n     expected: ${expected}`);
    if (/^SoterAI:/i.test(c.title)) problems.push(`${c.command}: title still prefixed`);
}
if (problems.length) {
    console.error("Refusing to write — palette strings would change unexpectedly:");
    for (const p of problems) console.error("  " + p);
    process.exit(1);
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 4) + "\n", "utf8");
console.log(`titles de-prefixed: ${stripped}`);
console.log(`categories set: ${categorized}`);
console.log(`total commands: ${manifest.contributes.commands.length}`);
console.log(`sample: "${manifest.contributes.commands[0].category}: ${manifest.contributes.commands[0].title}"`);
