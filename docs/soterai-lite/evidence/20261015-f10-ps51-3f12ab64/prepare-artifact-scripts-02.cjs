"use strict";
// Preserve all first-draft files and parser evidence. Literal replacement avoids
// JavaScript String.replace interpreting PowerShell's dollar/apostrophe tokens.
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm"), assert = require("node:assert/strict");
let source = fs.readFileSync(path.join(__dirname, "prepare-artifact-scripts-01.cjs"), "utf8");
const oldReplace = "return text.replace(from, to);", oldWrite = "function write(name, text) { fs.writeFileSync(path.join(__dirname, name), text, { flag: \"wx\" }); }";
assert.ok(source.includes(oldReplace) && source.includes(oldWrite));
source = source.replace(oldReplace, () => "return text.replace(from, () => to);");
source = source.replace(oldWrite, () => `function write(name, text) {
    const target = name.replace(/-01\\.ps1$/, "-02.ps1");
    const content = text.replaceAll("run-functional-01.ps1", "run-functional-02.ps1").replaceAll("run-security-01.ps1", "run-security-02.ps1");
    fs.writeFileSync(path.join(__dirname, target), content, { flag: "wx" });
}`);
vm.runInNewContext(source, { require, __dirname, process }, { filename: "prepare-artifact-scripts-02.generated.cjs" });
