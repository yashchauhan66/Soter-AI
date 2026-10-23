import assert from "node:assert/strict";
import { test } from "node:test";
import {
    createOwnerReviewPlan, validateOwnerReview, OwnerReviewAttempt,
    REVIEW_COOLDOWN_MS, REVIEW_LIFETIME_MS,
    parseReviewAudit, MAX_REVIEW_AUDIT_RECORDS, MAX_REVIEW_AUDIT_BYTES,
} from "../ai-boundary/OwnerReviewProtocol";

// All values are synthetic. These tests have no VS Code host, workspace reads,
// credential configuration, timers, subprocesses or external service dependency.
const ROOT = "C:/synthetic-project";
const RULE = "a".repeat(64);
const REVISION = "b".repeat(64);
const START = 1_000_000;
const NONCE = "a3427b36-46ba-4d84-82e5-c5dfb5ba5dd1";
const plan = () => createOwnerReviewPlan(ROOT, RULE, REVISION, START, NONCE);
const entry = (index = 1) => ({
    id: `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    at: START + index,
    mode: "ordinary" as const,
    ruleDigest: RULE,
    revisionDigest: REVISION,
    outcome: "REVIEWED_SESSION" as const,
});
const audit = () => ({ schemaVersion: 1, records: [entry()] });

test("F03-P01 owner review binds the exact root, rule, revision and nonce to a bounded review window", () => {
    assert.equal(REVIEW_COOLDOWN_MS, 10_000);
    assert.equal(REVIEW_LIFETIME_MS, 60_000);
    const review = plan();
    assert.equal(review.root, ROOT);
    assert.equal(review.ruleDigest, RULE);
    assert.equal(review.revisionDigest, REVISION);
    assert.equal(review.createdAt, START);
    assert.equal(review.cooldownUntil, START + REVIEW_COOLDOWN_MS);
    assert.equal(review.expiresAt, START + REVIEW_LIFETIME_MS);
    assert.equal(review.nonce, NONCE);
    assert.equal(typeof review.challenge, "string");
    assert.ok(review.challenge.length > 0);
});

test("F03-P02 the default review nonce creates a fresh challenge for each independent owner dialog", () => {
    const first = createOwnerReviewPlan(ROOT, RULE, REVISION, START);
    const second = createOwnerReviewPlan(ROOT, RULE, REVISION, START);
    assert.match(first.nonce, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.notEqual(first.nonce, second.nonce);
    assert.notEqual(first.challenge, second.challenge);
    assert.equal(validateOwnerReview(second, first.challenge, second.cooldownUntil, ROOT, RULE, REVISION), false);
});

test("F03-P03 cooldown and expiry boundaries permit only the completed unexpired review interval", () => {
    const review = plan();
    for (const now of [START - 1, START, review.cooldownUntil - 1]) {
        assert.equal(validateOwnerReview(review, review.challenge, now, ROOT, RULE, REVISION), false, `time ${now}`);
    }
    assert.equal(validateOwnerReview(review, review.challenge, review.cooldownUntil, ROOT, RULE, REVISION), true);
    assert.equal(validateOwnerReview(review, review.challenge, review.expiresAt - 1, ROOT, RULE, REVISION), true);
    assert.equal(validateOwnerReview(review, review.challenge, review.expiresAt, ROOT, RULE, REVISION), false);
    assert.equal(validateOwnerReview(review, review.challenge, review.expiresAt + 1, ROOT, RULE, REVISION), false);
    for (const now of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        assert.equal(validateOwnerReview(review, review.challenge, now, ROOT, RULE, REVISION), false);
    }
});

test("F03-P04 cancellation and altered confirmation text never validate", () => {
    const review = plan();
    for (const typed of [undefined, "", "confirm", `${review.challenge} `, ` ${review.challenge}`, `${review.challenge}\n`, review.challenge + "x"]) {
        assert.equal(validateOwnerReview(review, typed, review.cooldownUntil, ROOT, RULE, REVISION), false);
    }
    assert.equal(validateOwnerReview(review, review.challenge, review.cooldownUntil, ROOT, RULE, REVISION), true);
});

test("F03-P05 workspace, rule and policy revision drift invalidate an otherwise exact owner response", () => {
    const review = plan();
    const mutations = [
        [ROOT + "/other", RULE, REVISION],
        [ROOT.toUpperCase(), RULE, REVISION],
        [ROOT + "/", RULE, REVISION],
        [ROOT, "c".repeat(64), REVISION],
        [ROOT, RULE, "d".repeat(64)],
        [ROOT, "", REVISION],
        [ROOT, RULE, ""],
    ];
    for (const [root, rule, revision] of mutations) {
        assert.equal(validateOwnerReview(review, review.challenge, review.cooldownUntil, root, rule, revision), false);
    }
});

test("F03-P06 one accepted attempt cannot authorize a second session action", () => {
    const review = plan();
    const attempt = new OwnerReviewAttempt(review);
    assert.equal(attempt.consume(review.challenge, review.cooldownUntil, ROOT, RULE, REVISION), true);
    assert.equal(attempt.consume(review.challenge, review.cooldownUntil + 1, ROOT, RULE, REVISION), false);
});

test("F03-P07 cancellation, typo, early response, expiry and drift each burn their attempted review", () => {
    const review = plan();
    const invalid = [
        { typed: undefined, now: review.cooldownUntil, root: ROOT, rule: RULE, revision: REVISION },
        { typed: review.challenge + "x", now: review.cooldownUntil, root: ROOT, rule: RULE, revision: REVISION },
        { typed: review.challenge, now: review.cooldownUntil - 1, root: ROOT, rule: RULE, revision: REVISION },
        { typed: review.challenge, now: review.expiresAt, root: ROOT, rule: RULE, revision: REVISION },
        { typed: review.challenge, now: review.cooldownUntil, root: ROOT + "/other", rule: RULE, revision: REVISION },
        { typed: review.challenge, now: review.cooldownUntil, root: ROOT, rule: "c".repeat(64), revision: REVISION },
        { typed: review.challenge, now: review.cooldownUntil, root: ROOT, rule: RULE, revision: "d".repeat(64) },
    ];
    for (const input of invalid) {
        const attempt = new OwnerReviewAttempt(review);
        assert.equal(attempt.consume(input.typed, input.now, input.root, input.rule, input.revision), false);
        assert.equal(attempt.consume(review.challenge, review.cooldownUntil, ROOT, RULE, REVISION), false);
    }
});

test("F03-P08 metadata audit accepts ordinary and sensitive session reviews without a raw-release outcome", () => {
    const raw = { schemaVersion: 1, records: [entry(), { ...entry(2), mode: "sensitive" }] };
    assert.deepEqual(parseReviewAudit(raw), raw);
    assert.deepEqual(parseReviewAudit({ schemaVersion: 1, records: [] }), { schemaVersion: 1, records: [] });
    for (const outcome of ["ALLOWED", "RAW_APPROVED", "REMOVED", "REVIEWED_PERMANENT", "", undefined]) {
        assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [{ ...entry(), outcome }] }));
    }
});

test("F03-P09 audit schema rejects corrupt, future, missing and extra top-level metadata", () => {
    for (const raw of [undefined, null, [], "{}", 1, {}, { records: [] },
        { schemaVersion: "1", records: [] }, { schemaVersion: 2, records: [] },
        { schemaVersion: 1, records: undefined }, { schemaVersion: 1, records: {} },
        { ...audit(), allowOriginalSecrets: true }, { ...audit(), schemaVersion: 1, workspaceRoot: ROOT }]) {
        assert.throws(() => parseReviewAudit(raw));
    }
});

test("F03-P10 each audit entry requires every field and rejects unrelated content channels", () => {
    const good = entry();
    for (const key of Object.keys(good)) {
        const missing: Record<string, unknown> = { ...good };
        delete missing[key];
        assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [missing] }), key);
    }
    for (const record of [null, [], "text", { ...good, path: "private.txt" },
        { ...good, typedConfirmation: "SYNTHETIC_CONFIRMATION" },
        { ...good, fileContent: "SYNTHETIC_CONTENT_NEVER_AUDITED" },
        { ...good, value: "SYNTHETIC_VALUE_NEVER_AUDITED" }]) {
        assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [record] }));
    }
});

test("F03-P11 audit identifiers, times, modes and digests reject wrong types and malformed values", () => {
    const good = entry();
    const badFields: Record<string, unknown[]> = {
        id: ["", "record-1", "00000000-0000-4000-8000-00000000000g", 1, undefined],
        at: [-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, "1000", null],
        mode: ["raw", "Sensitive", "", true, null],
        ruleDigest: ["", "a".repeat(63), "a".repeat(65), "g".repeat(64), 1, null],
        revisionDigest: ["", "b".repeat(63), "b".repeat(65), "z".repeat(64), 1, null],
    };
    for (const [key, values] of Object.entries(badFields)) {
        for (const value of values) {
            assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [{ ...good, [key]: value }] }), key);
        }
    }
    assert.equal(parseReviewAudit({ schemaVersion: 1, records: [{ ...good, at: 0 }] }).records[0].at, 0);
});

test("F03-P12 a repeated review UUID cannot create duplicate or conflicting audit claims", () => {
    const first = entry();
    assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [first, { ...first }] }));
    assert.throws(() => parseReviewAudit({ schemaVersion: 1, records: [first, { ...first, mode: "sensitive", at: START + 2 }] }));
    assert.equal(parseReviewAudit({ schemaVersion: 1, records: [first, entry(2)] }).records.length, 2);
});

test("F03-P13 audit record and byte budgets reject over-limit retained metadata", () => {
    assert.equal(MAX_REVIEW_AUDIT_RECORDS, 64);
    assert.equal(MAX_REVIEW_AUDIT_BYTES, 32_768);
    const records = Array.from({ length: MAX_REVIEW_AUDIT_RECORDS }, (_, index) => entry(index + 1));
    const raw = { schemaVersion: 1, records };
    assert.ok(Buffer.byteLength(JSON.stringify(raw), "utf8") < MAX_REVIEW_AUDIT_BYTES);
    assert.equal(parseReviewAudit(raw).records.length, MAX_REVIEW_AUDIT_RECORDS);
    assert.throws(() => parseReviewAudit({ ...raw, records: [...records, entry(65)] }));
    const oversized = { ...audit(), content: "x".repeat(MAX_REVIEW_AUDIT_BYTES) };
    assert.ok(Buffer.byteLength(JSON.stringify(oversized), "utf8") > MAX_REVIEW_AUDIT_BYTES);
    assert.throws(() => parseReviewAudit(oversized));
});

test("F03-P14 parsed audit records are detached from caller mutations in both directions", () => {
    const raw = audit();
    const parsed = parseReviewAudit(raw);
    parsed.records[0].ruleDigest = "c".repeat(64);
    parsed.records.push(entry(2));
    assert.equal(raw.records[0].ruleDigest, RULE);
    assert.equal(raw.records.length, 1);
    const another = parseReviewAudit(raw);
    raw.records[0].revisionDigest = "d".repeat(64);
    raw.records.splice(0, 1);
    assert.equal(another.records[0].revisionDigest, REVISION);
    assert.equal(another.records.length, 1);
});

test("F03-P15 parsing valid frozen audit input does not mutate persisted metadata", () => {
    const record = Object.freeze(entry());
    const records = Object.freeze([record]);
    const raw = Object.freeze({ schemaVersion: 1, records });
    assert.deepEqual(parseReviewAudit(raw), raw);
});
