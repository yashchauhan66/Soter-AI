import { createJsoncSecretPlan } from "./JsoncSecretPlan";
import type { PrivateVaultPlan } from "../firewall/VaultMigrationPlan";
export type EditorFormat = "editor-jsonc";
export const EDITOR_WORKSPACE_GLOBS = Object.freeze(["**/.[vV][sS][cC][oO][dD][eE]/{[lL][aA][uU][nN][cC][hH],[tT][aA][sS][kK][sS],[sS][eE][tT][tT][iI][nN][gG][sS]}.[jJ][sS][oO][nN]"]);
const fail = (): never => { throw Error("Editor config syntax, expression or size is unsupported; existing files are preserved."); };
export function editorFormatForPath(relative: string): EditorFormat | undefined {
    if (typeof relative !== "string" || !relative || relative.length > 2048 || /[\\:\x00-\x1f\x7f]/.test(relative) || relative.startsWith("/") || relative.split("/").some(p => !p || p === "." || p === "..")) return fail();
    return /(?:^|\/)\.vscode\/(?:launch|tasks|settings)\.json$/i.test(relative) ? "editor-jsonc" : undefined;
}

export function createEditorSecretPlan(text: string, format: EditorFormat, generation: string): PrivateVaultPlan {
    if (format !== "editor-jsonc") return fail();
    return createJsoncSecretPlan(text, generation, "editor");
}
