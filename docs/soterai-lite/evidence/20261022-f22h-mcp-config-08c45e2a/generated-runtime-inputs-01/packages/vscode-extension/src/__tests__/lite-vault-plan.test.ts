import assert from "node:assert/strict";
import { test } from "node:test";
import { createVaultMigrationPlan } from "../firewall/VaultMigrationPlan";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";

// F06 pure-plan contracts. Inputs are synthetic, in-memory and never credentials
// read from a workspace, owner vault, profile, environment or external service.
const GENERATION = "a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1";
const OTHER_GENERATION = "b6538c47-57cb-4e95-93f6-d6e6c6cb6ee2";
const PRIVATE = "SYNTHETIC_F06_PRIVATE_VALUE_20261014";
const COMMENT = "SYNTHETIC_F06_UNRELATED_COMMENT_20261014";
const URL = "postgresql://synthetic:fake-only@f06.invalid/private-db";
const GITHUB = "ghp_abcdefghijklmnopqrstuvwxyz123456";
const OTHER_GITHUB = "ghp_654321zyxwvutsrqponmlkjihgfedcba";
const placeholder = (ordinal: number, generation = GENERATION) =>
    `[SOTERAI_PROTECTED_${generation.replace(/-/g, "").toUpperCase()}_${ordinal}]`;
type Plan = ReturnType<typeof createVaultMigrationPlan>;
function examples(plan: Plan, names?: string[]): void {
    const lines = plan.exampleText.split(/\r?\n/).filter(Boolean);
    for (const line of lines) assert.match(line, /^[A-Za-z_][A-Za-z0-9_]{0,127}=$/);
    assert.equal(new Set(lines).size, lines.length, "Example assignments must be unique.");
    if (names) assert.deepEqual(lines, names.map(name => `${name}=`));
    for (const value of [PRIVATE, COMMENT, URL, GITHUB, OTHER_GITHUB]) assert.ok(!plan.exampleText.includes(value));
    assert.ok(!plan.exampleText.includes("SOTERAI_PROTECTED_"));
}
function allReplaced(plan: Plan, original: string): void {
    const placeholders = plan.candidates.map(candidate => candidate.placeholder);
    assert.equal(new Set(placeholders).size, placeholders.length);
    for (const candidate of plan.candidates) {
        assert.equal(typeof candidate.type, "string"); assert.ok(candidate.type.length > 0);
        assert.ok(Number.isInteger(candidate.start) && Number.isInteger(candidate.end));
        assert.ok(candidate.start >= 0 && candidate.end > candidate.start && candidate.end <= original.length);
        assert.ok(plan.maskedText.includes(candidate.placeholder));
        assert.ok(!plan.maskedText.includes(candidate.rawValue), "Migrated logical values must not survive in masked text.");
    }
}

test("F06-P01 secret-ish environment keys migrate short private values with generation and field-position placeholders", () => {
    const text = "PORT=8080\nTOKEN=xy\nPASSWORD=qv\nAPI_KEY=ab\n";
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.deepEqual(plan.candidates.map(candidate => [candidate.key, candidate.rawValue, candidate.placeholder]),
        [["TOKEN", "xy", placeholder(1)], ["PASSWORD", "qv", placeholder(2)], ["API_KEY", "ab", placeholder(3)]]);
    assert.equal(plan.maskedText, `PORT=8080\nTOKEN=${placeholder(1)}\nPASSWORD=${placeholder(2)}\nAPI_KEY=${placeholder(3)}\n`);
    allReplaced(plan, text); examples(plan, ["PORT", "TOKEN", "PASSWORD", "API_KEY"]);
});

