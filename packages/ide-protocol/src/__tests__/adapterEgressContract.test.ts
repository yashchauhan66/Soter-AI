/**
 * Cross-language contract tests for the egress preflight in every IDE adapter.
 *
 * The seven non-VS Code adapters are written in Lua, Python, Kotlin, Java,
 * VimScript, C# and TypeScript. Six of those cannot be compiled or executed in
 * this repo's toolchain, so their behaviour is pinned here by reading the
 * source and asserting the invariants that actually decide whether data leaves
 * a developer's machine.
 *
 * This is a source-level contract test, and its limits are worth stating: it
 * proves the ASK-exclusion and the route are present and spelled correctly in
 * every language. It does NOT prove those adapters compile or run. Runtime
 * coverage exists for the two shared TypeScript packages (protocol.test.ts,
 * brokerClient.test.ts), for JupyterLab (extensions/jupyterlab) and for Sublime
 * (extensions/sublime/test_broker_client.py).
 *
 * It earns its place because the failure it catches is real and silent: an
 * adapter that treats ASK as clearance turns an unanswered confirmation into a
 * silent send, and four features shipped in 0.3.0 claiming protection they did
 * not provide precisely because nothing asserted on them.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { BrokerRoutes } from "../broker";
import { GuardFeature, GuardCommand, BROKER_BACKED_FEATURES } from "../commands";

const EXTENSIONS_DIR = resolve(__dirname, "..", "..", "..", "..", "extensions");

const EGRESS_ROUTE = BrokerRoutes.networkEgress.path;

/** The three actions that clear a send. ASK is deliberately absent. */
const CLEARED = ["ALLOW", "ALLOW_ONCE", "ALLOW_WITH_TRANSFORMATION"] as const;

/** Actions that must never be read as clearance. */
const NOT_CLEARED = ["ASK", "DENY", "QUARANTINE", "ALLOW_IN_SANDBOX"] as const;

interface AdapterSpec {
    /** Adapter directory under extensions/. */
    id: string;
    /** Language, for failure messages. */
    language: string;
    /** File holding the broker call. */
    clientFile: string;
    /** File holding the user-invokable command registration. */
    commandFile: string;
    /**
     * The command surface a user actually invokes. Without this the client
     * method is dead code that protects nobody -- the RAG egress path in
     * 0.3.0 failed exactly this way.
     */
    commandToken: string;
}

const ADAPTERS: AdapterSpec[] = [
    {
        id: "neovim",
        language: "Lua",
        clientFile: join("lua", "soterai", "broker.lua"),
        commandFile: join("lua", "soterai", "commands.lua"),
        commandToken: "SoterCheckEgress",
    },
    {
        id: "vim",
        language: "VimScript",
        clientFile: join("autoload", "soterai.vim"),
        commandFile: join("plugin", "soterai.vim"),
        commandToken: "SoterCheckEgress",
    },
    {
        id: "sublime",
        language: "Python",
        clientFile: "broker_client.py",
        // Sublime derives the command name from the class name
        // (SoteraiCheckEgressCommand -> soterai_check_egress); the palette
        // entry in Default.sublime-commands is what a user actually invokes.
        commandFile: "Default.sublime-commands",
        commandToken: "soterai_check_egress",
    },
    {
        id: "jetbrains",
        language: "Kotlin",
        clientFile: join(
            "src", "main", "kotlin", "ai", "soterai", "guard", "broker", "BrokerClient.kt"),
        commandFile: join("src", "main", "resources", "META-INF", "plugin.xml"),
        commandToken: "CheckEgress",
    },
    {
        id: "eclipse",
        language: "Java",
        clientFile: join("src", "ai", "soterai", "guard", "BrokerClient.java"),
        commandFile: join("plugin.xml"),
        commandToken: "checkEgress",
    },
    {
        id: "visual-studio",
        language: "C#",
        clientFile: join("src", "Broker", "BrokerClient.cs"),
        commandFile: join("src", "SoterAIGuardPackage.vsct"),
        commandToken: "cmdCheckEgress",
    },
    {
        id: "jupyterlab",
        language: "TypeScript",
        clientFile: join("src", "broker.ts"),
        commandFile: join("src", "index.ts"),
        commandToken: "checkEgress",
    },
];

