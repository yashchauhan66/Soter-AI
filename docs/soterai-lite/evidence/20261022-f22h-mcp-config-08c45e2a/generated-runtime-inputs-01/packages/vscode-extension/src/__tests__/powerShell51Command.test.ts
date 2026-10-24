import assert from "node:assert/strict";
import { test } from "node:test";

// Frozen F10 parser-only fixtures. No FS/VS Code/process/environment access;
// expected plans describe the cooperative dispatcher, not native-shell vetoes.
type Command = { kind: "PUBLIC"; action: "location" | "version" | "date" | "write" | "list" | "sleep"; args: readonly string[] }
    | { kind: "READ"; path: string; lines?: Readonly<{ side: "first" | "last"; count: number }> }
    | { kind: "SEARCH"; path: string; needle: string }
    | { kind: "COPY"; path: string; destination: string }
    | { kind: "ENV"; name?: string }
    | { kind: "GIT"; action: "status" | "diff-stat" };
type Parser = (input: unknown) => Command | undefined;
async function implementation() {
    // Root captures meaningful per-case missing-module baselines before source.
    const module = await import("../../../core/src/PowerShell51Command");
    assert.equal(typeof module.parsePowerShell51Command, "function"); return module;
}
function frozen(value: unknown): void {
    if (!value || typeof value !== "object") return;
    assert.ok(Object.isFrozen(value)); for (const nested of Object.values(value)) frozen(nested);
}
function accepts(parse: Parser, input: string, expected: Command): Command {
    const result = parse(input); assert.deepEqual(result, expected); frozen(result); return result!;
}
function refuses(parse: Parser, input: unknown): void {
    let result: Command | undefined; assert.doesNotThrow(() => { result = parse(input); }); assert.equal(result!, undefined);
}

test("F10-P01 exported inclusive grammar/runtime limits remain exact and frozen", async () => {
    const { PS51_LIMITS } = await implementation(); assert.ok(Object.isFrozen(PS51_LIMITS));
    assert.deepEqual(PS51_LIMITS, { maxCommandBytes: 4096, maxTokens: 32, maxTokenBytes: 1024, maxSearchBytes: 256,
        maxLines: 100, maxSleepMs: 2000, maxListEntries: 256, maxWorkers: 2, maxRuntimeMs: 30000, stopGraceMs: 1000, maxRequestBytes: 16384 });
});

test("F10-P02 exact location/version/date forms accept case-insensitive command names and whitespace", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Get-Location", "pwd", "  pWd   "]) accepts(parse, name, { kind: "PUBLIC", action: "location", args: [] });
    for (const name of ["version", "$PSVersionTable.PSVersion", "$psversiontable.psversion"])
        accepts(parse, name, { kind: "PUBLIC", action: "version", args: [] });
    accepts(parse, "gEt-DaTe", { kind: "PUBLIC", action: "date", args: [] });
});

test("F10-P03 directory aliases default to dot and preserve a literal relative directory", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Get-ChildItem", "ls", "DIR"]) {
        accepts(parse, name, { kind: "PUBLIC", action: "list", args: ["."] });
        accepts(parse, name + " .", { kind: "PUBLIC", action: "list", args: ["."] });
        accepts(parse, name + " 'Src É🔐/Public Folder'", { kind: "PUBLIC", action: "list", args: ["Src É🔐/Public Folder"] });
    }
});

test("F10-P04 write aliases preserve empty/quoted literal operands without inventing shell evaluation", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Write-Output", "EcHo"]) {
        accepts(parse, name, { kind: "PUBLIC", action: "write", args: [] });
        accepts(parse, name + " Public '' \"two words\"", { kind: "PUBLIC", action: "write", args: ["Public", "", "two words"] });
    }
});

test("F10-P05 punctuation inside a complete quoted token is literal data", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const literal = "a;|&><(){}@$name $(data) [*]?";
    accepts(parse, "echo '" + literal + "'", { kind: "PUBLIC", action: "write", args: [literal] });
    accepts(parse, 'echo "a;|&><(){}@"', { kind: "PUBLIC", action: "write", args: ["a;|&><(){}@"] });
    accepts(parse, "rg 'a.*[x](b)|c$' public.txt", { kind: "SEARCH", path: "public.txt", needle: "a.*[x](b)|c$" });
});

