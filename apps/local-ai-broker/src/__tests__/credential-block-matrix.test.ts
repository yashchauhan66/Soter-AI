/**
 * Does the hook actually BLOCK a real-shaped credential, vendor by vendor?
 *
 * The two sibling tests check names. `secret-class-coverage` (guard-core) pins
 * every detector class to the block vocabulary; `secret-class-vocabulary` pins
 * the protocol mirror to guard-core. Both can pass while a credential still
 * walks through, because a name is not a behaviour:
 *
 *   - `connection_string_password` was in every list and its regex guarded the
 *     value with `[^;\n]*`, which cannot cross a single `;`. A connection string
 *     IS a semicolon-separated list, so the rule only ever fired on the
 *     one-segment toy form in our own fixtures. A live DB password reached the
 *     model reported as nothing worse than `password_assignment`.
 *   - Because `collapseOverlappingMatches` keeps only the highest-scoring match
 *     for a span, the category a scan REPORTS is not simply "every rule that
 *     matched". A real OpenAI key was reported as `openai_api_key` alone and
 *     never as the broader `ai_api_key` the vocabulary knew about.
 *
 * Measured on these exact rows before that was fixed: 4 of 17 formats blocked.
 *
 * So this test drives the full path a leak actually takes — scan the text, read
 * the categories back, ask the protocol whether the hook would block — and
 * asserts on the outcome rather than on a list. It is the regression gate for
 * both failure modes above.
 *
 * Every credential below is SYNTHETIC. None is valid and none belongs to anyone.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanBrokerRequest } from "@soterai/guard-core";
import { highRiskSecretClasses } from "@soterai/ide-protocol";

const SYN = "Synth3t1cNotReal";

/** [vendor, text on disk, the category that must carry the block] */
const CREDENTIALS: Array<[string, string, string]> = [
    ["OpenAI (classic)", `OPENAI_API_KEY=sk-${SYN}0000000000AAAAT3BlbkFJ${SYN}1111111111BBBB`, "openai_api_key"],
    ["OpenAI (project)", `OPENAI_API_KEY=sk-proj-${SYN}0000000000AAAA1111111111BBBB2222`, "openai_api_key"],
    ["Anthropic", `ANTHROPIC_API_KEY=sk-ant-api03-${SYN}0000000000AAAA1111111111BBBB`, "anthropic_api_key"],
    ["Google Gemini", `GEMINI_API_KEY=AIza${SYN}0000000000AAAA1111111BB`, "opaque_credential"],
    ["Groq", `GROQ_API_KEY=gsk_${SYN}0000000000AAAA1111111111BBBB`, "groq_api_key"],
    ["DeepSeek", "DEEPSEEK_API_KEY=sk-0123456789abcdef0123456789abcdef0123456789abcdef", "deepseek_api_key"],
    ["AWS secret access key", "aws_secret_access_key=wJalrXUtnFEMIzK7MDENGzbPxRfiCYSYNTHETIC", "opaque_credential"],
    ["Azure storage", `DefaultEndpointsProtocol=https;AccountName=x;AccountKey=${SYN}00001111222233334444==`, "azure_storage_key"],
    ["Twilio auth token", "twilio_auth_token=0123456789abcdef0123456789abcdef", "twilio_auth_token"],
    ["GitLab CI job token", `CI_JOB_TOKEN=glcbt-${SYN}00001111222233334444`, "gitlab_ci_job_token"],
    ["Slack webhook", `HOOK=https://hooks.slack.com/services/T01234567AB/B01234567CD/${SYN}0000111122223333`, "webhook_secret"],
    ["Heroku-shaped UUID", "HEROKU_API_KEY=01234567-89ab-cdef-0123-456789abcdef", "opaque_credential"],
    ["GitHub PAT", `GITHUB_TOKEN=ghp_${SYN}000011112222333344445555`, "github_token"],
    ["Stripe live", `STRIPE_KEY=sk_live_${SYN}00001111222233334444`, "stripe_key"],
    // The reason the unknown-vendor rule exists: an agent router, a self-hosted
    // gateway, an internal service. Every row above needs someone to have
    // anticipated the vendor; these two do not.
    ["Bare sk- (no vendor marker)", `ROUTER_KEY=sk-${SYN}0000111122223333`, "ai_api_key"],
    ["Unknown vendor opaque", "ROUTER_AUTH=7fK2pQ9xZm4Rv8Nb1Lc6Ht3Wd5Yj0Ts2Ug7Ei4Ao9Pr6Sn", "opaque_credential"],
];

