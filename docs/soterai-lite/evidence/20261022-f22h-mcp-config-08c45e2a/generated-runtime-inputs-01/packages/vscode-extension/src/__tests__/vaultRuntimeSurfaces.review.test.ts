import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { VaultDebugAdapter, type VaultRunCoordinator } from "../vault-runtime/VaultSurfaces";

// Structural no-child lifecycle fixture only: no filesystem, vault, process,
// environment override, task launch or native debug session is used here.
const DESCRIPTOR = "9027e559-bc73-4358-9d20-6ae0319d50a8";
type Message = { type: string; request_seq?: number; success?: boolean; event?: string; body?: Record<string, unknown> };
const flush = async () => { await new Promise<void>(done => setImmediate(done)); };

for (const stage of ["before-launch", "after-launch-before-configuration"] as const) {
    for (const command of ["terminate", "disconnect"] as const) {
        test(`F09-SR-${stage}-${command} acknowledges then finishes a debug session that never started a child`, async t => {
            const runs: string[] = [], stops: string[] = [], messages: Message[] = [];
            const runtime: VaultRunCoordinator = {
                async run(id) { runs.push(id); return undefined; },
                stop(id) { stops.push(id); },
            };
            const adapter = new VaultDebugAdapter(runtime, DESCRIPTOR);
            const listener = adapter.onDidSendMessage(message => messages.push(message as Message));
            t.after(() => { adapter.dispose(); listener.dispose(); }); let seq = 0;
            const send = (name: string, args?: Record<string, unknown>) => {
                const request = ++seq;
                adapter.handleMessage({ seq: request, type: "request", command: name,
                    ...(args ? { arguments: args } : {}) }); return request;
            };
            send("initialize", { clientID: "synthetic-f09-no-child" });
            if (stage === "after-launch-before-configuration") send("launch", { descriptorId: DESCRIPTOR });
            await flush(); assert.equal(runs.length, 0); assert.equal(stops.length, 0);
            assert.equal(messages.some(message => message.event === "terminated"), false);

            const stopRequest = send(command); await flush();
            const acknowledgement = messages.findIndex(message => message.type === "response" && message.request_seq === stopRequest);
            assert.ok(acknowledgement >= 0); assert.equal(messages[acknowledgement].success, true);
            for (const event of ["exited", "terminated"]) {
                const matches = messages.map((message, index) => ({ message, index })).filter(item => item.message.type === "event" && item.message.event === event);
                assert.equal(matches.length, 1, `No-child cancellation must emit exactly one ${event} event.`);
                assert.ok(matches[0].index > acknowledgement, `${event} must follow the stop response acknowledgement.`);
            }
            assert.equal(runs.length, 0); assert.equal(stops.length, 0);
            assert.equal(messages.some(message => message.event === "process" || message.event === "output"), false);

            // Replayed lifecycle requests cannot start a child or emit duplicate
            // completion after the adapter has already proven no child exists.
            send(command); const lateLaunch = send("launch", { descriptorId: DESCRIPTOR }); send("configurationDone"); await flush();
            assert.equal(messages.find(message => message.type === "response" && message.request_seq === lateLaunch)?.success, false);
            assert.equal(runs.length, 0); assert.equal(stops.length, 0);
            assert.equal(messages.filter(message => message.event === "exited").length, 1);
            assert.equal(messages.filter(message => message.event === "terminated").length, 1);
            const beforeDispose = messages.length; adapter.dispose(); send(command); await flush(); assert.equal(messages.length, beforeDispose);
        });
    }
}