test("F06-P02 useful ordinary environment values and empty secret values remain unchanged", () => {
    const text = `# ${COMMENT}\nPORT=5432\nHOST=localhost\nPUBLIC_NAME=demo\nTOKEN=\nAPI_KEY=''\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.equal(plan.candidates.length, 0); assert.equal(plan.maskedText, text);
    examples(plan, ["PORT", "HOST", "PUBLIC_NAME", "TOKEN", "API_KEY"]);
});

test("F06-P03 formatting, BOM, CRLF, export spacing and unrelated comments survive selected value replacement", () => {
    const text = `\uFEFF# ${COMMENT}\r\n  export DATABASE_URL = '${URL}'  # keep this suffix\r\nPORT = 8080\r\n\r\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.equal(plan.candidates.length, 1); assert.equal(plan.candidates[0].rawValue, URL);
    assert.equal(plan.candidates[0].placeholder, placeholder(0));
    assert.equal(plan.maskedText, text.replace(`'${URL}'`, placeholder(0)));
    allReplaced(plan, text); examples(plan, ["DATABASE_URL", "PORT"]);
});

for (const quote of ["'", '"', "`"] as const) {
    test(`F06-P04 ${quote}-quoted multiline private values migrate atomically without inventing assignment fields`, () => {
        const value = `first line\nSHADOW_SYNTHETIC=${PRIVATE}\nlast line`;
        const text = `# ${COMMENT}\nAPI_TOKEN=${quote}${value}${quote}\nPORT=8080\n`;
        const plan = createVaultMigrationPlan(text, true, GENERATION);
        assert.equal(plan.candidates.length, 1); assert.equal(plan.candidates[0].key, "API_TOKEN");
        assert.equal(plan.candidates[0].rawValue, value); assert.equal(plan.candidates[0].placeholder, placeholder(0));
        assert.equal(plan.maskedText, `# ${COMMENT}\nAPI_TOKEN=${placeholder(0)}\nPORT=8080\n`);
        assert.ok(!plan.maskedText.includes("SHADOW_SYNTHETIC")); allReplaced(plan, text);
        examples(plan, ["API_TOKEN", "PORT"]); assert.ok(!plan.exampleText.includes("SHADOW_SYNTHETIC"));
        const model = new SecureEditorModel(plan.maskedText, true);
        assert.deepEqual(model.metadata().fields.map(field => field.name), ["API_TOKEN", "PORT"]);
    });
}

test("F06-P05 duplicate assignment names preserve each distinct private value and field-position placeholder", () => {
    const text = `TOKEN=${PRIVATE}-first\nPORT=7\nTOKEN='${PRIVATE}-second'\nTOKEN=${PRIVATE}-first\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.deepEqual(plan.candidates.map(candidate => candidate.key), ["TOKEN", "TOKEN", "TOKEN"]);
    assert.deepEqual(plan.candidates.map(candidate => candidate.rawValue), [`${PRIVATE}-first`, `${PRIVATE}-second`, `${PRIVATE}-first`]);
    assert.deepEqual(plan.candidates.map(candidate => candidate.placeholder), [placeholder(0), placeholder(2), placeholder(3)]);
    assert.equal(plan.maskedText, `TOKEN=${placeholder(0)}\nPORT=7\nTOKEN=${placeholder(2)}\nTOKEN=${placeholder(3)}\n`);
    allReplaced(plan, text); examples(plan, ["TOKEN", "PORT"]);
});

test("F06-P06 double-quoted newline escapes yield logical private candidate values and no serialized value remnants", () => {
    const text = `TOKEN="first\\n${PRIVATE}\\rlast"\nPORT=7\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.equal(plan.candidates.length, 1); assert.equal(plan.candidates[0].rawValue, `first\n${PRIVATE}\rlast`);
    assert.equal(plan.maskedText, `TOKEN=${placeholder(0)}\nPORT=7\n`);
    assert.ok(!plan.maskedText.includes(PRIVATE)); assert.ok(!plan.maskedText.includes("first\\n"));
    examples(plan, ["TOKEN", "PORT"]);
});

test("F06-P07 identical private values in different generations produce independent placeholders", () => {
    const text = `TOKEN=${PRIVATE}\n`;
    const first = createVaultMigrationPlan(text, true, GENERATION), second = createVaultMigrationPlan(text, true, OTHER_GENERATION);
    assert.equal(first.candidates[0].placeholder, placeholder(0));
    assert.equal(second.candidates[0].placeholder, placeholder(0, OTHER_GENERATION));
    assert.notEqual(first.maskedText, second.maskedText); assert.equal(first.candidates[0].rawValue, second.candidates[0].rawValue);
});