/**
 * A connection string is a semicolon-separated list and the password is rarely
 * the second segment. Each shape is drawn from a driver that writes it that way.
 */
const CONNECTION_STRINGS: Array<[string, string]> = [
    ["single segment", "Server=db;Password=Synth3t1cPassw0rd;"],
    ["Pwd alias", "Server=db.example;Database=app;Pwd=Synth3t1cPassw0rd;"],
    ["SQL Server / .NET", "Server=tcp:db.example,1433;Database=app;User Id=svc;Password=Synth3t1cPassw0rd;Encrypt=True;"],
    ["ADO.NET Data Source", "Data Source=db.example;Initial Catalog=app;User ID=svc;Password=Synth3t1cPassw0rd;"],
    ["Npgsql / ODBC Host=", "Host=db.example;Port=5432;Username=svc;Password=Synth3t1cPassw0rd;"],
];

describe("hook blocks real credential formats", () => {
    for (const [vendor, text, expected] of CREDENTIALS) {
        it(`blocks ${vendor}`, async () => {
            const result = await scanBrokerRequest([{ role: "user", content: text }]);
            const blocking = highRiskSecretClasses(result.categories);

            assert.ok(
                blocking.length > 0,
                `a ${vendor} credential produced categories [${result.categories.join(", ")}], none of ` +
                    "which the hook recognises as high-risk — it would read this key and allow it.",
            );
            assert.ok(
                blocking.includes(expected),
                `a ${vendor} credential blocked on [${blocking.join(", ")}] rather than "${expected}". ` +
                    "That is not cosmetic: scoring decides which category survives overlap collapse, so a " +
                    "score change can move a class out of the vocabulary and silently unblock it.",
            );
        });
    }

    for (const [shape, text] of CONNECTION_STRINGS) {
        it(`blocks a connection-string password (${shape})`, async () => {
            const result = await scanBrokerRequest([{ role: "user", content: text }]);
            const blocking = highRiskSecretClasses(result.categories);

            assert.ok(
                blocking.includes("connection_string_password"),
                `the ${shape} form blocked on [${blocking.join(", ")}] — "connection_string_password" is ` +
                    "absent, so the password rule did not fire on this shape.",
            );
        });
    }

    it("does not block ordinary files that merely mention credentials", async () => {
        // The cost of every row above is measured here. A guard that blocks a
        // lockfile or a CI workflow is a guard users turn off.
        const benign: Array<[string, string]> = [
            ["source reading env vars", 'const key = process.env.OPENAI_API_KEY;\nconst t = process.env.ROUTER_AUTH;'],
            ["CI workflow secret refs", "env:\n  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n  API_KEY: ${{ secrets.SOTER_API_KEY }}"],
            ["lockfile integrity hashes", '{"node_modules/zod":{"integrity":"sha512-XBTkPX0g0vB2f0j7pHpJVaX9LoKO3S+pfkjNVLDUuTb4XhVUOYqZRkMQeh5T0tXEyjfmXfqXsuSQZeEkGl7Uhw=="}}'],
            ["editor settings", '{"editor.tabSize":4,"editor.formatOnSave":true,"typescript.tsdk":"node_modules/typescript/lib"}'],
            ["documented placeholder", "Set API_KEY=your-api-key-here before running the example."],
            ["container default password", "POSTGRES_PASSWORD=postgres"],
        ];

        for (const [name, text] of benign) {
            const result = await scanBrokerRequest([{ role: "user", content: text }]);
            const blocking = highRiskSecretClasses(result.categories);
            assert.deepEqual(
                blocking, [],
                `${name} would be BLOCKED on [${blocking.join(", ")}]. This is over-defense, and it is how ` +
                    "a guard gets disabled.",
            );
        }
    });
});
