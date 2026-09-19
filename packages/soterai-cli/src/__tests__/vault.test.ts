/**
 * THE VAULT AND `soterai run` — does a stored secret stay encrypted at rest,
 * stay out of argv and out of the terminal, and reach ONLY the child process
 * that needs it?
 *
 * The feature's whole claim is "the secret is not in a file the agent reads."
 * So the load-bearing assertions here are negative ones: the value is never
 * printed, never in the process argv, the vault file is ciphertext, and a wrong
 * passphrase fails the run CLOSED instead of starting the child unconfigured.
 *
 * Every credential below is SYNTHETIC — correct shape, random value.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    buildChildEnv,
    decryptSecrets,
    encryptSecrets,
    isValidSecretName,
    parseEnvFile,
    passphrasesMatch,
    rewriteEnvWithoutValues,
    type Secrets,
    type VaultFile,
} from "../vault";
import { run, type CliDeps } from "../run";

const PASS = "correct horse battery staple 42";
// Synthetic, correct-shape secrets. Never real.
const SYNTH_OPENAI = `sk-${"Zt4hQ9mVx2Kd7Rb1Ns6pW3yJ8cF5gA0uE7iO2rY4tXnLmB"}`;
const SYNTH_DB = "postgres://app:S3cr3t-Synth-Pw@db.internal:5432/prod";

// ── vault crypto (pure) ─────────────────────────────────────────────────────

describe("vault crypto: encrypt at rest, open only with the passphrase", () => {
    it("round-trips a secrets map", () => {
        const secrets: Secrets = { OPENAI_API_KEY: SYNTH_OPENAI, DATABASE_URL: SYNTH_DB };
        const vault = encryptSecrets(secrets, PASS);
        assert.deepEqual(decryptSecrets(vault, PASS), secrets);
    });

    it("stores NO plaintext and NO key — the file is only ciphertext + KDF params", () => {
        const vault = encryptSecrets({ OPENAI_API_KEY: SYNTH_OPENAI }, PASS);
        const serialized = JSON.stringify(vault);
        assert.ok(!serialized.includes(SYNTH_OPENAI), "the secret value must not appear in the vault file");
        assert.ok(!serialized.includes(PASS), "the passphrase must not appear in the vault file");
        assert.equal(vault.kdf.algo, "scrypt");
        assert.ok(vault.kdf.salt.length > 0, "a per-vault salt must be stored so the key is not reproducible without it");
    });

    it("uses a fresh salt and IV each write, so the same secret encrypts differently", () => {
        const a = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const b = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        assert.notEqual(a.payload, b.payload, "identical plaintext under a fresh IV must not produce identical ciphertext");
        assert.notEqual(a.kdf.salt, b.kdf.salt, "each vault write must draw a new salt");
    });

    it("rejects a wrong passphrase as an authentication failure, not garbage output", () => {
        const vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        assert.throws(() => decryptSecrets(vault, "wrong passphrase"), /Wrong passphrase|corrupt/i);
    });

    it("rejects a tampered payload (GCM tag mismatch)", () => {
        const vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const raw = Buffer.from(vault.payload, "base64");
        raw[raw.length - 1] ^= 0xff; // flip a bit in the auth tag
        const tampered: VaultFile = { ...vault, payload: raw.toString("base64") };
        assert.throws(() => decryptSecrets(tampered, PASS), /Wrong passphrase|corrupt/i);
    });

    it("validates secret names against the shell-export identifier rules", () => {
        assert.ok(isValidSecretName("OPENAI_API_KEY"));
        assert.ok(isValidSecretName("_private"));
        assert.ok(!isValidSecretName("1KEY"), "must not start with a digit");
        assert.ok(!isValidSecretName("KEY-NAME"), "hyphen is not a valid env var char");
        assert.ok(!isValidSecretName("KEY NAME"), "space is not valid");
        assert.ok(!isValidSecretName(""), "empty is not valid");
    });

    it("passphrasesMatch is exact (used to confirm a new vault)", () => {
        assert.ok(passphrasesMatch("abc", "abc"));
        assert.ok(!passphrasesMatch("abc", "abcd"));
        assert.ok(!passphrasesMatch("abc", "abd"));
    });
});

describe("parseEnvFile: conservative .env parsing for a security tool", () => {
    it("parses plain, exported, and quoted assignments", () => {
        const { entries } = parseEnvFile(
            [
                "# a comment",
                "",
                "OPENAI_API_KEY=" + SYNTH_OPENAI,
                "export DATABASE_URL=" + SYNTH_DB,
                `QUOTED="value with spaces"`,
                `SINGLE='single quoted'`,
            ].join("\n"),
        );
        const map = Object.fromEntries(entries.map((e) => [e.name, e.value]));
        assert.equal(map.OPENAI_API_KEY, SYNTH_OPENAI);
        assert.equal(map.DATABASE_URL, SYNTH_DB, "the `export ` prefix must be dropped");
        assert.equal(map.QUOTED, "value with spaces");
        assert.equal(map.SINGLE, "single quoted");
    });

    it("does NOT strip a # inside a quoted value (it could be part of the secret)", () => {
        const { entries } = parseEnvFile(`TOKEN="ab#cd#ef"`);
        assert.equal(entries[0].value, "ab#cd#ef", "trimming at # would corrupt a secret that legitimately contains one");
    });

    it("reports invalid names as skipped instead of importing them", () => {
        const { entries, skipped } = parseEnvFile("1BAD=x\nGOOD=y\nBAD-NAME=z");
        assert.deepEqual(entries.map((e) => e.name), ["GOOD"]);
        assert.deepEqual(skipped, ["1BAD", "BAD-NAME"]);
    });

    it("rewriteEnvWithoutValues empties ONLY the entries it is given, leaving the rest untouched", () => {
        // Contract test: the function only touches the entries handed to it, so
        // pass a SUBSET (just OPENAI_API_KEY) and prove PUBLIC_URL is preserved.
        const src = ["# keep me", "OPENAI_API_KEY=" + SYNTH_OPENAI, "PUBLIC_URL=https://example.com"].join("\n");
        const { entries } = parseEnvFile(src);
        const onlyOpenai = entries.filter((e) => e.name === "OPENAI_API_KEY");
        const rewritten = rewriteEnvWithoutValues(src, onlyOpenai);
        assert.ok(!rewritten.includes(SYNTH_OPENAI), "the raw secret value must be gone from the rewritten file");
        assert.match(rewritten, /OPENAI_API_KEY=\s*$/m, "the KEY is kept (documents what the app needs), value emptied");
        assert.match(rewritten, /PUBLIC_URL=https:\/\/example\.com/, "an entry NOT passed in is left exactly as it was");
        assert.match(rewritten, /# keep me/, "comments are preserved");
    });
});

describe("buildChildEnv: secrets overlaid, passphrase stripped", () => {
    it("adds the secrets and removes the passphrase variable", () => {
        const parent: NodeJS.ProcessEnv = { PATH: "/usr/bin", SOTERAI_VAULT_PASSPHRASE: PASS };
        const env = buildChildEnv(parent, { OPENAI_API_KEY: SYNTH_OPENAI });
        assert.equal(env.OPENAI_API_KEY, SYNTH_OPENAI, "the child must receive the secret");
        assert.equal(env.PATH, "/usr/bin", "the parent environment is preserved");
        assert.equal(
            env.SOTERAI_VAULT_PASSPHRASE, undefined,
            "the vault passphrase must NOT be inherited by the child — it unlocks everything",
        );
    });

    it("does not mutate the parent env object", () => {
        const parent: NodeJS.ProcessEnv = { PATH: "/usr/bin" };
        buildChildEnv(parent, { K: SYNTH_OPENAI });
        assert.equal(parent.K, undefined, "the parent env must be left untouched");
    });
});

// ── CLI commands (through run(), with injected deps) ────────────────────────

interface Harness {
    deps: CliDeps;
    out: string[];
    err: string[];
    /** The in-memory vault store, standing in for the on-disk file. */
    store: { vault: VaultFile | null };
    /** In-memory text files (for `vault import`), keyed by path. */
    files: Record<string, string>;
    /** What spawnProcess was last called with. */
    spawned: { command?: string; argv?: string[]; env?: NodeJS.ProcessEnv; cwd?: string };
}

