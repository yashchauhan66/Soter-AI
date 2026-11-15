import assert from "node:assert/strict";
import { test } from "node:test";
import { clineSessionSelection } from "../adapters/ClineSessionPolicy";

const selected = () => ({ planModeApiProvider: "openai", actModeApiProvider: "openai",
    planModeOpenAiModelId: "fixture-model", actModeOpenAiModelId: "fixture-model", mode: "act" });

test("Cline session selects one explicit supported provider and model in both modes", () => {
    const snapshot = clineSessionSelection(selected());
    assert.equal(snapshot?.model, "fixture-model");
    assert.match(snapshot?.fingerprint ?? "", /^[a-f0-9]{64}$/);
    for (const patch of [{ planModeApiProvider: "cline" }, { actModeApiProvider: "anthropic" },
        { planModeOpenAiModelId: "other" }, { actModeOpenAiModelId: "" }, { mode: "custom" },
        { subagentsEnabled: true }, { cloudSessionsEnabled: true }, { worktreesEnabled: true }]) {
        assert.equal(clineSessionSelection({ ...selected(), ...patch }), undefined);
    }
    assert.equal(clineSessionSelection({}), undefined);
});

test("mode and model configuration drift changes the session binding; task history does not", () => {
    const before = clineSessionSelection(selected())!.fingerprint;
    assert.notEqual(clineSessionSelection({ ...selected(), mode: "plan" })!.fingerprint, before);
    assert.notEqual(clineSessionSelection({ ...selected(), planModeOpenAiModelInfo: { supportsImages: true } })!.fingerprint, before);
    assert.notEqual(clineSessionSelection({ ...selected(), planActSeparateModelsSetting: true })!.fingerprint, before);
    assert.equal(clineSessionSelection({ ...selected(), taskHistory: [{ id: "public-task" }], lastUpdated: 42 })!.fingerprint, before);
    assert.equal(clineSessionSelection(Object.fromEntries(Object.entries(selected()).reverse()))!.fingerprint, before);
});

test("selection inspection rejects accessors and proxies without running untrusted behavior", () => {
    let reads = 0;
    assert.equal(clineSessionSelection(Object.defineProperty(selected(), "mode", { get() { reads++; return "act"; } })), undefined);
    assert.equal(clineSessionSelection(new Proxy(selected(), { ownKeys() { reads++; return []; } })), undefined);
    assert.equal(clineSessionSelection({ ...selected(), planModeOpenAiModelInfo: { toJSON() { reads++; return {}; } } }), undefined);
    assert.equal(reads, 0);
});
