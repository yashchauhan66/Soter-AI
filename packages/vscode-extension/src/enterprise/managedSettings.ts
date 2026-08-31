/**
 * GAP 3 — telling the user that an administrator pinned a setting.
 *
 * VS Code has no API for reading a policy value. `WorkspaceConfiguration.inspect()`
 * returns `defaultValue`, `globalValue`, `workspaceValue`, `workspaceFolderValue`
 * and the language variants — and stops there. A value applied by Intune or Group
 * Policy overrides all of them and appears nowhere in that record.
 *
 * So the detection is arithmetic rather than a lookup: compute the value the
 * visible layers *would* produce, compare it with the value `get()` actually
 * returned, and if they differ, a layer this extension cannot see won. On a
 * managed device that layer is the policy.
 *
 * The honest limits of that inference, stated because they matter:
 *   - It cannot distinguish a policy from any other invisible override, so the
 *     wording it produces says "set outside this editor", never "Group Policy".
 *   - A policy that pins a setting to the value it already had is invisible.
 *     That is acceptable: the user sees the correct state and the same behaviour
 *     either way.
 *
 * PURE BY CONTRACT — no `vscode` import, so every branch is unit-testable and
 * the wording can be asserted against the panel's jargon ban.
 */

/** The subset of `inspect()` this module reads. */
export interface SettingInspection {
    defaultValue?: unknown;
    globalValue?: unknown;
    workspaceValue?: unknown;
    workspaceFolderValue?: unknown;
}

/** Manifest scopes that change which layers VS Code consults. */
export type SettingScope = "application" | "machine" | "machine-overridable" | "window" | "resource";

export interface ManagedVerdict {
    managed: boolean;
    /** Plain-language, jargon-free. Present only when `managed` is true. */
    reason?: string;
}

/** Deep structural equality for setting values (primitives, arrays, objects). */
function sameValue(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null || typeof a !== "object") return false;
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * The value the layers the extension *can* see would resolve to.
 *
 * A `machine`- or `application`-scoped setting never reads the workspace or
 * folder layer, so a value written there is not part of the expectation. Missing
 * that was the failure mode worth a test: a repo that writes a machine-scoped
 * key would otherwise make the panel claim the setting is centrally managed.
 */
export function expectedWithoutPolicy(inspection: SettingInspection, scope: SettingScope): unknown {
    const readsWorkspace = scope !== "machine" && scope !== "application";
    if (readsWorkspace && inspection.workspaceFolderValue !== undefined) return inspection.workspaceFolderValue;
    if (readsWorkspace && inspection.workspaceValue !== undefined) return inspection.workspaceValue;
    if (inspection.globalValue !== undefined) return inspection.globalValue;
    return inspection.defaultValue;
}

/**
 * Decide whether a setting's effective value came from somewhere this extension
 * cannot see. Returns `managed: false` whenever it cannot tell — an unexplained
 * disabled toggle is worse than a toggle that works.
 */
export function detectManagedSetting(input: {
    effective: unknown;
    inspection: SettingInspection | undefined;
    scope: SettingScope;
}): ManagedVerdict {
    if (!input.inspection) return { managed: false };
    const expected = expectedWithoutPolicy(input.inspection, input.scope);
    if (sameValue(expected, input.effective)) return { managed: false };
    return {
        managed: true,
        // Deliberately does not name Group Policy or Intune: the inference
        // proves an invisible override, not which mechanism produced it.
        reason: "This was set outside this editor, so it cannot be changed here. Ask whoever manages this computer.",
    };
}