test("F10-P06 doubled single quotes decode once while exact Unicode/case remain unchanged", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    accepts(parse, "echo 'It''s É🔐 Cafe\u0301'", { kind: "PUBLIC", action: "write", args: ["It's É🔐 Cafe\u0301"] });
    accepts(parse, "Get-Content 'Src/Owner''s File.txt'", { kind: "READ", path: "Src/Owner's File.txt" });
    accepts(parse, 'Get-Content "Src/Case É🔐.txt"', { kind: "READ", path: "Src/Case É🔐.txt" });
});

test("F10-P07 content aliases and the exact path options produce only approved-reader plans", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Get-Content", "cat", "TYPE", "gC"]) for (const option of ["", "-LiteralPath ", "-pAtH "])
        accepts(parse, name + " " + option + "'Src\\Public File.txt'", { kind: "READ", path: "Src\\Public File.txt" });
    accepts(parse, "cat file..txt", { kind: "READ", path: "file..txt" });
});

test("F10-P08 head and tail use frozen safe-view line transforms with default ten", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const [name, side] of [["head", "first"], ["TAIL", "last"]] as const) {
        accepts(parse, name + " public.txt", { kind: "READ", path: "public.txt", lines: { side, count: 10 } });
        accepts(parse, name + " -N 1 'Public File.txt'", { kind: "READ", path: "Public File.txt", lines: { side, count: 1 } });
        accepts(parse, name + " -n 100 public.txt", { kind: "READ", path: "public.txt", lines: { side, count: 100 } });
    }
});

test("F10-P09 search aliases produce literal substring plans and only declared flag forms", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Select-String", "sls", "GREP", "rg"])
        accepts(parse, name + " 'Public Needle É🔐' Src/public.txt", { kind: "SEARCH", path: "Src/public.txt", needle: "Public Needle É🔐" });
    for (const name of ["Select-String", "SLS"])
        accepts(parse, name + " -sImPlEmAtCh -pAtTeRn 'a.*b' -lItErAlPaTh public.txt", { kind: "SEARCH", path: "public.txt", needle: "a.*b" });
});

test("F10-P10 copy aliases retain the source and new destination without raw Copy-Item semantics", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Copy-Item", "copy", "CP"]) {
        accepts(parse, name + " 'Src/Public File.txt' 'New Folder/Review.txt'", { kind: "COPY", path: "Src/Public File.txt", destination: "New Folder/Review.txt" });
        accepts(parse, name + " -lItErAlPaTh source.txt -dEsTiNaTiOn new.txt", { kind: "COPY", path: "source.txt", destination: "new.txt" });
    }
});

test("F10-P11 declared env forms preserve only a requested name, never a value expansion or assignment", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["env", "SET", "printenv", "Get-ChildItem Env:", "ls eNv:", "dir ENV:"]) accepts(parse, input, { kind: "ENV" });
    for (const input of ["printenv Db_URL", "$env:Db_URL", "$ENV:Db_URL", "Get-Item eNv:Db_URL"])
        accepts(parse, input, { kind: "ENV", name: "Db_URL" });
    accepts(parse, "printenv PATH", { kind: "ENV", name: "PATH" });
});

test("F10-P12 Git forms are only fixed status and diff-stat metadata operations", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["git status", "GIT STATUS --SHORT"]) accepts(parse, input, { kind: "GIT", action: "status" });
    accepts(parse, "git diff --stat", { kind: "GIT", action: "diff-stat" });
});

test("F10-P13 fixed forms reject extra tokens rather than execute a supported prefix", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["pwd extra", "Get-Date extra", "version extra", "$PSVersionTable.PSVersion extra", "ls one two",
        "cat one.txt two.txt", "head -n 2 one.txt two.txt", "rg needle one.txt two.txt", "cp one.txt new.txt extra", "env NAME", "set NAME=value",
        "printenv NAME EXTRA", "Get-Item Env:NAME extra", "git status --short extra", "git diff --stat extra"])
        refuses(parse, input);
});

test("F10-P14 unknown commands, options and unimplemented parameter orderings refuse atomically", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["Get-Process", "Get-Content -Raw public.txt", "cat -Encoding UTF8 public.txt", "ls -Recurse", "dir -Force",
        "head -n2 public.txt", "tail --lines 2 public.txt", "rg -n needle public.txt", "grep --regex needle public.txt",
        "sls -Pattern needle -SimpleMatch -LiteralPath public.txt", "Select-String -SimpleMatch -Pattern needle -Path public.txt",
        "copy -Force source.txt new.txt", "cp -Path source.txt -Destination new.txt", "sleep 1", "sleep -Seconds 1"])
        refuses(parse, input);
});

