/**
 * Bringing the local broker up at activation.
 *
 * Why this exists: the broker is the only component in the extension that can
 * actually REFUSE anything. Everything else observes and reports. Until this
 * ran, `activate()` constructed a `BrokerManager`, registered it for disposal,
 * and never started it — so on a fresh editor every enforcement surface was
 * dark until the user happened to find a command, while the UI was already
 * built around a broker being there. A guard that has to be switched on by hand
 * is off for most of the people who installed it.
 *
 * `BrokerManager` already supervises a broker that DIES (bounded restarts with
 * backoff). What it has never had is supervision of the first start, which is
 * what this adds — plus the judgement about when starting is wrong to attempt
 * and what to tell the user when it cannot happen at all.
 *
 * The policy is deliberately separated from `vscode` so it can be tested
 * without a host: every decision below is reachable from a unit test, including
 * the failure paths, which are the ones that decide whether a user ends up
 * unprotected without knowing it.
 */

/**
 * A start failure that says whether trying again could ever help.
 *
 * Auto-start needs this to avoid two opposite mistakes: retrying a port
 * conflict or a version mismatch (which produces the identical error three
 * times and delays the notification the user actually needs), and giving up on
 * a slow first spawn (cold disk, antivirus scanning the bundle) that would have
 * succeeded a second later.
 *
 * It is a flag rather than a message match on purpose — the message strings are
 * user-facing copy and are pinned by tests, so keying retry behaviour on them
 * would make an innocuous wording edit silently change enforcement.
 *
 * It lives HERE, next to the policy that reads it, rather than in
 * `BrokerManager` which throws it: that module imports `vscode`, so anything
 * declared there is unreachable from a test without an editor host — and the
 * failure paths are exactly what has to be tested.
 */
export class BrokerStartFailure extends Error {
    constructor(message: string, readonly retryable: boolean) {
        super(message);
        this.name = "BrokerStartFailure";
    }
}

export type AutoStartOutcome =
    /** The broker is up and healthy. */
    | "started"
    /** The user turned auto-start off. */
    | "disabled"
    /** Emergency Lockdown is active — refusing to start IS the feature. */
    | "lockdown"
    /** Retrying could not have helped; the user has been told why. */
    | "permanent-failure"
    /** Every attempt failed; the user has been told protection is advisory. */
    | "failed";

export interface AutoStartResult {
    outcome: AutoStartOutcome;
    attempts: number;
    /** Redacted failure text, suitable for a log line. Never a secret. */
    error?: string;
}

/** Everything the policy touches, injected so the decisions stay testable. */
export interface AutoStartDeps {
    /** `BrokerManager.start()`. Resolves healthy, or throws. */
    start(): Promise<{ state: string }>;
    /** Tell the user protection is not running, and offer a way forward. */
    notify(message: string, ...actions: string[]): Promise<string | undefined>;
    /** Run the action the user picked from `notify`. */
    runAction(action: string): Promise<void>;
    /** Append one line to the extension's own output channel. */
    log(line: string): void;
    delay(ms: number): Promise<void>;
}

export interface AutoStartOptions {
    /** `soterai.broker.autoStart`. */
    enabled: boolean;
    /** Total attempts, including the first. */
    attempts?: number;
    /** Base backoff; doubles per attempt. */
    backoffMs?: number;
}

/** The action offered when the broker could not be started. */
export const SHOW_CONTROL_PANEL = "Open Control Panel";
export const RETRY_START = "Try Again";

const DEFAULTS = { attempts: 3, backoffMs: 750 };

/**
 * Is another attempt worth making?
 *
 * Keyed on the typed flag `BrokerManager` sets, never on the message text: the
 * messages are user-facing copy pinned by other tests, and keying retries on
 * them would let a wording change quietly alter enforcement behaviour. An error
 * from anywhere else (an unexpected throw, not a `BrokerStartFailure`) is
 * treated as retryable, because an unknown fault is exactly the case where one
 * more attempt is cheap and giving up is expensive.
 */
export function isRetryable(error: unknown): boolean {
    if (error && typeof error === "object" && "retryable" in error) {
        return Boolean((error as { retryable: unknown }).retryable);
    }
    return true;
}

function messageOf(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * Lockdown is not a failure.
 *
 * Emergency Lockdown blocking the broker is the lockdown WORKING. Reporting it
 * as an error would train the user to dismiss the one notification that means
 * their protection is genuinely absent.
 */
function isLockdown(error: unknown): boolean {
    return /Emergency Lockdown/i.test(messageOf(error));
}

/**
 * Start the broker, retry what is worth retrying, and never fail silently.
 *
 * The contract that matters is the last one. If this returns anything other
 * than `"started"`, the user has been told — in the notification and in the
 * output channel — that enforcement is not running. Ending up unprotected is
 * recoverable; ending up unprotected while believing otherwise is the failure
 * this whole product exists to prevent, and a swallowed `void start()` would
 * have produced exactly that.
 */
export async function autoStartBroker(deps: AutoStartDeps, options: AutoStartOptions): Promise<AutoStartResult> {
    if (!options.enabled) {
        deps.log("Broker auto-start is disabled (soterai.broker.autoStart). Protection is advisory until the broker is started.");
        return { outcome: "disabled", attempts: 0 };
    }

    const attempts = Math.max(1, options.attempts ?? DEFAULTS.attempts);
    const backoffMs = options.backoffMs ?? DEFAULTS.backoffMs;
    let lastError: unknown;

    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            const status = await deps.start();
            deps.log(`Local AI Broker started (${status.state}) on attempt ${attempt}.`);
            return { outcome: "started", attempts: attempt };
        } catch (error) {
            lastError = error;
            const message = messageOf(error);

            if (isLockdown(error)) {
                deps.log(`Local AI Broker not started: ${message}`);
                return { outcome: "lockdown", attempts: attempt, error: message };
            }

            if (!isRetryable(error)) {
                deps.log(`Local AI Broker cannot start: ${message}`);
                await announce(deps, message);
                return { outcome: "permanent-failure", attempts: attempt, error: message };
            }

            deps.log(`Local AI Broker start attempt ${attempt} of ${attempts} failed: ${message}`);
            // No sleep after the final attempt — it would delay the
            // notification without buying another try.
            if (attempt < attempts) await deps.delay(backoffMs * 2 ** (attempt - 1));
        }
    }

    const message = messageOf(lastError);
    await announce(deps, message);
    return { outcome: "failed", attempts, error: message };
}

/**
 * Say what is actually true: nothing is being enforced, and here is why.
 *
 * The wording names the consequence before the cause, because "SoterAI could
 * not start its local broker" alone reads as a minor startup hiccup rather than
 * as the protection being off.
 */
async function announce(deps: AutoStartDeps, reason: string): Promise<void> {
    const choice = await deps.notify(
        `SoterAI is not enforcing anything right now: the local broker did not start, so scanning is advisory only. ${reason}`,
        RETRY_START,
        SHOW_CONTROL_PANEL,
    );
    if (choice) await deps.runAction(choice);
}