function harness(overrides: Partial<CliDeps> = {}, opts: { stdin?: string; passphrase?: string; exitCode?: number; files?: Record<string, string> } = {}): Harness {
    const out: string[] = [];
    const err: string[] = [];
    const store: { vault: VaultFile | null } = { vault: null };
    const files: Record<string, string> = { ...opts.files };
    const spawned: Harness["spawned"] = {};
    const notUsed = () => { throw new Error("dependency not expected in a vault/run test"); };
    const deps: CliDeps = {
        out: (l) => out.push(l),
        err: (l) => err.push(l),
        makeClient: notUsed as unknown as CliDeps["makeClient"],
        resolveToken: notUsed as unknown as CliDeps["resolveToken"],
        readFileText: async (f) => {
            if (!(f in files)) throw new Error(`no such file: ${f}`);
            return files[f];
        },
        readStdin: async () => opts.stdin ?? "",
        gitDiff: notUsed as unknown as CliDeps["gitDiff"],
        findMcpConfigs: notUsed as unknown as CliDeps["findMcpConfigs"],
        startBroker: notUsed as unknown as CliDeps["startBroker"],
        cwd: "/work",
        readTargetFile: async () => null,
        isFile: async () => false,
        readJsonFile: async () => undefined,
        writeJsonFile: notUsed as unknown as CliDeps["writeJsonFile"],
        home: "/home/dev",
        execPath: "/usr/bin/node",
        cliEntry: "/cli.js",
        vaultPath: "/home/dev/.soterai/vault.enc",
        readVault: async () => store.vault,
        writeVault: async (_file, vault) => { store.vault = vault; },
        writeFileText: async (f, text) => { files[f] = text; },
        readPassphrase: async () => opts.passphrase ?? PASS,
        env: { PATH: "/usr/bin" },
        spawnProcess: async (command, argv, env, cwd) => {
            spawned.command = command; spawned.argv = argv; spawned.env = env; spawned.cwd = cwd;
            return opts.exitCode ?? 0;
        },
        ...overrides,
    };
    return { deps, out, err, store, files, spawned };
}

