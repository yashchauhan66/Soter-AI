/**
 * Tests for the Control Panel's plain-language content model.
 *
 * These are real runtime tests: the module is pure, so it can be imported and
 * called directly without a VS Code host. They exist because the wording is the
 * part of this feature most likely to regress silently — a caveat quietly
 * dropped, or a badge that claims more than the capability registry allows,
 * both look fine in review and are wrong in front of a user.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import * as fs from "fs";
import * as path from "path";

import {
    INTERNAL_VOCABULARY,
    panelTasks,
    plainControls,
    primaryCta,
    type PanelFacts,
} from "../webview/panelContent";
import { PROTECTION, capabilityUiBadge } from "../protection/ProtectionLevel";
import type { ProtectionStateName } from "../protection/ProtectionState";

const root = path.resolve(__dirname, "..", "..");

const OFF: PanelFacts = {
    safeMode: false,
    protectedWorkspace: false,
    liveScan: false,
    sentinel: false,
    mcpFirewall: false,
    brokerRunning: false,
    trusted: true,
};

const ALL_ON: PanelFacts = {
    safeMode: true,
    safeModeLevel: "strict",
    protectedWorkspace: true,
    liveScan: true,
    sentinel: true,
    mcpFirewall: true,
    brokerRunning: true,
    trusted: true,
};

/** Every fact combination that changes wording, so no branch goes unread. */
const VARIANTS: Array<{ name: string; facts: PanelFacts }> = [
    { name: "nothing on", facts: OFF },
    { name: "everything on", facts: ALL_ON },
    { name: "on but broker stopped", facts: { ...ALL_ON, brokerRunning: false } },
    { name: "broker running, controls off", facts: { ...OFF, brokerRunning: true } },
    { name: "untrusted workspace", facts: { ...ALL_ON, trusted: false } },
    { name: "safe mode without a level", facts: { ...ALL_ON, safeModeLevel: undefined } },
];

describe("Control Panel plain-language content", () => {
    it("every always-visible string avoids internal vocabulary", () => {
        // `detail` is deliberately exempt: that is where the precise, jargon-
        // carrying truth lives, behind a disclosure the user chooses to open.
        for (const { name, facts } of VARIANTS) {
            for (const control of plainControls(facts)) {
                for (const [field, text] of [
                    ["label", control.label],
                    ["summary", control.summary],
                ] as const) {
                    for (const pattern of INTERNAL_VOCABULARY) {
                        assert.ok(
                            !pattern.test(text),
                            `${name}: ${control.id}.${field} leaks internal vocabulary ` +
                                `(${pattern}) -> "${text}"`,
                        );
                    }
                }
            }
        }
    });

    it("task labels and hints avoid internal vocabulary too", () => {
        for (const task of panelTasks()) {
            for (const [field, text] of [["label", task.label], ["hint", task.hint]] as const) {
                for (const pattern of INTERNAL_VOCABULARY) {
                    assert.ok(
                        !pattern.test(text),
                        `${task.action}.${field} leaks internal vocabulary (${pattern}) -> "${text}"`,
                    );
                }
            }
        }
    });

    it("summaries stay short enough to read at a glance", () => {
        for (const { name, facts } of VARIANTS) {
            for (const control of plainControls(facts)) {
                assert.ok(
                    control.summary.length <= 110,
                    `${name}: ${control.id}.summary is ${control.summary.length} chars — ` +
                        `too long for the always-visible line, move detail into \`detail\``,
                );
            }
        }
    });

    it("keeps the honest caveat rather than deleting it", () => {
        // The whole point of progressive disclosure is that the caveat is
        // demoted, not removed. Each control must still say what it cannot do.
        for (const control of plainControls(ALL_ON)) {
            assert.ok(control.detail.length > 40, `${control.id} has no meaningful detail text`);
        }
        const byId = Object.fromEntries(plainControls(ALL_ON).map((c) => [c.id, c]));
        assert.match(byId.safeMode.detail, /not covered|bypass/i);
        assert.match(byId.protectedWorkspace.detail, /not intercepted/i);
        assert.match(byId.liveScan.detail, /does not block/i);
        assert.match(byId.sentinel.detail, /does not block|observes only/i);
        assert.match(byId.mcpFirewall.detail, /unenforced|detection-only/i);
    });

    it("never claims a level stronger than the capability registry allows", () => {
        const registryCap: Record<string, string | undefined> = {
            liveScan: capabilityUiBadge("live-scan")?.uiLevel,
            mcpFirewall: capabilityUiBadge("mcp-config-scan")?.uiLevel,
        };
        for (const { name, facts } of VARIANTS) {
            for (const control of plainControls(facts)) {
                const capped = registryCap[control.id];
                if (capped && control.on) {
                    assert.strictEqual(
                        control.level,
                        capped,
                        `${name}: ${control.id} must use the registry-resolved level`,
                    );
                }
                if (control.level) {
                    assert.ok(PROTECTION[control.level], `${control.id} has an unknown level`);
                }
            }
        }
    });

    it("shows no protection badge for a control that is off", () => {
        for (const control of plainControls(OFF)) {
            assert.strictEqual(control.level, undefined, `${control.id} claims a level while off`);
        }
    });

    it("only claims enforcement for Safe Mode while local checking is actually running", () => {
        const running = plainControls(ALL_ON).find((c) => c.id === "safeMode");
        const stopped = plainControls({ ...ALL_ON, brokerRunning: false }).find((c) => c.id === "safeMode");
        assert.strictEqual(running?.level, "ENFORCED");
        assert.strictEqual(
            stopped?.level,
            "MONITORED",
            "with the broker stopped nothing is blocked, so ENFORCED would be a false claim",
        );
    });
});

