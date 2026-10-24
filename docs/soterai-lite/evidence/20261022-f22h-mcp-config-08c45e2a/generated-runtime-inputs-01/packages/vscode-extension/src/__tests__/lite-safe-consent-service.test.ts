import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test, type TestContext } from "node:test";
import { ProjectFileAccess, type AccessDependencies, type AccessReceipt, type AccessResult,
    type CapturedFile, type RequestSurface } from "../project-privacy/ProjectFileAccess";
import { buildSafeFileView, terminalSafeText } from "../project-privacy/SafeFileView";

// F04 service contracts exercise the real service and safe-view builder. No native
// UI, filesystem, credential source or clock delay is needed for these cases.
type ExactReceipt = AccessReceipt & { safeText: string; outputDigest: string; recipient: string };
type ConsentDependencies = AccessDependencies<string> & {
    recipient?: (target: string, surface: RequestSurface) => string;
    prepare?: (target: string) => Promise<void>;
};
const privateValue = "TEST_ONLY_F04_PRIVATE_VALUE_20261014";
const publicText = "Public operational documentation.\nSecond useful line.";
const digest = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const drain = async () => { await new Promise<void>(done => setImmediate(done)); };
function capture(overrides: Partial<CapturedFile> = {}): CapturedFile {
    return { workspace: "synthetic-project-A", relativePath: "restricted.txt", policyRevision: "revision-A",
        fileIdentity: "synthetic-inode-A", content: publicText, regionView: publicText, sensitive: false, ...overrides };
}
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(done => { resolve = done; });
    return { promise, resolve };
}
function observe(promise: Promise<AccessResult>): { result?: AccessResult } {
    const observed: { result?: AccessResult } = {};
    void promise.then(result => { observed.result = result; });
    return observed;
}
function own(t: TestContext, overrides: Partial<ConsentDependencies> = {}): ProjectFileAccess<string> {
    const deps: ConsentDependencies = { enabled: () => true, now: () => 0,
        capture: async () => capture(), confirm: async () => true, ...overrides };
    const access = new ProjectFileAccess<string>(deps);
    t.after(() => access.dispose());
    return access;
}
function fakeDeadline(t: TestContext): void { t.mock.timers.enable({ apis: ["setTimeout"] }); }
function isPreparing(access: ProjectFileAccess<string>): boolean {
    const lifecycle = access as ProjectFileAccess<string> & { isPreparing?: () => boolean };
    assert.equal(typeof lifecycle.isPreparing, "function", "the current request must expose preparation lifecycle metadata");
    return lifecycle.isPreparing!();
}
function withheld(result: AccessResult | undefined, status: string): void {
    assert.deepEqual(result, { status });
    assert.ok(!JSON.stringify(result).includes(privateValue));
}