describe("soterai vault init", () => {
    it("creates an empty, openable vault", async () => {
        const h = harness();
        const code = await run(["vault", "init"], h.deps);
        assert.equal(code, 0);
        assert.ok(h.store.vault, "a vault file must have been written");
        assert.deepEqual(decryptSecrets(h.store.vault!, PASS), {}, "the new vault opens to an empty secrets map");
    });

    it("refuses to overwrite an existing vault", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const code = await run(["vault", "init"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /already exists/i);
        assert.deepEqual(decryptSecrets(h.store.vault, PASS), { K: SYNTH_OPENAI }, "the existing secret must be intact");
    });
});

describe("soterai vault add", () => {
    it("adds a secret read from stdin and never echoes its value", async () => {
        const h = harness({}, { stdin: SYNTH_OPENAI });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "add", "OPENAI_API_KEY"], h.deps);
        assert.equal(code, 0);
        assert.deepEqual(decryptSecrets(h.store.vault, PASS), { OPENAI_API_KEY: SYNTH_OPENAI });
        assert.ok(
            !h.out.join("\n").includes(SYNTH_OPENAI) && !h.err.join("\n").includes(SYNTH_OPENAI),
            "the secret value must never appear in stdout/stderr — only the NAME is confirmed",
        );
        assert.match(h.out.join("\n"), /OPENAI_API_KEY/);
    });

    it("strips the one trailing newline a shell echo appends", async () => {
        const h = harness({}, { stdin: `${SYNTH_OPENAI}\n` });
        h.store.vault = encryptSecrets({}, PASS);
        await run(["vault", "add", "OPENAI_API_KEY"], h.deps);
        assert.equal(
            decryptSecrets(h.store.vault, PASS).OPENAI_API_KEY, SYNTH_OPENAI,
            "a trailing \\n from `echo` must not become part of the stored secret",
        );
    });

    it("rejects an invalid environment variable name", async () => {
        const h = harness({}, { stdin: SYNTH_OPENAI });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "add", "bad-name"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /not a valid environment variable name/i);
    });

    it("requires a value on stdin", async () => {
        const h = harness({}, { stdin: "" });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "add", "OPENAI_API_KEY"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /No secret value on stdin/i);
    });

    it("errors when there is no vault yet", async () => {
        const h = harness({}, { stdin: SYNTH_OPENAI });
        const code = await run(["vault", "add", "OPENAI_API_KEY"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /No vault/i);
    });
});

