/**
 * The new discoverability surfaces, exercised in a real extension host.
 *
 * `discoverability.test.ts` reads the manifest and asserts its shape. That is
 * necessary and cheap, but it proves only that a JSON file is well formed: a
 * menu can reference a command that no longer registers, a resource menu can
 * pass a `Uri` the handler ignores, and a keybinding can be bound to a handler
 * that does nothing — and every one of those passes a manifest test.
 *
 * This suite drives each surface the way the surface itself invokes it:
 *
 *   editor/context      a real selection, then every submenu command
 *   explorer/context    an explicit `Uri` for a file that is NOT open, which is
 *                       the only case the Explorer entry exists for
 *   scm/title           Scan Git Changes in a workspace that is not a repo
 *   view/title          the toolbar commands, invoked with no arguments
 *   keybindings         Safe Paste against a clipboard holding a fake key
 *   viewsWelcome        every command link resolved against the live registry
 *
 * The workspace is the throwaway folder the runner opens, and every fixture
 * value is fake.
 *
 * Run: npm run test:host
 */

import * as assert from "assert";
import * as vscode from "vscode";

import { UiDriver } from "./realUser.host";

const EXTENSION_ID = "soterai.soterai-ide-guard";

/** A fake key, shaped like the thing the scanners exist to find. */
const FAKE_KEY = "sk-proj-1234567890abcdefghijklmnopqrstuv";

interface Driven {
    rec: UiDriver["rec"];
    shown: string;
    threw?: string;
}

/**
 * Invoke one command with a scripted UI and report what the user would see.
 *
 * Arguments are forwarded, because that is the whole point here: a resource
 * menu hands the handler a `Uri`, and a handler that ignores it fails only when
 * the argument is actually passed.
 */
async function drive(
    command: string,
    script: ConstructorParameters<typeof UiDriver>[0],
    ...args: unknown[]
): Promise<Driven> {
    const driver = new UiDriver(script);
    driver.install();
    let threw: string | undefined;
    try {
        await vscode.commands.executeCommand(command, ...args);
    } catch (error) {
        threw = error instanceof Error ? error.message : String(error);
    } finally {
        driver.restore();
    }
    return { rec: driver.rec, shown: driver.shown, threw };
}

interface MenuEntry {
    command?: string;
    submenu?: string;
    when?: string;
    group?: string;
}