for (const surface of ["safe-preview", "managed-read-terminal", "integration-command"] as const) {
    test(`F04 receipt previews exactly the released public text on ${surface}`, { timeout: 2_000 }, async t => {
        let receipt: ExactReceipt | undefined;
        const access = own(t, { recipient: (target, selected) => {
            assert.equal(target, "selected.txt"); assert.equal(selected, surface); return "synthetic-internal-recipient";
        }, confirm: async item => { receipt = item as ExactReceipt; return true; } });
        assert.deepEqual(await access.request("selected.txt", surface),
            { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
        assert.ok(receipt);
        assert.equal(receipt.safeText, publicText);
        assert.equal(receipt.outputDigest, digest(publicText));
        assert.equal(receipt.recipient, "synthetic-internal-recipient");
        assert.equal(receipt.surface, surface);
        assert.equal(receipt.durationSeconds, 60);
        assert.equal(Object.isFrozen(receipt), true);
        assert.equal(Object.hasOwn(receipt, "content"), false);
        assert.equal(Object.hasOwn(receipt, "regionView"), false);
    });
}

test("F04 the fallback recipient is a fixed nonempty internal label", { timeout: 2_000 }, async t => {
    const recipients: unknown[] = [];
    const access = own(t, { confirm: async receipt => { recipients.push((receipt as ExactReceipt).recipient); return true; } });
    for (const surface of ["safe-preview", "managed-read-terminal", "integration-command"] as const)
        assert.equal((await access.request(`selected-${surface}.txt`, surface)).status, "ALLOWED_ONCE");
    assert.equal(typeof recipients[0], "string");
    assert.ok((recipients[0] as string).length > 0);
    assert.equal(new Set(recipients).size, 1);
});

test("F04 confirmation cannot mutate the immutable reviewed output or recipient", { timeout: 2_000 }, async t => {
    let receipt!: ExactReceipt;
    const access = own(t, { recipient: () => "internal-A", confirm: async item => {
        receipt = item as ExactReceipt;
        for (const [key, value] of [["safeText", privateValue], ["outputDigest", digest(privateValue)],
            ["recipient", "internal-B"], ["surface", "invented-surface"]] as const)
            assert.equal(Reflect.set(item, key, value), false, `${key} must be immutable`);
        return true;
    } });
    assert.deepEqual(await access.request("selected.txt", "safe-preview"),
        { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
    assert.equal(receipt.safeText, publicText); assert.equal(receipt.recipient, "internal-A");
});

test("F04 dotenv receipt and result mask every value including public-looking values and multiline data", { timeout: 2_000 }, async t => {
    const text = `# ${privateValue}\nDATABASE_URL=postgresql://synthetic:synthetic@db.invalid/private\nPORT=5432\nEMPTY=\nMULTI="first\n${privateValue}=value\nlast"\nPUBLIC=hello`;
    const expected = "DATABASE_URL=[MASKED]\nPORT=[MASKED]\nEMPTY=[MASKED]\nMULTI=[MASKED]\nPUBLIC=[MASKED]";
    let receipt!: ExactReceipt;
    const access = own(t, { capture: async () => capture({ relativePath: ".env", content: text, regionView: text, sensitive: true }),
        confirm: async item => { receipt = item as ExactReceipt; return true; } });
    assert.deepEqual(await access.request(".env", "integration-command"),
        { status: "ALLOWED_ONCE", kind: "environment-schema", text: expected });
    assert.equal(receipt.safeText, expected); assert.equal(receipt.outputDigest, digest(expected));
    assert.equal(receipt.fieldCount, 5);
    assert.doesNotMatch(JSON.stringify(receipt), /db\.invalid|postgresql|5432|hello|first|last/);
    assert.ok(!JSON.stringify(receipt).includes(privateValue));
});

test("F04 protected multiline dotenv never previews apparent names inside masked value data", { timeout: 2_000 }, async t => {
    const original = `MULTI="first\n${privateValue}=hidden\nlast"\nPUBLIC=7`;
    const regionView = `[MASKED REGION]\n${privateValue}=hidden\nlast"\nPUBLIC=7`;
    const expected = buildSafeFileView(".env", regionView, true, original).text;
    let preview = "";
    const access = own(t, { capture: async () => capture({ relativePath: ".env", content: original, regionView, sensitive: true }),
        confirm: async receipt => { preview = (receipt as ExactReceipt).safeText; return true; } });
    assert.deepEqual(await access.request(".env", "safe-preview"),
        { status: "ALLOWED_ONCE", kind: "sensitive-summary", text: expected });
    assert.equal(preview, expected); assert.ok(!preview.includes(privateValue)); assert.ok(!preview.includes("PUBLIC"));
});

test("F04 an ordinary protected region keeps useful adjacent public text in exact preview", { timeout: 2_000 }, async t => {
    const original = `Public ${privateValue} end.`; const regionView = "Public [OMITTED] end.";
    let receipt!: ExactReceipt;
    const access = own(t, { capture: async () => capture({ content: original, regionView }),
        confirm: async item => { receipt = item as ExactReceipt; return true; } });
    assert.deepEqual(await access.request("notes.txt", "safe-preview"),
        { status: "ALLOWED_ONCE", kind: "redacted-file", text: regionView });
    assert.equal(receipt.safeText, regionView); assert.equal(receipt.outputDigest, digest(regionView));
    assert.ok(!JSON.stringify(receipt).includes(privateValue));
});

for (const classification of ["marked", "recognized"] as const) {
    test(`F04 ${classification} sensitive files show only the same summary that is released`, { timeout: 2_000 }, async t => {
        let receipt!: ExactReceipt;
        const file = capture({ relativePath: classification === "recognized" ? "private.pem" : "notes.txt",
            content: privateValue, regionView: privateValue, sensitive: classification === "marked" });
        const expected = buildSafeFileView(file.relativePath, file.regionView, file.sensitive, file.content);
        const access = own(t, { capture: async () => file, confirm: async item => { receipt = item as ExactReceipt; return true; } });
        assert.deepEqual(await access.request(file.relativePath, "safe-preview"),
            { status: "ALLOWED_ONCE", kind: "sensitive-summary", text: expected.text });
        assert.equal(receipt.safeText, expected.text); assert.equal(receipt.outputDigest, digest(expected.text));
        assert.ok(!JSON.stringify(receipt).includes(privateValue));
    });
}

test("F04 managed terminal reviews its control-character-stripped payload before consent", { timeout: 2_000 }, async t => {
    const text = "Public\x1b]52;synthetic\x07\nSecond\x9b useful line.";
    const expected = terminalSafeText(buildSafeFileView("notes.txt", text).text);
    let receipt!: ExactReceipt;
    const access = own(t, { capture: async () => capture({ content: text, regionView: text }),
        confirm: async item => { receipt = item as ExactReceipt; return true; } });
    assert.deepEqual(await access.request("notes.txt", "managed-read-terminal"),
        { status: "ALLOWED_ONCE", kind: "redacted-file", text: expected });
    assert.equal(receipt.safeText, expected); assert.equal(receipt.outputDigest, digest(expected));
    assert.match(expected, /Public/); assert.match(expected, /\nSecond/); assert.doesNotMatch(expected, /[\x07\x1b\x9b]/);
});

for (const surface of ["invented-surface", "", null, undefined, { approved: true }]) {
    test(`F04 undeclared runtime surface ${JSON.stringify(surface)} is unavailable before capture or UI`, { timeout: 2_000 }, async t => {
        let captures = 0; let prompts = 0;
        const access = own(t, { capture: async () => { captures++; return capture(); },
            confirm: async () => { prompts++; return true; } });
        withheld(await access.request("selected.txt", surface as RequestSurface), "UNAVAILABLE");
        assert.equal(captures, 0); assert.equal(prompts, 0);
    });
}

test("F04 only boolean true authorizes a request", { timeout: 2_000 }, async t => {
    for (const answer of [false, undefined, null, "true", 1, { approved: true }]) {
        const access = own(t, { confirm: async () => answer as boolean });
        withheld(await access.request("selected.txt", "safe-preview"), "DENIED");
    }
});

for (const moment of ["first-capture", "confirmation", "fresh-capture"] as const) {
    test(`F04 changed recipient during ${moment} releases no text`, { timeout: 2_000 }, async t => {
        let recipient = "internal-A"; let captures = 0; let prompts = 0;
        const access = own(t, { recipient: () => recipient, capture: async () => {
            captures++;
            if ((moment === "first-capture" && captures === 1) || (moment === "fresh-capture" && captures === 2)) recipient = "internal-B";
            return capture();
        }, confirm: async () => { prompts++; if (moment === "confirmation") recipient = "internal-B"; return true; } });
        withheld(await access.request("selected.txt", "safe-preview"), "CHANGED");
        if (moment === "first-capture") assert.equal(prompts, 0, "changed destination must not be reviewed");
    });
}

for (const field of ["workspace", "relativePath", "policyRevision", "fileIdentity", "content", "regionView", "sensitive"] as const) {
    test(`F04 recapture rejects changed ${field} while preserving the original safe preview`, { timeout: 2_000 }, async t => {
        let approved = false; let receipt!: ExactReceipt;
        const changed = capture({ [field]: field === "sensitive" ? true : "changed-synthetic-value" });
        const access = own(t, { capture: async () => approved ? changed : capture(),
            confirm: async item => { receipt = item as ExactReceipt; approved = true; return true; } });
        withheld(await access.request("selected.txt", "safe-preview"), "CHANGED");
        assert.equal(receipt.safeText, publicText); assert.equal(receipt.outputDigest, digest(publicText));
    });
}

test("F04 exactly 16 KiB of UTF-8 safe output remains useful and can be reviewed", { timeout: 2_000 }, async t => {
    const text = "é".repeat(8_192); let preview = "";
    const access = own(t, { capture: async () => capture({ content: text, regionView: text }),
        confirm: async receipt => { preview = (receipt as ExactReceipt).safeText; return true; } });
    assert.deepEqual(await access.request("public.txt", "safe-preview"),
        { status: "ALLOWED_ONCE", kind: "redacted-file", text });
    assert.equal(Buffer.byteLength(preview, "utf8"), 16 * 1024); assert.equal(preview, text);
});

for (const format of ["ordinary", "environment"] as const) {
    test(`F04 ${format} output over 16 KiB is unavailable before confirmation`, { timeout: 2_000 }, async t => {
        const text = format === "ordinary" ? "é".repeat(8_193)
            : Array.from({ length: 170 }, (_, i) => `FIELD_${String(i).padStart(3, "0")}_${"A".repeat(90)}=synthetic`).join("\n");
        const relativePath = format === "environment" ? ".env" : "public.txt";
        assert.ok(Buffer.byteLength(text, "utf8") < 64 * 1024);
        assert.ok(Buffer.byteLength(buildSafeFileView(relativePath, text).text, "utf8") > 16 * 1024);
        let prompts = 0;
        const access = own(t, { capture: async () => capture({ relativePath, content: text, regionView: text }),
            confirm: async () => { prompts++; return true; } });
        withheld(await access.request(relativePath, "safe-preview"), "UNAVAILABLE"); assert.equal(prompts, 0);
    });
}

for (const input of ["oversized-original", "binary-original", "oversized-region", "binary-region"] as const) {
    test(`F04 ${input} is rejected even if the alternate captured view is small and safe`, { timeout: 2_000 }, async t => {
        const invalid = input.startsWith("oversized") ? "é".repeat(32_769) : `Public\0${privateValue}`;
        let prompts = 0;
        const file = capture(input.endsWith("original") ? { content: invalid, regionView: "Public [OMITTED]." }
            : { content: publicText, regionView: invalid });
        const access = own(t, { capture: async () => file, confirm: async () => { prompts++; return true; } });
        withheld(await access.request("selected.txt", "safe-preview"), "UNAVAILABLE"); assert.equal(prompts, 0);
    });
}

test("F04 unsupported dotenv syntax gives an exact withheld summary and never original text", { timeout: 2_000 }, async t => {
    let receipt!: ExactReceipt;
    const access = own(t, { capture: async () => capture({ relativePath: ".env", content: privateValue, regionView: privateValue }),
        confirm: async item => { receipt = item as ExactReceipt; return true; } });
    const result = await access.request(".env", "safe-preview");
    assert.equal(result.status, "ALLOWED_ONCE");
    if (result.status !== "ALLOWED_ONCE") assert.fail("the supported withheld summary is useful");
    assert.equal(receipt.safeText, result.text); assert.match(result.text, /withheld/);
    assert.ok(!JSON.stringify(receipt).includes(privateValue));
});

for (const stage of ["capture", "confirmation"] as const) {
    test(`F04 the 60-second deadline resolves an unanswered ${stage} without waiting for it`, { timeout: 2_000 }, async t => {
        fakeDeadline(t); let now = 0; let prompts = 0;
        const heldCapture = deferred<CapturedFile>(); const heldApproval = deferred<boolean>();
        t.after(() => { heldCapture.resolve(capture()); heldApproval.resolve(false); });
        const access = own(t, { now: () => now, capture: () => stage === "capture" ? heldCapture.promise : Promise.resolve(capture()),
            confirm: () => { prompts++; return heldApproval.promise; } });
        const pending = observe(access.request("selected.txt", "safe-preview")); await drain();
        assert.equal(prompts, stage === "capture" ? 0 : 1);
        now = 59_999; t.mock.timers.tick(59_999); await drain(); assert.equal(pending.result, undefined);
        now = 60_000; t.mock.timers.tick(1); await drain(); withheld(pending.result, "EXPIRED");
        heldCapture.resolve(capture()); heldApproval.resolve(true); await drain();
        withheld(pending.result, "EXPIRED");
        if (stage === "capture") assert.equal(prompts, 0, "late capture must not create a modal");
    });
}

test("F04 the owned deadline expires even when the injected elapsed clock does not advance", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const approval = deferred<boolean>(); t.after(() => approval.resolve(false));
    const access = own(t, { now: () => 0, confirm: () => approval.promise });
    const pending = observe(access.request("selected.txt", "safe-preview")); await drain();
    t.mock.timers.tick(60_000); await drain(); withheld(pending.result, "EXPIRED");
});

for (const action of ["revoke", "dispose"] as const) {
    for (const stage of ["capture", "confirmation"] as const) {
        test(`F04 ${action} immediately expires a request waiting on ${stage}`, { timeout: 2_000 }, async t => {
            fakeDeadline(t);
            const heldCapture = deferred<CapturedFile>(); const heldApproval = deferred<boolean>();
            t.after(() => { heldCapture.resolve(capture()); heldApproval.resolve(false); });
            const access = own(t, { capture: () => stage === "capture" ? heldCapture.promise : Promise.resolve(capture()),
                confirm: () => heldApproval.promise });
            const pending = observe(access.request("selected.txt", "safe-preview")); await drain();
            access[action](); await drain(); withheld(pending.result, "EXPIRED");
            heldCapture.resolve(capture()); heldApproval.resolve(true); await drain(); withheld(pending.result, "EXPIRED");
            if (action === "dispose") withheld(await access.request("next.txt", "safe-preview"), "UNAVAILABLE");
        });
    }
}

test("F04 a late revoked approval cannot clear a newer request's busy state or grant it", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const oldApproval = deferred<boolean>(); const newApproval = deferred<boolean>();
    t.after(() => { oldApproval.resolve(false); newApproval.resolve(false); });
    let prompts = 0;
    const access = own(t, { confirm: () => ++prompts === 1 ? oldApproval.promise : newApproval.promise });
    const oldRequest = observe(access.request("old.txt", "safe-preview")); await drain();
    access.revoke(); await drain(); withheld(oldRequest.result, "EXPIRED");
    const newRequest = observe(access.request("new.txt", "safe-preview")); await drain();
    assert.equal(prompts, 2); assert.equal(newRequest.result, undefined);
    oldApproval.resolve(true); await drain(); withheld(oldRequest.result, "EXPIRED"); assert.equal(newRequest.result, undefined);
    withheld(await access.request("third.txt", "safe-preview"), "BUSY");
    newApproval.resolve(true); await drain();
    assert.deepEqual(newRequest.result, { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
});

test("F04 late expired capture cannot open UI or hold a newer request busy", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const oldCapture = deferred<CapturedFile>(); const newApproval = deferred<boolean>();
    t.after(() => { oldCapture.resolve(capture()); newApproval.resolve(false); });
    let captures = 0; let prompts = 0;
    const access = own(t, { capture: () => ++captures === 1 ? oldCapture.promise : Promise.resolve(capture()),
        confirm: () => { prompts++; return newApproval.promise; } });
    const oldRequest = observe(access.request("old.txt", "safe-preview")); await drain();
    t.mock.timers.tick(60_000); await drain(); withheld(oldRequest.result, "EXPIRED");
    const newRequest = observe(access.request("new.txt", "safe-preview")); await drain();
    assert.equal(prompts, 1); assert.equal(newRequest.result, undefined);
    oldCapture.resolve(capture()); await drain(); assert.equal(prompts, 1); withheld(oldRequest.result, "EXPIRED");
    withheld(await access.request("third.txt", "safe-preview"), "BUSY");
    newApproval.resolve(true); await drain();
    assert.deepEqual(newRequest.result, { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
});

test("F04 finishing an old request clears its timer instead of expiring a newer request", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const approval = deferred<boolean>(); t.after(() => approval.resolve(false));
    let prompts = 0;
    const access = own(t, { confirm: () => ++prompts === 1 ? Promise.resolve(false) : approval.promise });
    withheld(await access.request("first.txt", "safe-preview"), "DENIED");
    t.mock.timers.tick(30_000);
    const next = observe(access.request("next.txt", "safe-preview")); await drain();
    t.mock.timers.tick(30_000); await drain(); assert.equal(next.result, undefined);
    approval.resolve(true); await drain();
    assert.deepEqual(next.result, { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
});

test("F04 preparation completes inside the request before content capture or approval", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const preparation = deferred<void>(); t.after(() => preparation.resolve());
    let prepares = 0; let captures = 0; let prompts = 0;
    const access = own(t, { prepare: target => {
        assert.equal(target, "selected.txt"); prepares++; return preparation.promise;
    }, capture: async () => { captures++; return capture(); }, confirm: async () => { prompts++; return true; } });
    const pending = observe(access.request("selected.txt", "safe-preview")); await drain();
    assert.equal(prepares, 1); assert.equal(captures, 0); assert.equal(prompts, 0);
    assert.equal(isPreparing(access), true); assert.equal(pending.result, undefined);
    preparation.resolve(); await drain();
    assert.equal(isPreparing(access), false); assert.equal(captures, 2); assert.equal(prompts, 1);
    assert.deepEqual(pending.result, { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
});

test("F04 a hung preparation expires at the owned deadline and never captures content later", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const preparation = deferred<void>(); t.after(() => preparation.resolve());
    let captures = 0; let prompts = 0;
    const access = own(t, { prepare: () => preparation.promise, capture: async () => { captures++; return capture(); },
        confirm: async () => { prompts++; return true; } });
    const pending = observe(access.request("selected.txt", "safe-preview")); await drain();
    assert.equal(captures, 0); assert.equal(prompts, 0); assert.equal(isPreparing(access), true);
    t.mock.timers.tick(60_000); await drain(); withheld(pending.result, "EXPIRED");
    assert.equal(isPreparing(access), false);
    preparation.resolve(); await drain(); withheld(pending.result, "EXPIRED");
    assert.equal(captures, 0); assert.equal(prompts, 0); assert.equal(isPreparing(access), false);
});

test("F04 late revoked preparation cannot clear the newer request's preparation ownership", { timeout: 2_000 }, async t => {
    fakeDeadline(t);
    const oldPreparation = deferred<void>(); const newPreparation = deferred<void>();
    t.after(() => { oldPreparation.resolve(); newPreparation.resolve(); });
    let prepares = 0; let captures = 0;
    const access = own(t, { prepare: () => ++prepares === 1 ? oldPreparation.promise : newPreparation.promise,
        capture: async () => { captures++; return capture(); } });
    const oldRequest = observe(access.request("old.txt", "safe-preview")); await drain();
    assert.equal(isPreparing(access), true); access.revoke(); await drain();
    withheld(oldRequest.result, "EXPIRED"); assert.equal(isPreparing(access), false);
    const newer = observe(access.request("new.txt", "safe-preview")); await drain();
    assert.equal(prepares, 2); assert.equal(isPreparing(access), true); assert.equal(captures, 0);
    oldPreparation.resolve(); await drain();
    withheld(oldRequest.result, "EXPIRED"); assert.equal(newer.result, undefined);
    assert.equal(isPreparing(access), true); assert.equal(captures, 0);
    withheld(await access.request("third.txt", "safe-preview"), "BUSY");
    newPreparation.resolve(); await drain();
    assert.equal(isPreparing(access), false); assert.equal(captures, 2);
    assert.deepEqual(newer.result, { status: "ALLOWED_ONCE", kind: "redacted-file", text: publicText });
});
