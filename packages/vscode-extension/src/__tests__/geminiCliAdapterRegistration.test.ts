import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
for (const name of ["vscode-extension", "soterai-lite"]) test("F20C " + name + " machine/restricted Gemini flag/upstream and advanced owner commands", () => {
    const manifest = JSON.parse(readFileSync(resolve(__dirname, "../../..", name, "package.json"), "utf8"));
    for (const setting of ["soterai.lite.geminiCliAdapter", "soterai.broker.geminiProviderUrl"]) { const property = manifest.contributes.configuration.properties[setting]; assert.equal(property.scope, "machine"); assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes(setting)); }
    assert.equal(manifest.contributes.configuration.properties["soterai.lite.geminiCliAdapter"].default, true);
    for (const name of ["configurePinnedGeminiCli", "restorePinnedGeminiCli", "geminiCliAdapterStatus"]) { const command = manifest.contributes.commands.find((value: any) => value.command === "soterai." + name); assert(command); assert.equal(command.category, "SoterAI"); assert(manifest.contributes.menus.commandPalette.some((entry: any) => entry.command === command.command && entry.when === "soterai.advancedCommands")); }
});
test("F20C activation passes private reader and owned broker without launching Gemini", () => {
    const text = readFileSync(resolve(__dirname, "../extension.ts"), "utf8"); assert.match(text, /registerGeminiCliAdapter\(context, managedReader, brokerManager\)/);
});