describe("soterai vault import", () => {
    const ENV = "/work/.env";
    const envBody = ["OPENAI_API_KEY=" + SYNTH_OPENAI, "DATABASE_URL=" + SYNTH_DB, "PORT=3000"].join("\n");

    it("imports every assignment into the vault without echoing values", async () => {
        const h = harness({}, { files: { [ENV]: envBody } });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "import", ENV], h.deps);
        assert.equal(code, 0);
        assert.deepEqual(decryptSecrets(h.store.vault, PASS), {
            OPENAI_API_KEY: SYNTH_OPENAI, DATABASE_URL: SYNTH_DB, PORT: "3000",
        });
        const printed = h.out.join("\n");
        assert.ok(!printed.includes(SYNTH_OPENAI) && !printed.includes(SYNTH_DB), "import must not print any secret value");
        assert.match(printed, /OPENAI_API_KEY/, "it confirms by NAME");
    });

    it("does NOT touch the file without --replace (non-destructive by default), and says so", async () => {
        const h = harness({}, { files: { [ENV]: envBody } });
        h.store.vault = encryptSecrets({}, PASS);
        await run(["vault", "import", ENV], h.deps);
        assert.equal(h.files[ENV], envBody, "the .env must be left byte-for-byte unchanged without --replace");
        assert.match(h.out.join("\n"), /raw values are STILL/i, "it must warn the raw values are still on disk");
    });

    it("with --replace strips the raw values from disk but keeps the keys", async () => {
        const h = harness({}, { files: { [ENV]: envBody } });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "import", ENV, "--replace"], h.deps);
        assert.equal(code, 0);
        // Vault has the real values…
        assert.equal(decryptSecrets(h.store.vault, PASS).OPENAI_API_KEY, SYNTH_OPENAI);
        // …and the file no longer does.
        assert.ok(!h.files[ENV].includes(SYNTH_OPENAI), "the raw secret must be gone from the .env after --replace");
        assert.ok(!h.files[ENV].includes(SYNTH_DB), "all imported raw values must be gone");
        assert.match(h.files[ENV], /OPENAI_API_KEY=/, "the key stays so the file still documents what is needed");
        assert.match(h.out.join("\n"), /rewritten/i);
    });

    it("errors when there is no vault", async () => {
        const h = harness({}, { files: { [ENV]: envBody } });
        const code = await run(["vault", "import", ENV], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /No vault/i);
    });

    it("errors on a file with no importable assignments", async () => {
        const h = harness({}, { files: { [ENV]: "# just a comment\n\n" } });
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["vault", "import", ENV], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /No importable/i);
    });
});

