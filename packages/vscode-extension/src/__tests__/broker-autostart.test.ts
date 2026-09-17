/**
 * BROKER AUTO-START — does protection actually come up, and does the user find
 * out when it does not?
 *
 * Two failures are being tested for here, and the second is the dangerous one:
 *
 *   1. The broker never starts, so nothing is enforced. This is what the
 *      feature fixes — `activate()` built a BrokerManager and never called
 *      start(), leaving every enforcement surface dark on a fresh editor.
 *   2. The broker fails to start and NOBODY SAYS SO. A user who believes they
 *      are protected and is not is worse off than one who knows they are
 *      unprotected, because they will paste the secret. So every non-started
 *      outcome below is asserted to produce a notification naming the
 *      consequence, not just a log line.
 *
 * These run without a VS Code host, which is why the policy lives in its own
 * module with injected dependencies.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    autoStartBroker,
    isRetryable,
    RETRY_START,
    SHOW_CONTROL_PANEL,
    type AutoStartDeps,
} from "../broker/autoStart";
import { BrokerStartFailure } from "../broker/BrokerManager";

interface Recorder extends AutoStartDeps {
    starts: number;
    notices: string[];
    logs: string[];
    actions: string[];
    slept: number[];
}

function makeDeps(start: AutoStartDeps["start"], choice?: string): Recorder {
    const rec: Recorder = {
        starts: 0,
        notices: [],
        logs: [],
        actions: [],
        slept: [],
        start: async () => {
            rec.starts++;
            return start();
        },
        notify: async (message) => {
            rec.notices.push(message);
            return choice;
        },
        runAction: async (action) => {
            rec.actions.push(action);
        },
        log: (line) => {
            rec.logs.push(line);
        },
        // Time is injected so a backoff test does not actually wait.
        delay: async (ms) => {
            rec.slept.push(ms);
        },
    };
    return rec;
}

const HEALTHY = { state: "healthy" };

describe("broker auto-start: the broker actually starts", () => {
    it("starts the broker on activation — the whole point of the feature", async () => {
        const deps = makeDeps(async () => HEALTHY);
        const result = await autoStartBroker(deps, { enabled: true });

        assert.equal(result.outcome, "started");
        assert.equal(deps.starts, 1, "activate() must call start(); constructing a BrokerManager enforces nothing");
        assert.equal(deps.notices.length, 0, "a successful start must not nag");
    });

    it("does not start when the user turned auto-start off, and records that protection is advisory", async () => {
        const deps = makeDeps(async () => HEALTHY);
        const result = await autoStartBroker(deps, { enabled: false });

        assert.equal(result.outcome, "disabled");
        assert.equal(deps.starts, 0, "an opt-out that still starts the broker is not an opt-out");
        assert.match(deps.logs.join("\n"), /advisory/i, "the log must state what turning it off costs");
    });
});

describe("broker auto-start: failures are never silent", () => {
    it("retries a transient failure and succeeds — a slow first spawn is not a dead broker", async () => {
        let attempt = 0;
        const deps = makeDeps(async () => {
            if (++attempt < 3) throw new BrokerStartFailure("Local AI Broker did not become ready on 127.0.0.1", true);
            return HEALTHY;
        });

        const result = await autoStartBroker(deps, { enabled: true, attempts: 3, backoffMs: 10 });

        assert.equal(result.outcome, "started");
        assert.equal(result.attempts, 3);
        assert.deepEqual(deps.slept, [10, 20], "backoff must grow, and must not sleep after the last attempt");
        assert.equal(deps.notices.length, 0, "a recovered start must not alarm the user");
    });

    it("does NOT retry a port conflict — three identical errors only delay the truth", async () => {
        const deps = makeDeps(async () => {
            throw new BrokerStartFailure("http://127.0.0.1:47321 is already in use, so the local AI broker cannot start there.", false);
        });

        const result = await autoStartBroker(deps, { enabled: true, attempts: 3, backoffMs: 10 });

        assert.equal(result.outcome, "permanent-failure");
        assert.equal(deps.starts, 1, "retrying a permanent failure burns attempts and delays the notification");
        assert.deepEqual(deps.slept, [], "no reason to wait when another attempt cannot help");
        assert.equal(deps.notices.length, 1, "the user must be told the broker is not running");
    });

    it("tells the user enforcement is OFF when every attempt fails — not just that a start failed", async () => {
        const deps = makeDeps(async () => {
            throw new BrokerStartFailure("Local AI Broker did not become ready on 127.0.0.1", true);
        });

        const result = await autoStartBroker(deps, { enabled: true, attempts: 2, backoffMs: 1 });

        assert.equal(result.outcome, "failed");
        assert.equal(deps.starts, 2);
        assert.equal(deps.notices.length, 1);
        const notice = deps.notices[0];
        // The consequence, not just the cause: "could not start its broker"
        // reads as a startup hiccup, and a user who reads it that way will
        // carry on pasting secrets into an agent nothing is checking.
        assert.match(notice, /not enforcing|advisory/i, "the notice must name the CONSEQUENCE, not only the failure");
        assert.match(notice, /did not become ready/, "the notice must still carry the cause so it is actionable");
    });

    it("offers a way forward and runs what the user picks", async () => {
        const deps = makeDeps(async () => {
            throw new BrokerStartFailure("boom", true);
        }, RETRY_START);

        await autoStartBroker(deps, { enabled: true, attempts: 1 });
        assert.deepEqual(deps.actions, [RETRY_START], "a notification with no action leaves the user stuck");
    });

    it("stays quiet when the user dismisses the notification", async () => {
        const deps = makeDeps(async () => {
            throw new BrokerStartFailure("boom", true);
        }, undefined);

        await autoStartBroker(deps, { enabled: true, attempts: 1 });
        assert.deepEqual(deps.actions, [], "dismissing must not trigger an action");
    });

    it("treats an UNKNOWN error as retryable — an unexpected fault is the worst case to give up on", async () => {
        let attempt = 0;
        const deps = makeDeps(async () => {
            if (++attempt < 2) throw new Error("ECONNRESET");
            return HEALTHY;
        });

        const result = await autoStartBroker(deps, { enabled: true, attempts: 2, backoffMs: 1 });
        assert.equal(result.outcome, "started");
        assert.equal(isRetryable(new Error("anything")), true);
    });
});

describe("broker auto-start: lockdown is the guard working, not a fault", () => {
    it("does not alarm the user when Emergency Lockdown blocks the start", async () => {
        const deps = makeDeps(async () => {
            throw new BrokerStartFailure("Emergency Lockdown is active; broker start is blocked", false);
        });

        const result = await autoStartBroker(deps, { enabled: true });

        assert.equal(result.outcome, "lockdown");
        assert.equal(
            deps.notices.length, 0,
            "warning about lockdown trains the user to dismiss the notice that means they are UNPROTECTED",
        );
        assert.match(deps.logs.join("\n"), /Lockdown/i, "it must still be recorded, just not raised as a failure");
    });
});

describe("broker start failures carry retryability as a flag, not as prose", () => {
    it("keys retries on the typed flag so a copy edit cannot change enforcement", () => {
        // The messages below are user-facing copy pinned by other tests. If
        // retry behaviour were derived from matching them, rewording a
        // notification would silently change what the guard does.
        assert.equal(isRetryable(new BrokerStartFailure("is already in use", false)), false);
        assert.equal(isRetryable(new BrokerStartFailure("did not become ready", true)), true);
        assert.equal(new BrokerStartFailure("x", false).retryable, false);
        assert.ok(new BrokerStartFailure("x", true) instanceof Error, "it must still behave as an Error");
    });
});
