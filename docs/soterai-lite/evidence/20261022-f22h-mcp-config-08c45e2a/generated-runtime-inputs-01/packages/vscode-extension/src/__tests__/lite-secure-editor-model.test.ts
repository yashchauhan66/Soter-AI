import assert from "node:assert/strict";
import { test } from "node:test";
import { SecureEditorModel } from "../project-privacy/SecureEditorModel";

// F05 model-only contracts. All data is synthetic and stays in process memory.
const VALUE = "SYNTHETIC_F05_PRIVATE_VALUE_20261014";
const COMMENT = "SYNTHETIC_F05_PRIVATE_COMMENT_20261014";
function field(model: SecureEditorModel, name: string, occurrence = 0) {
    const chosen = model.metadata().fields.filter(item => item.name === name)[occurrence];
    assert.ok(chosen, `Expected the synthetic ${name} field.`);
    return chosen;
}
function retainedOnFailure(model: SecureEditorModel, operation: () => unknown): void {
    const text = model.snapshotForStorage(); const metadata = model.metadata();
    assert.throws(operation);
    assert.equal(model.snapshotForStorage(), text);
    assert.deepEqual(model.metadata(), metadata);
}

test("F05-M01 metadata is deeply frozen and reveals only revision and opaque field descriptors", () => {
    const model = new SecureEditorModel(`# ${COMMENT}\nDATABASE_URL=${VALUE}\nEMPTY=\n`, true);
    const metadata = model.metadata();
    assert.deepEqual(Object.keys(metadata).sort(), ["fields", "revision"]);
    assert.ok(Number.isSafeInteger(metadata.revision));
    assert.equal(Object.isFrozen(metadata), true); assert.equal(Object.isFrozen(metadata.fields), true);
    assert.deepEqual(metadata.fields.map(item => item.name), ["DATABASE_URL", "EMPTY"]);
    for (const item of metadata.fields) {
        assert.deepEqual(Object.keys(item).sort(), ["editable", "id", "name"]);
        assert.equal(typeof item.id, "string"); assert.ok(item.id.length > 0);
        assert.equal(item.editable, true); assert.equal(Object.isFrozen(item), true);
    }
    const serialized = JSON.stringify(metadata);
    assert.ok(!serialized.includes(VALUE)); assert.ok(!serialized.includes(COMMENT));
    assert.doesNotMatch(serialized, /"(?:value|text|content|comment|length|size)"\s*:/);
});

test("F05-M02 supported assignment spacing, exports, inline comments and empty values are parsed privately", () => {
    const text = `  export FIRST = first-value  # ${COMMENT}\nSECOND='second value'\nTHIRD="third value"\nEMPTY=\n`;
    const model = new SecureEditorModel(text, true);
    assert.deepEqual(model.metadata().fields.map(item => item.name), ["FIRST", "SECOND", "THIRD", "EMPTY"]);
    assert.equal(model.readOwnerValue(field(model, "FIRST").id), "first-value");
    assert.equal(model.readOwnerValue(field(model, "SECOND").id), "second value");
    assert.equal(model.readOwnerValue(field(model, "THIRD").id), "third value");
    assert.equal(model.readOwnerValue(field(model, "EMPTY").id), "");
    assert.equal(model.snapshotForStorage(), text);
});

for (const [label, newline, bom] of [["LF", "\n", ""], ["CRLF", "\r\n", ""], ["BOM", "\r\n", "\uFEFF"]] as const) {
    test(`F05-M03 ${label} editing preserves every unrelated byte and line ending`, () => {
        const before = `${bom}# ${COMMENT}${newline}  export FIRST = old-value  # retained comment${newline}SECOND='untouched value'${newline}${newline}`;
        const model = new SecureEditorModel(before, true);
        const id = field(model, "FIRST").id; const revision = model.metadata().revision;
        model.applyOwnerValue(id, "new-value");
        assert.equal(model.readOwnerValue(field(model, "FIRST").id), "new-value");
        assert.equal(model.snapshotForStorage(), before.replace("old-value", "new-value"));
        assert.notEqual(model.metadata().revision, revision);
        assert.equal(model.readOwnerValue(field(model, "SECOND").id), "untouched value");
    });
}

test("F05-M04 duplicate names have distinct field ids and editing one preserves the other", () => {
    const model = new SecureEditorModel("DUPLICATE=first\nDUPLICATE=second\n", true);
    const first = field(model, "DUPLICATE", 0), second = field(model, "DUPLICATE", 1);
    assert.notEqual(first.id, second.id);
    assert.equal(model.readOwnerValue(first.id), "first"); assert.equal(model.readOwnerValue(second.id), "second");
    model.applyOwnerValue(second.id, "replacement");
    assert.equal(model.snapshotForStorage(), "DUPLICATE=first\nDUPLICATE=replacement\n");
    assert.equal(model.readOwnerValue(field(model, "DUPLICATE", 0).id), "first");
    assert.equal(model.readOwnerValue(field(model, "DUPLICATE", 1).id), "replacement");
});

