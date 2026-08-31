/**
 * GAP 3 — an administrator must be able to *require* a guard, not merely hope
 * a developer leaves it on.
 *
 * Before this, 25 settings were `machine`-scoped and declared restricted in
 * untrusted workspaces. That stops a hostile repository from weakening a guard,
 * and it is the wrong tool for the enterprise question: machine scope still
 * lets the person at the keyboard turn protection off. A security tool a CISO
 * cannot mandate is a personal utility.
 *
 * Three separate contracts are asserted here, because they fail independently:
 *
 *   1. every safety-critical setting declares a `policy` block, so a managed
 *      device can pin it;
 *   2. the extension can *tell* it has been pinned, without a VS Code API for
 *      reading a policy value — `inspect()` exposes default/global/workspace and
 *      nothing else, so a value the extension cannot account for is the signal;
 *   3. telemetry is inert when the user's own VS Code telemetry preference is
 *      off. The old TelemetryManager never consulted it, which is a real
 *      compliance finding rather than a preference mismatch.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { detectManagedSetting, expectedWithoutPolicy } from "../enterprise/managedSettings";
import { shouldRetainQueuedTelemetry, shouldSend, telemetryHoldReason } from "../enterprise/telemetryGate";
import { plainControls, INTERNAL_VOCABULARY, type PanelFacts } from "../webview/panelContent";

const extensionRoot = join(__dirname, "..", "..");
const manifest = JSON.parse(readFileSync(join(extensionRoot, "package.json"), "utf8"));
const properties = manifest.contributes.configuration.properties as Record<
    string,
    { type?: string; scope?: string; policy?: { name?: string; minimumVersion?: string } }
>;

/**
 * The settings an administrator must be able to pin. Every one of them either
 * turns a guard off or changes where data goes; nothing else belongs here,
 * because a policy an admin cannot justify is a policy they will not deploy.
 */
const MUST_BE_POLICY_PINNABLE = [
    "soterai.protection.enabled",
    "soterai.privacyMode",
    "soterai.cloud.enabled",
    "soterai.sentinel.enabled",
    "soterai.protectedWorkspace.enabled",
    "soterai.terminal.protectionMode",
    "soterai.secretInterceptor.enabled",
    "soterai.autoVaultMigration.enabled",
];

describe("enterprise policy pinning", () => {
    for (const key of MUST_BE_POLICY_PINNABLE) {
        it(`${key} declares a policy an administrator can pin`, () => {
            const property = properties[key];
            assert.ok(property, `${key} is missing from the manifest`);
            assert.ok(
                property.policy,
                `${key} has no policy block — machine scope stops a repo weakening it but does not let an admin require it`,
            );
            assert.ok(property.policy?.name, `${key} declares a policy with no name`);
            assert.match(
                String(property.policy?.minimumVersion),
                /^\d+\.\d+$/,
                `${key} policy minimumVersion must be "<major>.<minor>"`,
            );
        });
    }

    it("keeps every policy name unique, because one name can own only one setting", () => {
        const named = Object.entries(properties)
            .filter(([, property]) => property.policy?.name)
            .map(([, property]) => property.policy!.name!);
        const duplicates = named.filter((name, index) => named.indexOf(name) !== index);
        assert.deepEqual(duplicates, [], `duplicate policy name(s): ${duplicates.join(", ")}`);
    });

    it("pins only settings that are also machine-scoped and restricted", () => {
        const restricted: string[] = manifest.capabilities?.untrustedWorkspaces?.restrictedConfigurations ?? [];
        for (const [key, property] of Object.entries(properties)) {
            if (!property.policy) continue;
            assert.equal(property.scope, "machine", `${key} is policy-pinned but not machine-scoped`);
            assert.ok(restricted.includes(key), `${key} is policy-pinned but not restricted in untrusted workspaces`);
        }
    });

    it("pins only value shapes a policy can carry", () => {
        // VS Code maps a policy value to string, number or boolean. An array or
        // object setting silently gets no policy definition, so declaring one
        // would advertise a control that does not exist.
        for (const [key, property] of Object.entries(properties)) {
            if (!property.policy) continue;
            assert.ok(
                ["boolean", "string", "number"].includes(String(property.type)),
                `${key} is type ${property.type}; a policy cannot carry that`,
            );
        }
    });
});

describe("detecting a setting an administrator pinned", () => {
    // VS Code exposes no API for reading a policy value: `inspect()` returns
    // default/global/workspace/folder and stops. So the test is arithmetic —
    // if the effective value is not the one those visible layers produce, some
    // layer the extension cannot see won, and on a managed device that is the
    // policy.
    it("reports not-managed when the effective value is the default", () => {
        const verdict = detectManagedSetting({
            effective: true,
            inspection: { defaultValue: true },
            scope: "machine",
        });
        assert.equal(verdict.managed, false);
    });

    it("reports not-managed when the user's own global value wins", () => {
        const verdict = detectManagedSetting({
            effective: false,
            inspection: { defaultValue: true, globalValue: false },
            scope: "machine",
        });
        assert.equal(verdict.managed, false);
    });

    it("ignores a workspace value for a machine-scoped setting", () => {
        // A machine-scoped setting never reads the workspace layer. If a repo
        // wrote one, the effective value still comes from global/default, and
        // treating the mismatch as a policy would show a false "managed" badge.
        const verdict = detectManagedSetting({
            effective: true,
            inspection: { defaultValue: true, workspaceValue: false },
            scope: "machine",
        });
        assert.equal(verdict.managed, false);
        assert.equal(expectedWithoutPolicy({ defaultValue: true, workspaceValue: false }, "machine"), true);
    });

    it("reports managed when no visible layer explains the effective value", () => {
        const verdict = detectManagedSetting({
            effective: false,
            inspection: { defaultValue: true },
            scope: "machine",
        });
        assert.equal(verdict.managed, true);
        assert.ok(verdict.reason && verdict.reason.length > 0, "a managed setting must carry a plain reason");
    });

    it("compares values structurally, so an equal array is not a phantom policy", () => {
        const verdict = detectManagedSetting({
            effective: ["a", "b"],
            inspection: { defaultValue: ["a", "b"] },
            scope: "window",
        });
        assert.equal(verdict.managed, false);
    });

    it("says nothing when the setting was never inspected", () => {
        // `inspect()` returns undefined for an unknown key. Guessing "managed"
        // there would disable a toggle for a setting that simply is not there.
        const verdict = detectManagedSetting({ effective: true, inspection: undefined, scope: "machine" });
        assert.equal(verdict.managed, false);
    });
});