describe("Control Panel primary action", () => {
    const STATES: ProtectionStateName[] = [
        "DISABLED", "INITIALISING", "MONITORING_ONLY", "PARTIALLY_ENFORCED",
        "FULLY_ENFORCED", "DEGRADED", "BROKER_OFFLINE", "POLICY_UNAVAILABLE",
        "BYPASS_DETECTED", "LOCKDOWN", "ERROR",
    ];

    it("offers exactly one action for every reachable state", () => {
        for (const state of STATES) {
            for (const facts of [OFF, ALL_ON]) {
                const cta = primaryCta(state, facts);
                assert.ok(cta.action.startsWith("action:"), `${state}: malformed action`);
                assert.ok(cta.label.length > 0 && cta.hint.length > 0, `${state}: empty CTA text`);
            }
        }
    });

    it("offers a way out of lockdown", () => {
        // Regression guard: the panel used to render Enable Full Protection here,
        // which is the wrong move while locked down and left no route back.
        assert.strictEqual(primaryCta("LOCKDOWN", ALL_ON).action, "action:unlock");
        assert.strictEqual(primaryCta("LOCKDOWN", OFF).action, "action:unlock");
    });

    it("asks for setup first when nothing can be blocked yet", () => {
        assert.strictEqual(primaryCta("MONITORING_ONLY", OFF).action, "action:setupBroker");
    });

    it("does not push more setup when everything supported is already on", () => {
        const cta = primaryCta("FULLY_ENFORCED", ALL_ON);
        assert.strictEqual(cta.action, "action:openCoverage");
        assert.strictEqual(cta.tone, "calm");
    });

    it("every action it can emit is allowlisted by the provider", () => {
        // A CTA the provider drops is a dead button. The allowlist is the
        // provider's security boundary, so this reads the real source.
        const providerSrc = fs.readFileSync(
            path.join(root, "src/webview/ControlPanelViewProvider.ts"),
            "utf8",
        );
        const emitted = new Set<string>();
        for (const state of STATES) {
            for (const facts of [OFF, ALL_ON]) {
                emitted.add(primaryCta(state, facts).action);
            }
        }
        for (const task of panelTasks()) {
            emitted.add(task.action);
        }
        for (const action of emitted) {
            assert.ok(
                providerSrc.includes(`"${action}"`),
                `${action} is offered to the user but is not in the provider's ALLOWED set`,
            );
        }
    });

    it("puts the highest-value protection flows first and secondary checks behind disclosure", () => {
        const tasks = panelTasks();
        assert.deepStrictEqual(
            tasks.filter((task) => task.group === "start").map((task) => task.action),
            ["action:checkBeforeAI", "action:protectSecrets", "action:secureAI"],
        );
        assert.ok(tasks.filter((task) => task.group === "more").length >= 3);
    });

    it("task icons are real line icons, not emoji", () => {
        // Emoji render differently per OS and break the crisp line-icon look
        // of the panel; the icons are inline SVGs that follow the theme color.
        for (const task of panelTasks()) {
            assert.match(task.icon, /^<svg /, `${task.action} has no inline SVG icon`);
            assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2700}-\u{27BF}]/u.test(task.icon), `${task.action} still uses an emoji icon`);
        }
    });
});
