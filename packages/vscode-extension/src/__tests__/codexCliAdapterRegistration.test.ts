import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const name of ["vscode-extension", "soterai-lite"]) test("F20A-M01 " + name + " machine/restricted flag and owner commands", () => {
    const m = JSON.parse(readFileSync(resolve(__dirname, "../../..", name, "package.json"), "utf8"));
    const p = m.contributes.configuration.properties["soterai.lite.codexCliAdapter"]; assert.equal(p.type, "boolean"); assert.equal(p.default, true); assert.equal(p.scope, "machine");
    assert.ok(m.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.codexCliAdapter"));
    for (const cmd of ["configurePinnedCodexCli", "restorePinnedCodexCli", "codexCliAdapterStatus"]) assert.ok(m.contributes.commands.some((c: any) => c.command === "soterai." + cmd));
});
test("F20A-M02 activation passes the private reader without auto-native launch", () => {
    const text = readFileSync(resolve(__dirname, "../extension.ts"), "utf8"); assert.match(text, /registerCodexCliAdapter\(context, managedReader, brokerManager\)/);
});
