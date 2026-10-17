import assert from "node:assert/strict";
import { test } from "node:test";
const publicCommand = (action: string, args: string[] = []) => ({ kind: "PUBLIC", action, args });
const positive: Array<[string, unknown]> = [
    ["VeR", publicCommand("version")], ["cd", publicCommand("location")], ["dir", publicCommand("list", ["."])],
    ['dir "public folder"', publicCommand("list", ["public folder"])], ["dir public/雪", publicCommand("list", ["public/雪"])],
    ["echo public note", publicCommand("write", ["public note"])], ['echo "two words"', publicCommand("write", ["two words"])], ["echo", publicCommand("write", [""])],
    ['type "public folder/file.txt"', { kind: "READ", path: "public folder/file.txt" }], ["TYPE .env", { kind: "READ", path: ".env" }],
    ['find "Public needle" note.txt', { kind: "SEARCH", needle: "Public needle", path: "note.txt" }],
    ["set", { kind: "ENV" }], ["set SystemRoot", { kind: "ENV", name: "SystemRoot" }],
    ['copy "source file.txt" "safe file.txt"', { kind: "COPY", path: "source file.txt", destination: "safe file.txt" }],
    ["timeout /t 0 /nobreak", publicCommand("sleep", ["0"])], ["timeout /t 2 /nobreak", publicCommand("sleep", ["2000"])],
];
for (const [index, [input, expected]] of positive.entries()) test(`F12-P${String(index + 1).padStart(2, "0")} parsed data preserves declared cmd semantics`, async () => {
    const { parseCmdCommand } = await import("../../../core/src/CmdCommand"), result = parseCmdCommand(input);
    assert.deepEqual(result, expected); assert.ok(Object.isFrozen(result)); if (result?.kind === "PUBLIC") assert.ok(Object.isFrozen(result.args));
});
const refused: unknown[] = [undefined, {}, "", " ", "ver extra", "cd public", "dir /s", "dir ../outside", 'dir "C:\\Windows"', "type ../outside", "type x:stream", "type *.env", "type .", "type file other", "find /i word note.txt", 'find "word"', "set NAME=value", "set 0bad", "copy same same", "copy source ../outside", "copy source target /y", "echo café", "echo %PATH%", "echo !TOKEN!", "echo caret^", "ver&set", "ver|set", "ver>out", "ver<in", "(ver)", "@ver", "cmd /c type .env", "powershell -c type .env", "node -e anything", "git show HEAD:.env", 'type "a"b', "type 'a b'", 'echo "unclosed', "ver\nset", "ver\0", "\ud800", "echo " + "x".repeat(1025), "type " + "x".repeat(4097), "timeout /t 3 /nobreak", "timeout /t 01 /nobreak", "timeout /t 1", "timeout /t -1 /nobreak"];
for (const [index, input] of refused.entries()) test(`F12-N${String(index + 1).padStart(2, "0")} unsupported whole input withholds without fallback`, async () => {
    const { parseCmdCommand } = await import("../../../core/src/CmdCommand"); assert.equal(parseCmdCommand(input), undefined);
});