function readAdapterFile(spec: AdapterSpec, relative: string): string {
    const path = join(EXTENSIONS_DIR, spec.id, relative);
    assert.ok(
        existsSync(path),
        `${spec.id} (${spec.language}): expected file ${relative} to exist at ${path}`,
    );
    return readFileSync(path, "utf8");
}

/**
 * Extract every allow-set literal from a source file.
 *
 * The seven adapters spell this collection five different ways and across a
 * varying number of lines -- `frozenset((...))` on one line in Python, a
 * multi-line Lua table, a multi-line `new Set([...])` in TypeScript -- so the
 * search runs over the source with whitespace collapsed rather than line by
 * line.
 *
 * Two boundaries matter, and both are load-bearing:
 *
 * - An allow-set must be told apart from a mere *enumeration* of the
 *   vocabulary. `broker.ts` declares
 *   `type EgressAction = 'ALLOW' | ... | 'ASK' | 'DENY'`, which correctly names
 *   every action and must not be read as a permission list. The discriminator
 *   is the separator: a union joins with `|`, every allow-set joins with `,`.
 *   That holds in all five collection syntaxes without special-casing any.
 * - The region must END at the literal's closing delimiter, NOT at the last
 *   cleared action. Stopping early would miss `{ALLOW, ALLOW_ONCE,
 *   ALLOW_WITH_TRANSFORMATION, ASK}` -- an ASK appended to the end of the set
 *   is precisely the bug this test exists to catch.
 */
function allowSetRegions(source: string): string[] {
    const flat = source.replace(/\s+/g, " ");
    const regions: string[] = [];
    const ONCE = "ALLOW_ONCE";
    const FULL = "ALLOW_WITH_TRANSFORMATION";
    const LEAD = 60;
    const TRAIL = 120;

    for (let from = 0; ; ) {
        const once = flat.indexOf(ONCE, from);
        if (once < 0) {
            break;
        }
        from = once + ONCE.length;

        // The two long names sit adjacent in every adapter's set.
        const full = flat.indexOf(FULL, from);
        if (full < 0 || full - from > 40) {
            continue;
        }

        // Comma-separated => a collection. Pipe-separated => a type union.
        const gap = flat.slice(from, full);
        if (!gap.includes(",") || gap.includes("|")) {
            continue;
        }

        // Extend backwards to the collection opener so a leading bare ALLOW is
        // covered. If none is close by, start at the anchor instead.
        const leadStart = Math.max(0, once - LEAD);
        const lead = flat.slice(leadStart, once);
        const opener = Math.max(
            lead.lastIndexOf("("),
            lead.lastIndexOf("["),
            lead.lastIndexOf("{"),
        );
        const start = opener < 0 ? once : leadStart + opener;

        // End at the closing delimiter so trailing entries are covered.
        const tail = flat.slice(full + FULL.length, full + FULL.length + TRAIL);
        const close = tail.search(/[)\]}]/);
        const end =
            full + FULL.length + (close < 0 ? tail.length : close + 1);

        regions.push(flat.slice(start, end));
    }

    return regions;
}

describe("shared protocol declares the egress firewall", () => {
    test("the preflight route is the broker's egress path", () => {
        assert.equal(BrokerRoutes.networkEgress.path, "/v1/preflight/network-egress");
        assert.equal(BrokerRoutes.networkEgress.method, "POST");
        assert.equal(BrokerRoutes.networkEgress.auth, true);
    });

    test("the egress firewall is a broker-backed shared feature", () => {
        assert.ok(BROKER_BACKED_FEATURES.includes(GuardFeature.EgressFirewall));
        assert.equal(GuardCommand.CheckEgress, "soterai.egress.check");
    });
});

