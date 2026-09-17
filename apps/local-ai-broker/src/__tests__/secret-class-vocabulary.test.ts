/**
 * The secret-class vocabulary is DUPLICATED on purpose, and this pins it.
 *
 * guard-core emits high-risk secret class names as scan categories.
 * `soterai hook` keys its block/allow policy on exactly those names, but it
 * cannot import guard-core — the CLI depends on @soterai/ide-protocol, which is
 * dependency-free by contract. So the list is mirrored there.
 *
 * A mirrored list that nobody checks is a silent hole: add a detector to
 * guard-core, and the hook keeps allowing that class forever with no error
 * anywhere. This broker test is the only place in the repo that can see both
 * packages, so it is where the two lists get pinned together.
 *
 * If this fails, it is not the test being brittle — a credential class exists
 * that the hook will not block. Update `HIGH_RISK_SECRET_CLASSES` in
 * @soterai/ide-protocol to match.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HIGH_RISK_SECRET_CLASS_NAMES, findSurvivingSecrets } from "@soterai/guard-core";
import { HIGH_RISK_SECRET_CLASSES, isHighRiskSecretClass } from "@soterai/ide-protocol";

describe("high-risk secret class vocabulary", () => {
    it("the protocol mirror matches guard-core exactly", () => {
        const source = [...HIGH_RISK_SECRET_CLASS_NAMES].sort();
        const mirror = [...HIGH_RISK_SECRET_CLASSES].sort();

        const missing = source.filter((n) => !mirror.includes(n));
        const extra = mirror.filter((n) => !source.includes(n));

        assert.deepEqual(
            missing, [],
            `guard-core detects ${missing.join(", ")} but the protocol mirror omits it, so "soterai hook" ` +
            "will NOT block that credential class. Add it to HIGH_RISK_SECRET_CLASSES.",
        );
        assert.deepEqual(
            extra, [],
            `the protocol mirror lists ${extra.join(", ")}, which guard-core never emits — the hook is ` +
            "keyed on a category that can never appear. Remove it from HIGH_RISK_SECRET_CLASSES.",
        );
    });

    it("the mirrored names are the ones findSurvivingSecrets actually returns", () => {
        // Bind the vocabulary to real scanner OUTPUT, not just to the other
        // array: two lists can agree with each other and both be wrong.
        const synthetic = `sk-${"Qv7mTb2LxK9dR4hZ8sN6pW3yJ1cF5gA0uE7iO2rY4tXn"}`;
        const survivors = findSurvivingSecrets(`token=${synthetic}`);
        assert.ok(survivors.length > 0, "the synthetic key fixture no longer matches any pattern");
        for (const name of survivors) {
            assert.ok(
                isHighRiskSecretClass(name),
                `findSurvivingSecrets returned "${name}", which the hook does not recognise as high-risk`,
            );
        }
    });
});
