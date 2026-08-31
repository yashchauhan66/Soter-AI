import * as vscode from "vscode";

import { detectManagedSetting, type SettingScope } from "./managedSettings";
import type { ControlId } from "../webview/panelContent";

/**
 * GAP 3 — the extension-host half of managed-setting detection.
 *
 * The inference itself is pure (`managedSettings.ts`); this file only supplies
 * the two facts it needs from the host: the effective value `get()` returns, and
 * the visible layers `inspect()` reports. Splitting it that way is what makes
 * every branch of the inference unit-testable without a VS Code host.
 *
 * Only controls whose state lives in a *policy-pinned setting* appear here.
 * AI Safe Mode is deliberately absent: it is stored in `globalState`, not in a
 * setting, so no policy can pin it and claiming otherwise would be a false
 * "managed" badge. Live scan and strict agent-tool checks are absent for the
 * same reason — they are settings, but not ones an administrator can pin, so
 * the panel must keep offering their toggles.
 */
const PINNED_CONTROL_SETTINGS: Partial<Record<ControlId, { key: string; scope: SettingScope }>> = {
    protectedWorkspace: { key: "protectedWorkspace.enabled", scope: "machine" },
    sentinel: { key: "sentinel.enabled", scope: "machine" },
};

/**
 * Which panel controls an administrator has pinned, with the reason to show.
 * Returns an empty object on an ordinary machine, so the panel is unchanged for
 * every user who is not under central management.
 */
export function managedControlReasons(): Partial<Record<ControlId, string>> {
    const config = vscode.workspace.getConfiguration("soterai");
    const reasons: Partial<Record<ControlId, string>> = {};
    for (const [id, setting] of Object.entries(PINNED_CONTROL_SETTINGS)) {
        if (!setting) continue;
        const verdict = detectManagedSetting({
            effective: config.get(setting.key),
            inspection: config.inspect(setting.key),
            scope: setting.scope,
        });
        if (verdict.managed && verdict.reason) reasons[id as ControlId] = verdict.reason;
    }
    return reasons;
}

/**
 * True when a setting an administrator pinned would be changed by this write.
 * The Control Panel checks this before it acts: VS Code silently keeps the
 * policy value, so a toggle that appeared to work and changed nothing is worse
 * than a toggle that explains itself.
 */
export function isManagedSetting(key: string, scope: SettingScope = "machine"): boolean {
    const config = vscode.workspace.getConfiguration("soterai");
    return detectManagedSetting({
        effective: config.get(key),
        inspection: config.inspect(key),
        scope,
    }).managed;
}