test("F10-P15 whole chains, pipelines, redirection and expression/control syntax never yield a partial plan", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["pwd; cat .env", "pwd | cat .env", "pwd & cat .env", "pwd && cat .env", "pwd > public.txt", "pwd < public.txt",
        "pwd\ncat .env", "pwd\r\ncat .env", "(pwd)", "echo {pwd}", "echo @('a')", "echo @(pwd)", "& pwd", ". public.ps1",
        "echo $(pwd)", "echo --% public", "pwd --%", "$(Get-Content .env)", "Get-Content public.txt; Write-Output end"])
        refuses(parse, input);
});

test("F10-P16 native interpreter, module-qualified and absolute executable forms have no dispatcher fallback", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["node --version", "node -e 'public'", "python -c 'public'", "python3 --version", "powershell -Command pwd",
        "powershell.exe -EncodedCommand cAB3AGQA", "pwsh -Command pwd", "cmd /c type .env", "bash -c pwd", "sh -c pwd", "npm run public",
        "Microsoft.PowerShell.Management\\Get-Content .env", "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -Command pwd",
        ".\\public.ps1", "/usr/bin/cat public.txt", "Invoke-Expression 'pwd'", "[IO.File]::ReadAllText('.env')"])
        refuses(parse, input);
});

test("F10-P17 every path-bearing form rejects absolute, provider, traversal, wildcard and control paths", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const bad of ["/absolute/file.txt", "\\rooted\\file.txt", "C:\\private\\file.txt", "C:relative.txt", "\\\\server\\share\\file.txt",
        "file:///private/file.txt", "Env:NAME", "HKLM:Software", "file.txt:stream", "..", "../file.txt", "src/../file.txt", "src\\..\\file.txt",
        "*.txt", "file?.txt", "file[1].txt", "file\u0000.txt", "file\n.txt"])
        for (const input of ["cat '" + bad + "'", "ls '" + bad + "'", "rg needle '" + bad + "'", "copy '" + bad + "' new.txt", "copy public.txt '" + bad + "'"])
            refuses(parse, input);
    for (const input of ["cat .", "head .", "rg needle .", "copy . new.txt", "copy public.txt ."]) refuses(parse, input);
});

test("F10-P18 incomplete or concatenated quote fragments cannot be repaired into another command", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["echo 'unfinished", 'echo "unfinished', "echo prefix'quoted'", "echo 'quoted'suffix", 'echo "one""two"',
        "echo 'one'\"two\"", "cat 'public.txt'junk", "echo ''suffix", "echo \"one\"two"])
        refuses(parse, input);
});

test("F10-P19 backticks, unquoted dollars and double-quoted interpolation reject even in otherwise useful forms", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["echo `$name", "echo '`literal'", 'echo "`literal"', "echo $name", 'echo "$name"', 'echo "$(pwd)"',
        'echo "${name}"', 'echo "$"', "echo $env:NAME", "$env:NAME=value", "$env:NAME += value"])
        refuses(parse, input);
});

test("F10-P20 exact Unicode survives while lone UTF-16 surrogates never become replacement text", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const value = "É🔐 Cafe\u0301 PUBLIC"; accepts(parse, "echo '" + value + "'", { kind: "PUBLIC", action: "write", args: [value] });
    for (const value of ["\uD800", "\uDC00", "a\uD800b", "\uD83Dx\uDD10"]) refuses(parse, "echo '" + value + "'");
});

test("F10-P21 command control bytes reject in unquoted and quoted positions", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const code of [0, 1, 8, 9, 10, 11, 12, 13, 27, 31, 127, 128, 155, 159]) {
        const control = String.fromCodePoint(code); refuses(parse, "echo public" + control + "suffix"); refuses(parse, "echo 'public" + control + "suffix'");
    }
});

test("F10-P22 the token budget counts the command and is inclusive at thirty-two", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const args = Array.from({ length: 31 }, (_, index) => "word" + index);
    accepts(parse, "echo " + args.join(" "), { kind: "PUBLIC", action: "write", args });
    refuses(parse, "echo " + [...args, "overflow"].join(" "));
});

test("F10-P23 individual token UTF-8 bytes are inclusive and are not measured as UTF-16 units", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const exact = "é".repeat(512); assert.equal(Buffer.byteLength(exact), 1024);
    accepts(parse, "echo " + exact, { kind: "PUBLIC", action: "write", args: [exact] }); refuses(parse, "echo " + exact + "x");
});