test("F06-P08 exact legacy and generation placeholders are skipped while later field ordinals remain stable", () => {
    const existing = `[SOTERAI_PROTECTED_${OTHER_GENERATION.replace(/-/g, "").toUpperCase()}_9]`;
    const text = `API_KEY=[SOTERAI_PROTECTED_API_KEY]\nTOKEN=${existing}\nPORT=7\nPASSWORD=${PRIVATE}\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    assert.equal(plan.candidates.length, 1); assert.equal(plan.candidates[0].key, "PASSWORD");
    assert.equal(plan.candidates[0].placeholder, placeholder(3));
    assert.equal(plan.maskedText, text.replace(PRIVATE, placeholder(3)));
    examples(plan, ["API_KEY", "TOKEN", "PORT", "PASSWORD"]);
});

for (const value of ["SOTERAI_PROTECTED_TOKEN", "before_SOTERAI_PROTECTED_TOKEN_after",
    "[SOTERAI_PROTECTED_TOKEN]suffix", "[SOTERAI_PROTECTED_token]"]) {
    test(`F06-P09 an accidental or malformed placeholder prefix is migrated rather than mistaken for protection (${value})`, () => {
        const text = `API_KEY=${value}\n`; const plan = createVaultMigrationPlan(text, true, GENERATION);
        assert.equal(plan.candidates.length, 1); assert.equal(plan.candidates[0].rawValue, value);
        assert.equal(plan.maskedText, `API_KEY=${placeholder(0)}\n`); examples(plan, ["API_KEY"]);
    });
}

test("F06-P10 comments containing a migrated candidate value fail closed instead of retaining or rewriting it", () => {
    for (const text of [`# private value copied here: ${PRIVATE}\nTOKEN=${PRIVATE}\n`,
        `TOKEN=${PRIVATE}  # copy ${PRIVATE}\n`, `TOKEN='${URL}'\n# ${URL}\n`])
        assert.throws(() => createVaultMigrationPlan(text, true, GENERATION));
});

test("F06-P11 examples include unique empty names only and never comments, multiline suffixes or public values", () => {
    const text = `# ${COMMENT}\nTOKEN='first\nSHADOW_SYNTHETIC=${PRIVATE}\nlast' # suffix note\nTOKEN=second\nPORT=5432\nPUBLIC_URL=https://synthetic.invalid/\n`;
    const plan = createVaultMigrationPlan(text, true, GENERATION);
    examples(plan, ["TOKEN", "PORT", "PUBLIC_URL"]);
    assert.ok(!plan.exampleText.includes("SHADOW_SYNTHETIC")); assert.ok(!plan.exampleText.includes("suffix"));
    assert.ok(!plan.exampleText.includes("5432")); assert.ok(!plan.exampleText.includes("synthetic.invalid"));
});

test("F06-P12 a repeated plan of already protected environment text is idempotent", () => {
    const original = `TOKEN=${PRIVATE}\nDATABASE_URL=${URL}\nPORT=5432\n`;
    const first = createVaultMigrationPlan(original, true, GENERATION);
    const second = createVaultMigrationPlan(first.maskedText, true, OTHER_GENERATION);
    assert.equal(second.candidates.length, 0); assert.equal(second.maskedText, first.maskedText);
    assert.equal(second.exampleText, first.exampleText);
});

test("F06-P13 non-environment standalone detector offsets preserve Unicode and unrelated JSON text", () => {
    const text = `{"label":"Useful 🍀 public control.","token":"${GITHUB}","count":7}`;
    const plan = createVaultMigrationPlan(text, false, GENERATION);
    assert.equal(plan.candidates.length, 1); const candidate = plan.candidates[0];
    assert.equal(candidate.rawValue, GITHUB); assert.equal(text.slice(candidate.start, candidate.end), GITHUB);
    assert.equal(candidate.placeholder, placeholder(0));
    assert.equal(plan.maskedText, text.replace(GITHUB, placeholder(0)));
    assert.deepEqual(JSON.parse(plan.maskedText), { label: "Useful 🍀 public control.", token: placeholder(0), count: 7 });
    allReplaced(plan, text); examples(plan);
});

