import assert from "node:assert/strict";
import { test } from "node:test";
const key = "pk_test_F21PUBLICSYNTHETICONLY123456";
const provider = "sk-proj-" + "SYNTHETIC_F07_PROVIDER_ONLY_VALUE".repeat(2);
const inspect = async (text: string) => (await import("../history-hooks/StagedContent")).inspectStagedBlob(".env.example", Buffer.from(text));
test("F26a parsed public Stripe field keeps its canonical public decision", async () => {
    assert.deepEqual(await inspect("STRIPE_PUBLISHABLE_KEY=" + key + "\n"), { status: "CLEAN" });
});
test("F26a public field context cannot suppress a provider in its retained comment", async () => {
    assert.deepEqual(await inspect("STRIPE_PUBLISHABLE_KEY=" + key + " # " + provider + "\n"), { status: "CANDIDATE" });
});
test("F26a public field does not exempt private Stripe material or a private sibling", async () => {
    assert.deepEqual(await inspect("STRIPE_PUBLISHABLE_KEY=" + key + "\nPASSWORD=" + provider + "\n"), { status: "CANDIDATE" });
    assert.deepEqual(await inspect("STRIPE_PUBLISHABLE_KEY=sk_test_SYNTHETIC_PRIVATE_VALUE123456789012\n"), { status: "CANDIDATE" });
});
test("F26a an ordinary noncredential field retains canonical encoded provider matching", async () => {
    assert.deepEqual(await inspect("MONKEY=" + Buffer.from(provider).toString("base64") + "\n"), { status: "CANDIDATE" });
});