test("F10-P24 whole-command bytes are inclusive without exhausting any token or count budget", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const args = ["a".repeat(1024), "b".repeat(1024), "c".repeat(1024), "d".repeat(1016)], exact = "echo " + args.join(" ");
    assert.equal(Buffer.byteLength(exact), 4096); accepts(parse, exact, { kind: "PUBLIC", action: "write", args }); refuses(parse, exact + "d");
    refuses(parse, " ".repeat(4097) + "pwd");
});

test("F10-P25 literal search needles fit exactly two hundred fifty-six UTF-8 bytes", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const needle = "é".repeat(128); assert.equal(Buffer.byteLength(needle), 256);
    accepts(parse, "rg '" + needle + "' public.txt", { kind: "SEARCH", path: "public.txt", needle });
    refuses(parse, "rg '" + needle + "x' public.txt");
});

test("F10-P26 head/tail decimal counts are canonical and remain within one through one hundred", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const count of ["0", "101", "01", "+1", "-1", "1.0", "1e1", "0x10", "NaN", "Infinity"])
        for (const name of ["head", "tail"]) refuses(parse, name + " -n " + count + " public.txt");
});

test("F10-P27 bounded sleep accepts canonical zero through two thousand milliseconds only", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const name of ["Start-Sleep", "SLEEP"]) for (const value of ["0", "1", "2000"])
        accepts(parse, name + " -mIlLiSeCoNdS " + value, { kind: "PUBLIC", action: "sleep", args: [value] });
    for (const value of ["2001", "00", "01", "+1", "-1", "1.0", "1e3", "0x10", "NaN", "Infinity"])
        refuses(parse, "sleep -Milliseconds " + value);
});

test("F10-P28 copying onto the same source and unsupported env/history/body requests refuse", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    for (const input of ["copy public.txt public.txt", "cp -LiteralPath public.txt -Destination public.txt", "env NAME", "set NAME public",
        "printenv bad-name", "$env:bad-name", "Get-Item Env:bad.name", "Get-ChildItem Env:NAME", "Get-Item Env:",
        "git show HEAD:public.txt", "git log -p", "git diff", "git diff --stat -- public.txt", "git status --branch"])
        refuses(parse, input);
});

test("F10-P29 invalid input types reject without coercion or input-bearing exceptions", async () => {
    const { parsePowerShell51Command: parse } = await implementation(); let reads = 0;
    for (const value of [undefined, null, true, 7, NaN, {}, [], ["pwd"], new String("pwd"), { toString() { reads++; throw new Error("SYNTHETIC_NO_COERCION"); } }])
        refuses(parse, value);
    for (const value of ["", "   "]) refuses(parse, value); assert.equal(reads, 0);
});

test("F10-P30 every returned array/line object is deeply frozen and fresh per parse", async () => {
    const { parsePowerShell51Command: parse } = await implementation();
    const a = accepts(parse, "echo one two", { kind: "PUBLIC", action: "write", args: ["one", "two"] });
    const b = accepts(parse, "echo one two", { kind: "PUBLIC", action: "write", args: ["one", "two"] });
    assert.notEqual(a, b); if (a.kind === "PUBLIC" && b.kind === "PUBLIC") { assert.notEqual(a.args, b.args); assert.equal(Reflect.set(a.args, "0", "changed"), false); }
    const first = accepts(parse, "head public.txt", { kind: "READ", path: "public.txt", lines: { side: "first", count: 10 } });
    const second = parse("head public.txt"); assert.notEqual(first, second);
    if (first.kind === "READ" && second?.kind === "READ") { assert.notEqual(first.lines, second.lines); assert.equal(Reflect.set(first.lines!, "count", 99), false); }
});

test("F10-P31 deterministic quoted-token fuzz preserves literal identity and refuses incomplete input", async () => {
    const { parsePowerShell51Command: parse } = await implementation(); let seed = 0xf1051;
    const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
    const alphabet = ["A", "z", "7", " ", "'", "$", ";", "|", "&", "(", ")", "@", "É", "🔐", "e\u0301"];
    for (let index = 0; index < 64; index++) {
        const token = Array.from({ length: 1 + next() % 24 }, () => alphabet[next() % alphabet.length]).join("");
        const encoded = "'" + token.replace(/'/g, "''") + "'";
        accepts(parse, "echo " + encoded, { kind: "PUBLIC", action: "write", args: [token] });
        refuses(parse, "echo " + encoded + "suffix");
    }
});