test("F06-P14 multiple standalone credentials use distinct ordered offsets and replace independently", () => {
    const text = `Useful 🍀 prefix.\n${GITHUB}\nUnchanged middle.\n${OTHER_GITHUB}\nUseful suffix.\n`;
    const plan = createVaultMigrationPlan(text, false, GENERATION);
    assert.equal(plan.candidates.length, 2);
    assert.deepEqual(plan.candidates.map(candidate => candidate.rawValue), [GITHUB, OTHER_GITHUB]);
    assert.deepEqual(plan.candidates.map(candidate => candidate.placeholder), [placeholder(0), placeholder(1)]);
    assert.ok(plan.candidates[0].end <= plan.candidates[1].start);
    assert.equal(plan.maskedText, text.replace(GITHUB, placeholder(0)).replace(OTHER_GITHUB, placeholder(1)));
    allReplaced(plan, text); examples(plan);
});

test("F06-P15 unsupported environment syntax is unavailable rather than partially migrated or copied into examples", () => {
    for (const text of [`TOKEN=${PRIVATE}\nunsupported ${PRIVATE}\n`, `TOKEN="unclosed\nSHADOW_SYNTHETIC=${PRIVATE}\n`,
        `TOKEN="${PRIVATE}" unexpected suffix\n`, "not an assignment"]) assert.throws(() => createVaultMigrationPlan(text, true, GENERATION));
});

test("F06-P16 binary, control and oversized UTF-8 input are rejected in both document modes", () => {
    for (const environment of [true, false]) for (const text of [`TOKEN=${PRIVATE}\0`, `TOKEN=${PRIVATE}\x1b`,
        `TOKEN=${PRIVATE}\x9b`, "é".repeat(32_769)]) assert.throws(() => createVaultMigrationPlan(text, environment, GENERATION));
});

test("F06-P17 the environment field budget fails closed above 256 even when values look harmless", () => {
    const text = Array.from({ length: 257 }, (_, index) => `PUBLIC_${index}=x`).join("\n");
    assert.throws(() => createVaultMigrationPlan(text, true, GENERATION));
});

test("F06-P18 placeholder expansion cannot create a masked document above the supported byte budget", () => {
    const line = "TOKEN=xy\n";
    const text = "# " + "p".repeat(64 * 1024 - 3 - line.length) + "\n" + line;
    assert.equal(Buffer.byteLength(text, "utf8"), 64 * 1024);
    assert.throws(() => createVaultMigrationPlan(text, true, GENERATION));
});

test("F06-P19 only an actual UUID generation and boolean environment mode are accepted", () => {
    for (const generation of ["", "not-a-uuid", "-".repeat(36), "../outside", null, undefined])
        assert.throws(() => createVaultMigrationPlan(`TOKEN=${PRIVATE}\n`, true, generation as string));
    for (const environment of [null, undefined, "true", 1])
        assert.throws(() => createVaultMigrationPlan(`TOKEN=${PRIVATE}\n`, environment as unknown as boolean, GENERATION));
});

test("F06-P20 case-normalized generation metadata produces the same deterministic private plan", () => {
    const text = `TOKEN=${PRIVATE}\n`;
    assert.deepEqual(createVaultMigrationPlan(text, true, GENERATION.toUpperCase()), createVaultMigrationPlan(text, true, GENERATION));
});

test("F06-P21 empty supported input produces an empty useful plan in both modes", () => {
    for (const environment of [true, false]) {
        const plan = createVaultMigrationPlan("", environment, GENERATION);
        assert.equal(plan.maskedText, ""); assert.equal(plan.exampleText, ""); assert.deepEqual(plan.candidates, []);
    }
});