export function run(): Promise<void> {
    return new Promise((resolve, reject) => {
        const failures: string[] = [];
        const passes: string[] = [];
        const notes: string[] = [];

        const check = (name: string, fn: () => void | Promise<void>) =>
            Promise.resolve()
                .then(fn)
                .then(() => {
                    passes.push(name);
                    console.log("  ok   " + name);
                })
                .catch((error: unknown) => {
                    const detail = error instanceof Error ? error.message : String(error);
                    failures.push(`${name}: ${detail}`);
                    console.log("  FAIL " + name + " -> " + detail);
                });

        void (async () => {
            const extension = vscode.extensions.getExtension(EXTENSION_ID);
            if (!extension) {
                reject(new Error(`${EXTENSION_ID} is not installed in the test host`));
                return;
            }
            await extension.activate();

            // Read the surfaces from the manifest the host actually loaded. A
            // list kept here would drift the moment a menu is added, and the new
            // entry is exactly the one nobody has exercised yet.
            const manifest = extension.packageJSON as {
                contributes: {
                    menus?: Record<string, MenuEntry[]>;
                    keybindings?: Array<{ command: string; key: string }>;
                    viewsWelcome?: Array<{ view: string; contents: string }>;
                };
            };
            const menus = manifest.contributes.menus ?? {};
            const keybindings = manifest.contributes.keybindings ?? [];
            const viewsWelcome = manifest.contributes.viewsWelcome ?? [];

            const folder = vscode.workspace.workspaceFolders?.[0];
            if (!folder) {
                reject(new Error("this suite needs a workspace folder — the runner should have opened a temp one"));
                return;
            }

            const registered = new Set(await vscode.commands.getCommands(true));

            // ── every surface points at a command this host really has ────────
            await check("every non-palette menu entry resolves to a command registered in this host", () => {
                const missing: string[] = [];
                for (const [group, entries] of Object.entries(menus)) {
                    if (group === "commandPalette") continue;
                    for (const entry of entries) {
                        if (!entry.command) continue;
                        if (!registered.has(entry.command)) missing.push(`${group} -> ${entry.command}`);
                    }
                }
                assert.deepStrictEqual(missing, [], `menu entries with no handler: ${missing.join(", ")}`);
                notes.push(
                    `menu groups exercised: ${Object.keys(menus).filter((g) => g !== "commandPalette").join(", ")}`,
                );
            });

            await check("every keybinding resolves to a command registered in this host", () => {
                for (const binding of keybindings) {
                    assert.ok(
                        registered.has(binding.command),
                        `${binding.key} is bound to ${binding.command}, which has no handler in this host`,
                    );
                }
                notes.push(`keybindings: ${keybindings.map((b) => `${b.key} -> ${b.command}`).join("; ")}`);
            });

            await check("every view-welcome link resolves to a command registered in this host", () => {
                for (const welcome of viewsWelcome) {
                    const links = [...welcome.contents.matchAll(/\(command:([\w.]+)\)/g)].map((m) => m[1]);
                    assert.ok(links.length > 0, `${welcome.view} welcome offers no command link`);
                    for (const link of links) {
                        assert.ok(
                            registered.has(link),
                            `${welcome.view} welcome links ${link}, which does not exist in this host`,
                        );
                    }
                }
            });

            // ── explorer/context: a file that is NOT open ─────────────────────
            //
            // The defect this covers: the handler read `activeTextEditor` only,
            // so right-clicking a file in the Explorer reported "open a file
            // first". A .env is normally protected without ever being opened, so
            // the menu entry existed for precisely the case that failed.
            const unopened = vscode.Uri.joinPath(folder.uri, "explorer-only.env");
            await vscode.workspace.fs.writeFile(unopened, Buffer.from(`API_KEY=${FAKE_KEY}\n`, "utf8"));

            await check("Explorer -> Add File to Protected List protects a file that was never opened", async () => {
                // Prove the precondition rather than assume it: if the file were
                // open, the fallback to the active editor would mask the bug.
                assert.ok(
                    !vscode.workspace.textDocuments.some((d) => d.uri.fsPath === unopened.fsPath),
                    "explorer-only.env is open in an editor, so this would not test the Explorer path",
                );

                const result = await drive("soterai.addFileToProtected", {}, unopened);
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                assert.deepStrictEqual(
                    result.rec.error,
                    [],
                    `right-clicking an unopened file was refused: ${result.rec.error.join(" | ")}`,
                );
                assert.ok(
                    result.rec.info.some((m) => /explorer-only\.env/.test(m)),
                    `no confirmation naming the file: ${result.rec.info.join(" | ") || "(nothing shown)"}`,
                );

                // And the list itself must contain it — the toast is not the state.
                const list = await drive("soterai.showProtectedFilesList", {});
                assert.ok(
                    /explorer-only\.env/.test(list.shown),
                    "the file was reported as protected but is absent from the protected list",
                );
                notes.push(`protected via Uri: ${result.rec.info.join(" | ")}`);
            });

            await check("Explorer -> Scan File scans the right-clicked file, not the active editor", async () => {
                const result = await drive("soterai.scanCurrentFile", {}, unopened);
                assert.strictEqual(result.threw, undefined, `command threw: ${result.threw}`);
                assert.ok(
                    /explorer-only\.env/.test(result.shown),
                    `the scan did not report the right-clicked file: ${result.shown.slice(0, 300) || "(nothing shown)"}`,
                );
                assert.deepStrictEqual(
                    result.rec.error.filter((m) => /no file open/i.test(m)),
                    [],
                    "Scan File asked the user to open a file it had already been given",
                );
            });

            // ── editor/context: a real selection ──────────────────────────────
            const selected = vscode.Uri.joinPath(folder.uri, "selection-fixture.ts");
            await vscode.workspace.fs.writeFile(
                selected,
                Buffer.from(`export const key = "${FAKE_KEY}";\n`, "utf8"),
            );
            const doc = await vscode.workspace.openTextDocument(selected);
            const editor = await vscode.window.showTextDocument(doc, { preview: false });
            editor.selection = new vscode.Selection(doc.positionAt(0), doc.positionAt(doc.getText().length));

            await check("editor/context submenu commands all act on the selection", async () => {
                const submenuIds = (menus["soterai.editorContext"] ?? [])
                    .map((entry) => entry.command)
                    .filter((id): id is string => Boolean(id));
                assert.ok(submenuIds.length > 0, "the editor submenu contributed no items");

                for (const id of submenuIds) {
                    const clipboardBefore = await vscode.env.clipboard.readText();
                    const result = await drive(id, { answerMessage: () => undefined });
                    try {
                        assert.strictEqual(result.threw, undefined, `${id} threw: ${result.threw}`);
                        assert.ok(
                            result.shown.trim().length > 0,
                            `${id} ran on a selection holding a fake API key and told the user nothing`,
                        );
                        assert.ok(
                            !result.shown.includes(FAKE_KEY),
                            `${id} echoed the raw key back into a user-visible surface`,
                        );
                        assert.deepStrictEqual(
                            result.rec.error.filter((m) => /no active|selection is empty|please select/i.test(m)),
                            [],
                            `${id} reported no selection while a full-document selection was active`,
                        );
                        notes.push(
                            `${id}: ${[...result.rec.info, ...result.rec.warn, ...result.rec.error][0] ?? "(webview)"}`,
                        );
                    } finally {
                        await vscode.env.clipboard.writeText(clipboardBefore);
                    }
                }
            });

            // ── keybinding: Safe Paste at the moment of risk ──────────────────
            await check("Ctrl+Alt+V Safe Paste replaces a risky clipboard instead of inserting it", async () => {
                const clipboardBefore = await vscode.env.clipboard.readText();
                const target = vscode.Uri.joinPath(folder.uri, "safe-paste-target.ts");
                await vscode.workspace.fs.writeFile(target, Buffer.from("// paste here\n", "utf8"));
                const targetDoc = await vscode.workspace.openTextDocument(target);
                const targetEditor = await vscode.window.showTextDocument(targetDoc, { preview: false });
                targetEditor.selection = new vscode.Selection(
                    targetDoc.positionAt(0),
                    targetDoc.positionAt(targetDoc.getText().length),
                );
                try {
                    await vscode.env.clipboard.writeText(`const key = "${FAKE_KEY}";`);
                    const result = await drive("soterai.safePaste", {
                        answerMessage: (_text, items) => items.find((i) => /redacted/i.test(i)),
                    });
                    assert.strictEqual(result.threw, undefined, `Safe Paste threw: ${result.threw}`);
                    assert.ok(
                        result.rec.modal.length > 0,
                        `Safe Paste inserted a fake key with no confirmation (shown: ${result.shown.slice(0, 200)})`,
                    );
                    assert.ok(
                        !targetDoc.getText().includes(FAKE_KEY),
                        "the user chose the redacted paste and the raw key landed in the document anyway",
                    );
                    notes.push(`safe paste modal: ${result.rec.modal[0]}`);
                } finally {
                    await vscode.env.clipboard.writeText(clipboardBefore);
                }
            });

            // ── scm/title and view/title: invoked with no arguments ───────────
            await check("scm/title Scan Git Changes fails honestly outside a repository", async () => {
                const scmCommands = Object.entries(menus)
                    .filter(([group]) => group.startsWith("scm/"))
                    .flatMap(([, entries]) => entries.map((e) => e.command))
                    .filter((id): id is string => Boolean(id));
                assert.ok(scmCommands.length > 0, "no scm/* command was contributed");

                for (const id of scmCommands) {
                    const result = await drive(id, { answerMessage: () => undefined });
                    assert.strictEqual(result.threw, undefined, `${id} threw: ${result.threw}`);
                    // The temp workspace is not a git repository, so the honest
                    // outcome is a message naming that — never silence, and never
                    // an unhandled rejection the user reads as "command failed".
                    assert.ok(
                        result.shown.trim().length > 0,
                        `${id} produced no output at all in a non-repository workspace`,
                    );
                    notes.push(
                        `${id} outside a repo: ${[...result.rec.error, ...result.rec.info, ...result.rec.warn][0]}`,
                    );
                }
            });

            await check("view/title toolbar commands run with no arguments", async () => {
                for (const entry of menus["view/title"] ?? []) {
                    if (!entry.command) continue;
                    // Scanning the whole workspace is covered by realUser.host and
                    // would re-walk the temp folder for no new information.
                    if (entry.command === "soterai.scanWorkspaceRisk") continue;
                    const result = await drive(entry.command, {
                        answerMessage: () => undefined,
                        pickBy: () => undefined,
                    });
                    assert.strictEqual(result.threw, undefined, `${entry.command} threw: ${result.threw}`);
                }
            });

            console.log(`\n${passes.length} passed, ${failures.length} failed`);
            for (const note of notes) console.log("  note: " + note);
            if (failures.length > 0) {
                reject(new Error(`${failures.length} discoverability host test(s) failed:\n  ` + failures.join("\n  ")));
            } else {
                resolve();
            }
        })().catch(reject);
    });
}