describe("soterai vault list", () => {
    it("lists NAMES only, never values", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ OPENAI_API_KEY: SYNTH_OPENAI, DATABASE_URL: SYNTH_DB }, PASS);
        const code = await run(["vault", "list"], h.deps);
        assert.equal(code, 0);
        const printed = h.out.join("\n");
        assert.match(printed, /OPENAI_API_KEY/);
        assert.match(printed, /DATABASE_URL/);
        assert.ok(!printed.includes(SYNTH_OPENAI) && !printed.includes(SYNTH_DB), "list must never print a stored value");
    });
});

describe("soterai vault rm", () => {
    it("removes a named secret", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ A: SYNTH_OPENAI, B: SYNTH_DB }, PASS);
        const code = await run(["vault", "rm", "A"], h.deps);
        assert.equal(code, 0);
        assert.deepEqual(Object.keys(decryptSecrets(h.store.vault, PASS)), ["B"]);
    });

    it("reports a missing name without touching the vault", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ B: SYNTH_DB }, PASS);
        const code = await run(["vault", "rm", "NOPE"], h.deps);
        assert.equal(code, 1);
        assert.match(h.err.join("\n"), /No secret named NOPE/i);
    });
});

describe("soterai run -- <cmd>: JIT injection into the child environment", () => {
    it("injects the vault secrets into the child env, not into argv", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ OPENAI_API_KEY: SYNTH_OPENAI }, PASS);
        const code = await run(["run", "--", "mytool", "--flag", "value"], h.deps);
        assert.equal(code, 0);
        assert.equal(h.spawned.command, "mytool");
        assert.deepEqual(h.spawned.argv, ["--flag", "value"], "the child's own flags pass through verbatim");
        assert.equal(h.spawned.env?.OPENAI_API_KEY, SYNTH_OPENAI, "the secret must reach the child via env");
        assert.ok(
            !h.spawned.argv!.join(" ").includes(SYNTH_OPENAI),
            "the secret must NEVER be placed on the child's command line (argv is world-readable)",
        );
    });

    it("works without the optional `--` separator", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const code = await run(["run", "mytool", "arg"], h.deps);
        assert.equal(code, 0);
        assert.equal(h.spawned.command, "mytool");
        assert.deepEqual(h.spawned.argv, ["arg"]);
    });

    it("never leaks the passphrase into the child environment", async () => {
        const h = harness({ env: { PATH: "/usr/bin", SOTERAI_VAULT_PASSPHRASE: PASS } });
        h.store.vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        await run(["run", "--", "mytool"], h.deps);
        assert.equal(
            h.spawned.env?.SOTERAI_VAULT_PASSPHRASE, undefined,
            "the passphrase variable must be stripped before the child starts",
        );
    });

    it("propagates the child's exit code", async () => {
        const h = harness({}, { exitCode: 17 });
        h.store.vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const code = await run(["run", "--", "failing-tool"], h.deps);
        assert.equal(code, 17, "soterai run must adopt the child's exit code, not mask it as success");
    });

    it("FAILS CLOSED on a wrong passphrase — the child is never started", async () => {
        let spawnCalled = false;
        const h = harness(
            { spawnProcess: async () => { spawnCalled = true; return 0; }, readPassphrase: async () => "wrong" },
        );
        h.store.vault = encryptSecrets({ K: SYNTH_OPENAI }, PASS);
        const code = await run(["run", "--", "mytool"], h.deps);
        assert.equal(code, 1, "a vault that cannot be opened must stop the run");
        assert.equal(spawnCalled, false, "the child must NOT run without its secrets — that would be a silent half-config");
    });

    it("errors when there is no vault", async () => {
        const h = harness();
        const code = await run(["run", "--", "mytool"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /No vault/i);
    });

    it("shows usage when no command is given", async () => {
        const h = harness();
        h.store.vault = encryptSecrets({}, PASS);
        const code = await run(["run"], h.deps);
        assert.equal(code, 2);
        assert.match(h.err.join("\n"), /Usage: soterai run/);
    });
});