describe("every adapter reaches the egress preflight route", () => {
    for (const spec of ADAPTERS) {
        test(`${spec.id} (${spec.language}) posts to ${EGRESS_ROUTE}`, () => {
            const source = readAdapterFile(spec, spec.clientFile);
            assert.ok(
                source.includes(EGRESS_ROUTE),
                `${spec.id}: ${spec.clientFile} does not reference ${EGRESS_ROUTE}. ` +
                    `A typo here means the egress check silently 404s.`,
            );
        });
    }
});

describe("every adapter excludes ASK from clearance", () => {
    for (const spec of ADAPTERS) {
        test(`${spec.id} (${spec.language}) lists the three cleared actions`, () => {
            const source = readAdapterFile(spec, spec.clientFile);
            for (const action of CLEARED) {
                assert.ok(
                    source.includes(action),
                    `${spec.id}: cleared action ${action} is missing from ${spec.clientFile}`,
                );
            }
        });

        test(`${spec.id} (${spec.language}) never puts ASK in its allow-set`, () => {
            const source = readAdapterFile(spec, spec.clientFile);
            const regions = allowSetRegions(source);

            assert.ok(
                regions.length > 0,
                `${spec.id}: could not locate an allow-set in ${spec.clientFile}`,
            );

            for (const region of regions) {
                for (const action of NOT_CLEARED) {
                    assert.ok(
                        !region.includes(action),
                        `${spec.id}: ${action} appears in the allow-set -> ` +
                            `"${region}". ASK means the user has not answered; ` +
                            `treating it as clearance turns a prompt into a silent send.`,
                    );
                }
            }
        });
    }
});

describe("every adapter exposes the check as an invokable command", () => {
    for (const spec of ADAPTERS) {
        test(`${spec.id} (${spec.language}) registers ${spec.commandToken}`, () => {
            const source = readAdapterFile(spec, spec.commandFile);
            assert.ok(
                source.includes(spec.commandToken),
                `${spec.id}: ${spec.commandFile} does not register ${spec.commandToken}. ` +
                    `An unreachable client method is dead code, not protection.`,
            );
        });
    }
});

describe("no adapter reimplements detection locally", () => {
    // The whole architecture rests on adapters being thin. An adapter that
    // decides risk itself would drift from the broker and from every other IDE.
    //
    // Note what is NOT forbidden: `riskScore = result.get("riskScore")` is a
    // Kotlin named argument reading the broker's own field, which is exactly
    // the thin-client behaviour we want. A naive "riskScore =" marker flags it
    // and is worse than no test. These markers only match code that classifies
    // content or invents a verdict locally.
    const FORBIDDEN: Array<{ pattern: RegExp; why: string }> = [
        {
            pattern: /\b(computeRisk|scoreRisk|calculateRisk|detectSecrets?)\b/,
            why: "scores or detects locally instead of asking the broker",
        },
        {
            pattern: /riskScore\s*[:=]\s*\d/,
            why: "assigns a risk score from a literal instead of the broker's reply",
        },
        {
            pattern: /riskScore\s*[<>]=?/,
            why: "applies its own risk threshold; the broker's action is the verdict",
        },
        {
            pattern: /(AKIA|sk-live|sk-ant|BEGIN [A-Z ]*PRIVATE KEY|SECRET_PATTERNS?)/,
            why: "carries its own credential patterns; secret scanning is the broker's job",
        },
    ];

    for (const spec of ADAPTERS) {
        test(`${spec.id} (${spec.language}) only reads the broker's verdict`, () => {
            const source = readAdapterFile(spec, spec.clientFile);
            for (const { pattern, why } of FORBIDDEN) {
                const hit = pattern.exec(source);
                assert.equal(
                    hit,
                    null,
                    `${spec.id}: ${spec.clientFile} ${why} -> matched ` +
                        `"${hit?.[0]}". Risk decisions belong to the broker.`,
                );
            }
        });
    }
});
