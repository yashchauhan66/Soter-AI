// Removes the build output before `tsc` writes into it.
//
// Without this, a rename in `nodes/` publishes both names: the old compiled file
// is already on disk (or in a fresh checkout, if `dist/` is tracked), `tsc` only
// ever adds and overwrites, and `files: ["dist"]` packs whatever it finds. That
// is exactly how 0.6.1 shipped `SoterGuardV1.node.js` beside the
// `SoterGuardV1.js` that replaced it — the published artifact stopped matching
// the source commit its provenance attests to.
//
// A script rather than an inline `node -e` in package.json: the nested quoting
// an inline version needs is parsed differently by sh and cmd, so it would work
// on CI and break for a contributor on Windows.
const fs = require("fs");
const path = require("path");

const dist = path.join(__dirname, "..", "dist");
fs.rmSync(dist, { recursive: true, force: true });
console.log("cleaned " + path.relative(process.cwd(), dist));