describe("the Control Panel shows a pinned guard as managed", () => {
    const facts: PanelFacts = {
        safeMode: false,
        protectedWorkspace: false,
        liveScan: true,
        sentinel: false,
        mcpFirewall: false,
        brokerRunning: false,
        trusted: true,
        managedReasons: { sentinel: "Your organisation set this. It cannot be changed here." },
    };

    it("marks the pinned control as managed and leaves the others alone", () => {
        const controls = plainControls(facts);
        const sentinel = controls.find((control) => control.id === "sentinel");
        assert.ok(sentinel?.managed, "a pinned control must be flagged so the panel can disable its toggle");
        assert.ok(sentinel?.managedReason, "a disabled toggle with no reason reads as a bug");
        for (const control of controls) {
            if (control.id === "sentinel") continue;
            assert.ok(!control.managed, `${control.id} was flagged managed without a policy`);
        }
    });

    it("keeps the managed reason free of internal vocabulary", () => {
        const sentinel = plainControls(facts).find((control) => control.id === "sentinel")!;
        for (const pattern of INTERNAL_VOCABULARY) {
            assert.ok(
                !pattern.test(sentinel.managedReason!),
                `managed reason leaks internal vocabulary (${pattern}) -> "${sentinel.managedReason}"`,
            );
        }
    });
});

describe("telemetry honours the editor's own preference", () => {
    const base = {
        level: "batched",
        privacyMode: "cloud",
        cloudEnabled: true,
        trusted: true,
        hostTelemetryEnabled: true,
        offline: false,
    };

    it("sends nothing when the host's telemetry is disabled", () => {
        // The real finding: the old manager read only its own setting, so a user
        // who turned VS Code telemetry off globally was still queued for upload.
        assert.equal(shouldSend({ ...base, hostTelemetryEnabled: false }), false);
        assert.match(String(telemetryHoldReason({ ...base, hostTelemetryEnabled: false })), /editor/i);
    });

    it("sends nothing in local privacy mode, untrusted workspaces, or with cloud off", () => {
        assert.equal(shouldSend({ ...base, privacyMode: "local" }), false);
        assert.equal(shouldSend({ ...base, trusted: false }), false);
        assert.equal(shouldSend({ ...base, cloudEnabled: false }), false);
    });

    it("sends nothing when the user's own level is off", () => {
        assert.equal(shouldSend({ ...base, level: "off" }), false);
    });

    it("permits a send only when every gate agrees", () => {
        assert.equal(shouldSend(base), true);
        assert.equal(telemetryHoldReason(base), undefined);
    });

    it("purges queued metadata when collection is disabled or privacy returns local", () => {
        assert.equal(shouldRetainQueuedTelemetry({ ...base, level: "off" }), false);
        assert.equal(shouldRetainQueuedTelemetry({ ...base, privacyMode: "local" }), false);
        assert.equal(shouldRetainQueuedTelemetry({ ...base, cloudEnabled: false }), false);
        assert.equal(shouldRetainQueuedTelemetry({ ...base, hostTelemetryEnabled: false }), false);
        assert.equal(shouldRetainQueuedTelemetry(base), true);
    });
});

describe("telemetry source contracts", () => {
    const telemetrySrc = readFileSync(join(extensionRoot, "src", "telemetry.ts"), "utf8");

    it("routes through the editor's telemetry logger instead of a hand-rolled queue", () => {
        assert.match(telemetrySrc, /createTelemetryLogger/);
        assert.match(telemetrySrc, /isTelemetryEnabled/);
    });

    it("does not silently claim a batch was delivered", () => {
        // `sendEventsToCloud()` returned true without sending, so the queue was
        // trimmed as if delivered. Whatever the transport is, it must not report
        // success it did not have.
        assert.doesNotMatch(
            telemetrySrc,
            /Network telemetry is intentionally disabled[\s\S]{0,200}return true;/,
            "a no-op sender must not report success",
        );
    });

    it("purges pending metadata when privacy-related configuration changes", () => {
        assert.match(telemetrySrc, /syncPrivacyBoundary/);
        assert.match(telemetrySrc, /trackDetection[\s\S]{0,800}shouldRetainQueuedTelemetry/);
        const extensionSrc = readFileSync(join(extensionRoot, "src", "extension.ts"), "utf8");
        assert.match(extensionSrc, /onDidChangeConfiguration/);
        assert.match(extensionSrc, /syncPrivacyBoundary/);
    });
});
