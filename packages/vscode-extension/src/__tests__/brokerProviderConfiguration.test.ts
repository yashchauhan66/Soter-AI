import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import * as stub from "./phase2/vscode-stub";
import { registerBrokerCommands } from "../broker/commands";

const originalOpenAI = "https://old-provider.example.invalid/v1/chat/completions";
const originalAnthropic = "https://old-provider.example.invalid/v1/messages";
const acceptedOpenAI = "http://127.0.0.1:15432/v1/chat/completions";
const originalKey = "TEST_ONLY_EXISTING_PROVIDER_KEY";
const acceptedKey = "TEST_ONLY_ACCEPTED_PROVIDER_KEY";

async function fixture(t: any) {
    stub.resetState("D:\\synthetic-broker-provider-project");
    stub.state.config.set("soterai.broker.openAIProviderUrl", originalOpenAI);
    stub.state.config.set("soterai.broker.anthropicProviderUrl", originalAnthropic);
    const context = stub.makeExtensionContext("D:\\synthetic-broker-provider-storage");
    await context.secrets.store("soterai.providerApiKey", originalKey);
    const configuration = stub.workspace.getConfiguration("soterai"), updates: string[] = [], secretWrites: string[] = [];
    const originalUpdate = configuration.update.bind(configuration);
    t.mock.method(configuration, "update", async (key: string, value: unknown) => { updates.push(key); await originalUpdate(key, value); });
    const originalConfiguration = stub.workspace.getConfiguration.bind(stub.workspace);
    t.mock.method(stub.workspace, "getConfiguration", (section?: string) => section === "soterai" ? configuration : originalConfiguration(section));
    const originalStore = context.secrets.store.bind(context.secrets);
    t.mock.method(context.secrets, "store", async (key: string, value: string) => { secretWrites.push(key); await originalStore(key, value); });
    registerBrokerCommands(context as never, {} as never, () => undefined);
    t.after(() => { context.subscriptions.forEach(item => item.dispose()); stub.resetState(); });
    return { context, configuration, updates, secretWrites };
}

test("provider form stays pending on SDK focus loss and saves only explicitly accepted values", async t => {
    const current = await fixture(t), values = [acceptedOpenAI, "", acceptedKey];
    const observations: Array<{ pendingAfterFocusLoss: boolean; configWritesBeforeAccept: number; secretWritesBeforeAccept: number }> = [];
    let field = 0, accepted = 0, keyPassword = false;
    const completionJobs: Array<Promise<void>> = [];
    // Documented/native-observed SDK behavior: a default InputBox resolves
    // undefined on blur; ignoreFocusOut leaves it pending until Enter/Escape.
    // This is a regression model, not claimed native UI/provider evidence.
    t.mock.method(stub.window, "showInputBox", (options: { ignoreFocusOut?: boolean; password?: boolean }) => {
        const index = field++; if (index === 2) keyPassword = options.password === true;
        return new Promise<string | undefined>(resolve => {
            const job = new Promise<void>(done => setImmediate(() => {
                let pending = true;
                if (options.ignoreFocusOut !== true) { pending = false; resolve(undefined); }
                observations.push({ pendingAfterFocusLoss: pending, configWritesBeforeAccept: current.updates.length, secretWritesBeforeAccept: current.secretWrites.length });
                setImmediate(() => { if (pending) { accepted++; resolve(values[index]); } done(); });
            }));
            completionJobs.push(job);
        });
    });
    await stub.commands.executeCommand("soterai.configureAIBroker");
    await Promise.all(completionJobs);
    assert.equal(observations.length, 3);
    assert.deepEqual(observations.map(item => item.pendingAfterFocusLoss), [true, true, true]);
    assert.ok(observations.every(item => item.configWritesBeforeAccept === 0 && item.secretWritesBeforeAccept === 0));
    assert.equal(accepted, 3); assert.equal(keyPassword, true);
    assert.equal(current.configuration.get("broker.openAIProviderUrl"), acceptedOpenAI);
    assert.equal(current.configuration.get("broker.anthropicProviderUrl"), "");
    assert.equal(await current.context.secrets.get("soterai.providerApiKey"), acceptedKey);
    assert.deepEqual(current.updates, ["broker.openAIProviderUrl", "broker.anthropicProviderUrl"]);
    assert.deepEqual(current.secretWrites, ["soterai.providerApiKey"]);
});

for (const [fieldName, cancelledField] of [["OpenAI URL", 0], ["optional Anthropic URL", 1], ["provider key", 2]] as const) {
    test(`explicit cancellation at ${fieldName} ends the form without config or credential writes`, async t => {
        const current = await fixture(t), acceptedValues = [acceptedOpenAI, "", acceptedKey];
        let calls = 0;
        t.mock.method(stub.window, "showInputBox", async () => {
            const index = calls++; return index >= cancelledField ? undefined : acceptedValues[index];
        });
        await stub.commands.executeCommand("soterai.configureAIBroker");
        assert.deepEqual(current.updates, []); assert.deepEqual(current.secretWrites, []);
        assert.equal(calls, cancelledField + 1);
        assert.equal(current.configuration.get("broker.openAIProviderUrl"), originalOpenAI);
        assert.equal(current.configuration.get("broker.anthropicProviderUrl"), originalAnthropic);
        assert.equal(await current.context.secrets.get("soterai.providerApiKey"), originalKey);
    });
}

test("explicit Enter on optional blank endpoint and key retains existing key", async t => {
    const current = await fixture(t), values = [acceptedOpenAI, "", ""];
    t.mock.method(stub.window, "showInputBox", async () => values.shift());
    await stub.commands.executeCommand("soterai.configureAIBroker");
    assert.equal(current.configuration.get("broker.openAIProviderUrl"), acceptedOpenAI);
    assert.equal(current.configuration.get("broker.anthropicProviderUrl"), "");
    assert.equal(await current.context.secrets.get("soterai.providerApiKey"), originalKey);
    assert.deepEqual(current.secretWrites, []);
});