for (const quote of ["'", '"', "`"] as const) {
    test(`F05-M05 ${quote}-quoted multiline values never create assignment-looking fields`, () => {
        const privateMultiline = `first line\n${VALUE}=private value data\nlast line`;
        const source = `MULTI=${quote}${privateMultiline}${quote}\nPUBLIC_FIELD=7\n`;
        const model = new SecureEditorModel(source, true);
        assert.deepEqual(model.metadata().fields.map(item => item.name), ["MULTI", "PUBLIC_FIELD"]);
        assert.equal(model.readOwnerValue(field(model, "MULTI").id), privateMultiline);
        assert.equal(model.readOwnerValue(field(model, "PUBLIC_FIELD").id), "7");
        assert.equal(model.snapshotForStorage(), source); assert.ok(!JSON.stringify(model.metadata()).includes(VALUE));
    });
}

test("F05-M06 owner edits with spaces and punctuation round-trip through a fresh private parser", () => {
    const model = new SecureEditorModel("SELECTED=old\nOTHER=unchanged\n", true);
    const replacement = "new value # stored punctuation = : /";
    model.applyOwnerValue(field(model, "SELECTED").id, replacement);
    const reopened = new SecureEditorModel(model.snapshotForStorage(), true);
    assert.equal(reopened.readOwnerValue(field(reopened, "SELECTED").id), replacement);
    assert.equal(reopened.readOwnerValue(field(reopened, "OTHER").id), "unchanged");
    assert.equal(reopened.metadata().fields.length, 2);
});

test("F05-M07 quotes and backslashes in an owner value are encoded without changing its private value", () => {
    const model = new SecureEditorModel("SELECTED=old\nOTHER=unchanged\n", true);
    const replacement = "Both 'single' and \"double\" quotes; C:\\synthetic\\file.";
    model.applyOwnerValue(field(model, "SELECTED").id, replacement);
    const reopened = new SecureEditorModel(model.snapshotForStorage(), true);
    assert.equal(reopened.readOwnerValue(field(reopened, "SELECTED").id), replacement);
    assert.equal(reopened.readOwnerValue(field(reopened, "OTHER").id), "unchanged");
});

test("F05-M08 a new multiline owner value remains one field and preserves adjoining lines", () => {
    const model = new SecureEditorModel("BEFORE=unchanged\nSELECTED=old\nAFTER=also-unchanged\n", true);
    const replacement = `first\n${VALUE}=still value data\nlast`;
    model.applyOwnerValue(field(model, "SELECTED").id, replacement);
    const reopened = new SecureEditorModel(model.snapshotForStorage(), true);
    assert.deepEqual(reopened.metadata().fields.map(item => item.name), ["BEFORE", "SELECTED", "AFTER"]);
    assert.equal(reopened.readOwnerValue(field(reopened, "SELECTED").id), replacement);
    assert.equal(reopened.readOwnerValue(field(reopened, "BEFORE").id), "unchanged");
    assert.equal(reopened.readOwnerValue(field(reopened, "AFTER").id), "also-unchanged");
});

test("F05-M09 setting an empty value is useful and does not remove its field", () => {
    const model = new SecureEditorModel("SELECTED=old\n", true);
    model.applyOwnerValue(field(model, "SELECTED").id, "");
    const reopened = new SecureEditorModel(model.snapshotForStorage(), true);
    assert.equal(reopened.readOwnerValue(field(reopened, "SELECTED").id), "");
    assert.equal(reopened.metadata().fields.length, 1);
});

test("F05-M10 non-environment sensitive text is one masked metadata field with a private owner value", () => {
    const source = `${VALUE}\nSecond private line.\n`;
    const model = new SecureEditorModel(source, false);
    const metadata = model.metadata(); assert.equal(metadata.fields.length, 1);
    assert.equal(metadata.fields[0].editable, true);
    assert.ok(!JSON.stringify(metadata).includes(VALUE));
    assert.equal(model.readOwnerValue(metadata.fields[0].id), source);
    model.applyOwnerValue(metadata.fields[0].id, "Replacement private document.\n");
    assert.equal(model.snapshotForStorage(), "Replacement private document.\n");
});

for (const [label, source] of [["unsupported line", `VALID=one\nunsupported ${VALUE}\n`],
    ["unclosed quote", `MULTI="first\n${VALUE}=private data\n`],
    ["quoted trailing syntax", `VALID="one" unexpected ${VALUE}\n`]] as const) {
    test(`F05-M11 ${label} becomes a masked noneditable contents field and retains source bytes`, () => {
        const model = new SecureEditorModel(source, true); const metadata = model.metadata();
        assert.equal(metadata.fields.length, 1); assert.equal(metadata.fields[0].editable, false);
        assert.ok(!JSON.stringify(metadata).includes(VALUE));
        assert.equal(model.snapshotForStorage(), source);
        retainedOnFailure(model, () => model.applyOwnerValue(metadata.fields[0].id, "replacement"));
    });
}

