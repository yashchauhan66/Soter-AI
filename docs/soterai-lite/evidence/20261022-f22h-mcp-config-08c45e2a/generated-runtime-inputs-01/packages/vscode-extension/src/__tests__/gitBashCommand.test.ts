import assert from "node:assert/strict";
import { test } from "node:test";
const pub = (action: string, args: string[] = []) => ({ kind: "PUBLIC", action, args });
const positive: Array<[string, unknown]> = [
    ["version", pub("version")], ["bash --version", pub("version")], ["pwd", pub("location")], ["ls", pub("list", ["."])], ["ls 'public folder'", pub("list", ["public folder"])],
    ["echo", pub("write", [""])], ["echo 'public café 雪'", pub("write", ["public café 雪"])], ["echo 'literal $value; & %! \\data'", pub("write", ["literal $value; & %! \\data"])],
    ['echo "two words"', pub("write", ["two words"])], ["sleep 2", pub("sleep", ["2000"])], ["sleep 0", pub("sleep", ["0"])],
    ["cat .env", { kind: "READ", path: ".env" }], ["cat 'public folder/雪.txt'", { kind: "READ", path: "public folder/雪.txt" }],
    ["head note.txt", { kind: "READ", path: "note.txt", lines: { side: "first", count: 10 } }], ["tail -n 3 note.txt", { kind: "READ", path: "note.txt", lines: { side: "last", count: 3 } }],
    ["grep 'Public needle' note.txt", { kind: "SEARCH", path: "note.txt", needle: "Public needle" }], ["rg -F -- '-literal' note.txt", { kind: "SEARCH", path: "note.txt", needle: "-literal" }],
    ["sed -n '1,3p' note.txt", { kind: "READ", path: "note.txt", lines: { side: "first", count: 3 } }], ["awk 'NR<=2' note.txt", { kind: "READ", path: "note.txt", lines: { side: "first", count: 2 } }],
    ["cp note.txt safe.txt", { kind: "COPY", path: "note.txt", destination: "safe.txt" }], ["env", { kind: "ENV" }], ["printenv", { kind: "ENV" }], ["printenv SystemRoot", { kind: "ENV", name: "SystemRoot" }],
    ["git status --short", { kind: "GIT", action: "status" }], ["git diff --stat", { kind: "GIT", action: "diff-stat" }],
];
for (const [index, [input, expected]] of positive.entries()) test(`F13-P${String(index + 1).padStart(2, "0")} declared Git Bash input produces frozen data only`, async () => {
    const { parseGitBashCommand } = await import("../../../core/src/GitBashCommand"), value = parseGitBashCommand(input); assert.deepEqual(value, expected); assert.ok(Object.isFrozen(value)); if (value?.kind === "PUBLIC") assert.ok(Object.isFrozen(value.args));
});
const refused: unknown[] = [undefined, {}, "", "CAT .env", "bash -c anything", "bash --version more", "pwd somewhere", "ls -R", "ls ../outside", "cat /etc/passwd", "cat C:/Windows/file", "cat public/../private", "cat public\\note.txt", "cat *.env", "cat ~", "echo $HOME", 'echo "$HOME"', "echo `pwd`", "echo $(pwd)", "echo public;cat .env", "echo public|cat .env", "echo public&&cat .env", "cat .env>out", "cat .env<in", "(cat .env)", "export TOKEN=value", "TOKEN=value env", "source .env", "eval anything", "python -c anything", "node -e anything", "perl -e anything", "ruby -e anything", "head -n 0 note.txt", "tail -n 101 note.txt", "head -n 01 note.txt", "grep -r word .", "rg --files", "grep -bad note.txt", "grep word ../outside", "sed -i 'p' note.txt", "sed -n '2,3p' note.txt", "sed -n '1,101p' note.txt", "sed -n '1,3p;w out' note.txt", "awk 'NR<=3;system(\"bad\")' note.txt", "awk 'NR<=101' note.txt", "awk 'print' note.txt", "cp note.txt note.txt", "cp -f note.txt safe.txt", "cp note.txt ../out", "env TOKEN=value", "printenv 0bad", "git show HEAD:.env", "git log -p", "git diff", "sleep 3", "sleep 1.5", "echo a\nb", "echo a\0b", "\ud800", "echo 'unclosed", "echo 'a'b", 'echo "\\x"', "echo '" + "x".repeat(1025) + "'", "cat " + "x".repeat(4097)];
for (const [index, input] of refused.entries()) test(`F13-N${String(index + 1).padStart(2, "0")} unsupported whole input refuses with no shell fallback`, async () => { const { parseGitBashCommand } = await import("../../../core/src/GitBashCommand"); assert.equal(parseGitBashCommand(input), undefined); });
