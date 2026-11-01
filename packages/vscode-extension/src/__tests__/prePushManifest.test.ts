import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as path from "node:path";

const canonical = path.resolve(__dirname, "../..", "package.json");
const commands = ["installPrePushGuard", "resumePrePushGuard", "restorePrePushGuard", "prePushGuardStatus"].map(id => "soterai." + id);
test("F26b canonical contribution exposes four distinct native advanced push commands", () => {
    const manifest = JSON.parse(readFileSync(canonical, "utf8"));
    for (const command of commands) {
        const entries = manifest.contributes.commands.filter((entry: any) => entry.command === command);
        assert.equal(entries.length, 1); assert.equal(entries[0].category, "SoterAI"); assert.match(entries[0].title, /Pre-Push/);
        assert.deepEqual(manifest.contributes.menus.commandPalette.filter((entry: any) => entry.command === command), [{ command, when: "soterai.advancedCommands" }]);
    }
});
test("F26b history hook flag is independently default false restricted machine configuration", () => {
    const manifest = JSON.parse(readFileSync(canonical, "utf8")), flag = "soterai.lite.historyHooks.prePush";
    const value = manifest.contributes.configuration.properties[flag];
    assert(value); assert.equal(value.type, "boolean"); assert.equal(value.default, false); assert.equal(value.scope, "machine");
    assert.equal(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.filter((item: string) => item === flag).length, 1);
    assert.match(value.description, /reachable.*history/i); assert.match(value.description, /bypass/i); assert.match(value.description, /restore/i);
});
test("F26b canonical activation registers push commands next to existing commit registration", () => {
    const source = readFileSync(path.resolve(__dirname, "..", "extension.ts"), "utf8");
    assert.match(source, /import\s*\{\s*registerPrePushHooks\s*\}\s*from\s*"\.\/history-hooks\/prePushCommands"/);
    assert.match(source, /registerPreCommitHooks\(context\);\s*registerPrePushHooks\(context\);/);
});