test("F05-M12 empty and comment-only environment files have no invented value fields", () => {
    for (const source of ["", `# ${COMMENT}\n\n`, `\uFEFF# ${COMMENT}\r\n`]) {
        const model = new SecureEditorModel(source, true);
        assert.equal(model.metadata().fields.length, 0); assert.equal(model.snapshotForStorage(), source);
        assert.ok(!JSON.stringify(model.metadata()).includes(COMMENT));
    }
});

test("F05-M13 constructor rejects NUL and terminal control characters in either document mode", () => {
    for (const environment of [false, true]) for (const control of ["\0", "\x01", "\x1b", "\x7f", "\x9b"])
        assert.throws(() => new SecureEditorModel(`VALUE=public${control}${VALUE}`, environment));
});

test("F05-M14 the 64 KiB UTF-8 input limit accepts its exact boundary and rejects byte overflow", () => {
    const exact = "é".repeat(32_768);
    assert.equal(Buffer.byteLength(exact, "utf8"), 64 * 1024);
    const model = new SecureEditorModel(exact, false); assert.equal(model.snapshotForStorage(), exact);
    assert.throws(() => new SecureEditorModel(exact + "a", false));
    assert.throws(() => new SecureEditorModel("é".repeat(32_769), false));
});

test("F05-M15 exactly 256 environment fields are supported and a 257th fails closed", () => {
    const source = Array.from({ length: 256 }, (_, index) => `FIELD_${index}=value`).join("\n");
    assert.equal(new SecureEditorModel(source, true).metadata().fields.length, 256);
    assert.throws(() => new SecureEditorModel(source + "\nOVER_BUDGET=value", true));
});

test("F05-M16 unknown field ids reveal nothing and failed edits preserve revision and draft", () => {
    const model = new SecureEditorModel(`SELECTED=${VALUE}\n`, true);
    assert.throws(() => model.readOwnerValue("unissued-field-id"));
    retainedOnFailure(model, () => model.applyOwnerValue("unissued-field-id", "replacement"));
});

test("F05-M17 owner value byte overflow cannot mutate a valid draft", () => {
    const model = new SecureEditorModel("SELECTED=old\nOTHER=unchanged\n", true);
    retainedOnFailure(model, () => model.applyOwnerValue(field(model, "SELECTED").id, "é".repeat(32_769)));
});

test("F05-M18 invalid owner value control characters leave the original revision and text intact", () => {
    const model = new SecureEditorModel("SELECTED=old\n", true);
    for (const control of ["\0", "\x01", "\x1b", "\x7f", "\x9b"])
        retainedOnFailure(model, () => model.applyOwnerValue(field(model, "SELECTED").id, `new${control}${VALUE}`));
});

test("F05-M19 restore privately supports undo and redo while advancing revision", () => {
    const original = `SELECTED=${VALUE}\nOTHER=unchanged\n`;
    const model = new SecureEditorModel(original, true); const revision = model.metadata().revision;
    model.applyOwnerValue(field(model, "SELECTED").id, "edited"); const edited = model.snapshotForStorage();
    const editedRevision = model.metadata().revision;
    model.restoreFromStorage(original); assert.equal(model.snapshotForStorage(), original);
    assert.notEqual(model.metadata().revision, revision); assert.notEqual(model.metadata().revision, editedRevision);
    assert.equal(model.readOwnerValue(field(model, "SELECTED").id), VALUE);
    model.restoreFromStorage(edited); assert.equal(model.snapshotForStorage(), edited);
    assert.equal(model.readOwnerValue(field(model, "SELECTED").id), "edited");
    assert.ok(!JSON.stringify(model.metadata()).includes(VALUE));
});

test("F05-M20 invalid restore operations retain the whole previous draft and revision", () => {
    const model = new SecureEditorModel("SELECTED=valid\n", true);
    for (const source of [`VALUE=${VALUE}\0`, "é".repeat(32_769),
        Array.from({ length: 257 }, (_, index) => `FIELD_${index}=value`).join("\n")])
        retainedOnFailure(model, () => model.restoreFromStorage(source));
});

test("F05-M21 owner strings are stored literally without shell interpolation", () => {
    const model = new SecureEditorModel("SELECTED=old\n", true);
    const literal = "${PUBLIC_NAME} and $(synthetic-name) are literal stored text";
    model.applyOwnerValue(field(model, "SELECTED").id, literal);
    const reopened = new SecureEditorModel(model.snapshotForStorage(), true);
    assert.equal(reopened.readOwnerValue(field(reopened, "SELECTED").id), literal);
});
