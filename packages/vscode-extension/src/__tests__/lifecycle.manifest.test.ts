import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repo = path.resolve(__dirname, "../../../..");
for (const name of ["vscode-extension", "soterai-lite"]) {
    test(`F32 ${name} exposes reviewed removal and a restricted machine recovery flag`, () => {
        const manifest = JSON.parse(readFileSync(path.join(repo, "packages", name, "package.json"), "utf8"));
        const flag = manifest.contributes.configuration.properties["soterai.lite.lifecycleRecovery"];
        assert(flag); assert.equal(flag.type, "boolean"); assert.equal(flag.default, true); assert.equal(flag.scope, "machine");
        assert(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.lifecycleRecovery"));
        const rows = manifest.contributes.commands.filter((row: {command:string}) => row.command === "soterai.restoreChangesBeforeRemoval");
        assert.equal(rows.length, 1); assert.equal(rows[0].title, "Restore changes before removal");
        const entry = manifest.contributes.menus.commandPalette?.find((row: {command:string}) => row.command === "soterai.restoreChangesBeforeRemoval");
        assert(!entry?.when || !entry.when.includes("advancedCommands"), "Removal recovery must remain discoverable in the normal palette.");
    });
}
