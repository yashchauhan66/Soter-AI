"use strict";
// Shared exact-byte admission only. Importing this module launches no child.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../..");
const dRoot = "D:\\SoterAI-Lite-test-profiles";
const sha = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const inside = (base, candidate) => { const rel = path.relative(path.resolve(base), path.resolve(candidate)); return rel === "" || !rel.startsWith("..") && !path.isAbsolute(rel); };
function ordinaryFile(filename, maximum = 400 * 1024 * 1024, singleLink = true) {
    assert(path.isAbsolute(filename), "Absolute file required.");
    const before = fs.lstatSync(filename);
    assert(before.isFile() && !before.isSymbolicLink(), "Ordinary file required.");
    assert(before.size <= maximum && (!singleLink || before.nlink === 1), "Bounded single-link file required.");
    assert.equal(path.resolve(fs.realpathSync.native(filename)).toLowerCase(), path.resolve(filename).toLowerCase(), "Resolved path differs.");
    return before;
}
function pin(row, options = {}) {
    assert(row && typeof row.path === "string" && Number.isSafeInteger(row.bytes) && /^[a-f0-9]{64}$/.test(row.sha256), "Exact file pin required.");
    const filename = path.isAbsolute(row.path) ? path.resolve(row.path) : path.resolve(root, row.path);
    if (!path.isAbsolute(row.path)) assert(inside(root, filename), "Relative input escapes workspace.");
    const before = ordinaryFile(filename, options.maximum, options.singleLink !== false);
    const raw = fs.readFileSync(filename);
    const after = fs.lstatSync(filename);
    assert.equal(raw.length, row.bytes); assert.equal(sha(raw), row.sha256);
    assert.equal(after.ino, before.ino); assert.equal(after.dev, before.dev); assert.equal(after.size, before.size); assert.equal(after.mtimeMs, before.mtimeMs);
    return { filename, raw };
}
function readJson(filename, maximum = 8 * 1024 * 1024) {
    ordinaryFile(path.resolve(filename), maximum);
    return JSON.parse(fs.readFileSync(filename, "utf8").replace(/^\uFEFF/, ""));
}
function dDirectory(filename) {
    assert(path.isAbsolute(filename) && inside(dRoot, filename) && path.resolve(filename) !== path.resolve(dRoot), "Ordinary owned D subdirectory required.");
    const absolute = path.resolve(filename);
    const rel = path.relative(dRoot, absolute);
    let current = dRoot;
    for (const part of ["", ...rel.split(path.sep)]) {
        if (part) current = path.join(current, part);
        const stat = fs.lstatSync(current);
        assert(stat.isDirectory() && !stat.isSymbolicLink(), "No linked profile ancestor permitted.");
        assert.equal(path.resolve(fs.realpathSync.native(current)).toLowerCase(), path.resolve(current).toLowerCase());
    }
    return absolute;
}
function newDirectory(parent, name) {
    parent = dDirectory(parent); assert(/^[a-zA-Z0-9_-]{1,80}$/.test(name));
    const output = path.join(parent, name); assert(!fs.existsSync(output), "Refuse existing run/profile directory.");
    fs.mkdirSync(output); return dDirectory(output);
}
function writeJson(filename, value) {
    assert(inside(__dirname, filename) || inside(dRoot, filename), "Evidence destination outside owned roots.");
    const raw = Buffer.from(JSON.stringify(value, null, 2) + "\n");
    fs.writeFileSync(filename, raw, { flag: "wx" });
    return { path: filename, bytes: raw.length, sha256: sha(raw) };
}
function endpoint(value) {
    const url = new URL(value);
    assert.equal(url.protocol, "http:"); assert.equal(url.hostname, "127.0.0.1"); assert(url.port && Number(url.port) >= 1024); assert.equal(url.username, ""); assert.equal(url.password, ""); assert.equal(url.pathname, "/"); assert.equal(url.search, ""); assert.equal(url.hash, "");
    return url.origin;
}
function admit(filename, kind) {
    const absolute = path.resolve(filename); assert(inside(__dirname, absolute));
    const b = readJson(absolute);
    assert.equal(b.schemaVersion, 1); assert.equal(b.feature, "F29"); assert.equal(b.kind, kind);
    const proof = JSON.parse(pin(b.sourceProof).raw.toString("utf8").replace(/^\uFEFF/, ""));
    assert.equal(proof.feature, "F29"); assert(Array.isArray(proof.files) && proof.files.length === proof.fileCount && proof.files.length >= 1024);
    for (const row of proof.files) pin(row);
    pin(b.vsix); assert(Array.isArray(b.runtimes) && b.runtimes.length === 4); for (const row of b.runtimes) pin(row);
    assert(Array.isArray(b.requiredReceipts) && b.requiredReceipts.length >= 3); for (const row of b.requiredReceipts) pin(row);
    const inventory = JSON.parse(pin(b.toolInventory).raw.toString("utf8"));
    assert.equal(inventory.status, "PREPARED_STATIC_LOCAL_INVENTORY_NOT_ACCESSIBILITY_ACCEPTANCE");
    for (const row of inventory.pins) pin(row, { singleLink: !path.isAbsolute(row.path) || inside(root, row.path) });
    assert.equal(inventory.versions.playwright, "1.61.1"); assert.equal(inventory.versions.axe, "4.12.1");
    assert.equal(b.signals, 0); assert.equal(b.syntheticOnly, true);
    return { b, inventory, bindingPin: { path: absolute, bytes: fs.statSync(absolute).size, sha256: sha(fs.readFileSync(absolute)) } };
}
async function until(check, milliseconds, description) {
    const end = Date.now() + milliseconds; let last;
    while (Date.now() < end) { try { const value = await check(); if (value) return value; } catch (error) { last = error; } await new Promise(resolve => setTimeout(resolve, 100)); }
    throw new Error(`${description}; last=${last ? String(last.message).slice(0, 160) : "not observed"}`);
}
module.exports = { fs, path, assert, root, dRoot, sha, inside, ordinaryFile, pin, readJson, dDirectory, newDirectory, writeJson, endpoint, admit, until };
