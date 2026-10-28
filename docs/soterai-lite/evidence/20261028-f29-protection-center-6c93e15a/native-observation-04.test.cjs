'use strict';
// Pure fixture plumbing tests. No Code, native activation or product imports.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const fixture = path.join(__dirname, 'f29-native04.host.ts');
const source = fs.readFileSync(fixture, 'utf8');
const emitted = ts.transpileModule(source, { fileName: fixture, reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
assert.equal((emitted.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
const exportsObject = {};
vm.runInNewContext(emitted.outputText, { exports: exportsObject, module: { exports: exportsObject },
    require(name) { if (name === 'vscode') return Object.freeze({}); assert(name.startsWith('node:'), 'Product/nonbuiltin imports refused.'); return require(name); },
    Buffer, URL, process: Object.freeze({ platform: 'component-only', env: Object.freeze({}) }),
    setTimeout, clearTimeout, setInterval, clearInterval }, { filename: fixture });
const { createNativeForwardingFacade: facade, replaceNativeOwnGetter: replaceGetter, selectMainStatusOwner: selectMain } = exportsObject;
assert.equal(typeof facade, 'function'); assert.equal(typeof replaceGetter, 'function'); assert.equal(typeof selectMain, 'function');

test('F29 fixture facade forwards a frozen configuration without changing its descriptors', () => {
    let actual;
    const calls = [], nested = Object.freeze({ bounded: true });
    const source = Object.freeze({ sectionValue: nested,
        get(key, fallback) { assert.equal(this, source); calls.push(['get', key, fallback]); return key === 'known' ? nested : fallback; },
        has(key) { assert.equal(this, source); return key === 'known'; },
        inspect(key) { assert.equal(this, source); return key === 'known' ? nested : undefined; },
        update(...args) { assert.equal(this, source); actual = args; return nested; } });
    const descriptors = Object.getOwnPropertyDescriptors(source), observed = [];
    const view = facade(source, (name, args) => observed.push([name, args]));
    assert.notEqual(view, source); assert(Object.isFrozen(source));
    assert.equal(view.get('known', false), nested); assert.equal(view.get('absent', 'fallback'), 'fallback');
    assert.equal(view.has('known'), true); assert.equal(view.inspect('known'), nested); assert.equal(view.sectionValue, nested);
    const target = Object.freeze({ workspace: true }); assert.equal(view.update('setting', nested, target), nested);
    assert.equal(actual[1], nested); assert.equal(actual[2], target); assert.equal(observed.at(-1)[0], 'update');
    assert.deepEqual(Object.getOwnPropertyDescriptors(source), descriptors); assert.equal(calls.length, 2);
});
test('F29 fixture facade binds accessors and all methods to the original frozen receiver', () => {
    const source = Object.freeze({ get computed() { assert.equal(this, source); return this; }, self() { return this; } });
    const view = facade(source); assert.equal(view.computed, source); const detached = view.self;
    assert.equal(detached.call({ wrong: true }), source); assert.equal(view.self, detached);
    assert.equal(Reflect.get(view, 'computed', { wrong: true }), source);
});
test('F29 fixture facade avoids frozen-target Proxy invariants and preserves property queries', () => {
    const key = Symbol('fixture-property'), source = Object.freeze({ method() { return 19; }, value: 17, [key]: 'symbol-value' });
    const view = facade(source);
    assert.equal(view.method(), 19); assert.equal(view.method, view.method);
    assert.equal('value' in view, true); assert.equal('missing' in view, false);
    assert.deepEqual(Reflect.ownKeys(view), Reflect.ownKeys(source)); assert.deepEqual(Object.keys(view), Object.keys(source));
    assert.equal(Object.getPrototypeOf(view), Object.getPrototypeOf(source)); assert.equal(view[key], 'symbol-value');
    assert.equal(Object.getOwnPropertyDescriptor(view, 'value').value, 17);
    assert.equal(Object.getOwnPropertyDescriptor(view, 'method').value, view.method);
    assert.equal(Object.getOwnPropertyDescriptor(view, 'absent'), undefined);
});
test('F29 fixture facade preserves exact synchronous errors and original promise identity/rejections', async () => {
    const syncError = Error('synthetic-sync'), asyncError = Error('synthetic-async');
    const fulfilled = Promise.resolve(Object.freeze({ actual: true })), rejected = Promise.reject(asyncError);
    rejected.catch(() => {});
    const source = Object.freeze({ fail() { throw syncError; }, value() { return fulfilled; }, reject() { return rejected; } });
    const view = facade(source);
    assert.throws(() => view.fail(), error => error === syncError); assert.equal(view.value(), fulfilled);
    assert.equal(view.reject(), rejected); await assert.rejects(view.reject(), error => error === asyncError);
});
test('F29 fixture facade cannot mutate the original or silently install facade properties', () => {
    const source = Object.freeze({ method() {}, nested: Object.freeze({ value: 1 }) }), before = Object.getOwnPropertyDescriptors(source);
    const view = facade(source);
    assert.equal(Reflect.set(view, 'method', 7), false); assert.equal(Reflect.defineProperty(view, 'extra', { value: 1 }), false);
    assert.equal(Reflect.deleteProperty(view, 'method'), false); assert.equal(Reflect.setPrototypeOf(view, null), false);
    assert.equal(Reflect.preventExtensions(view), false); assert.deepEqual(Object.getOwnPropertyDescriptors(source), before);
    assert.equal(view.extra, undefined); assert.equal(view.nested, source.nested);
});
test('F29 fixture frozen filesystem facade forwards read and untouched methods with exact args/results', () => {
    const uri = Object.freeze({ synthetic: true }), bytes = new Uint8Array([4, 9, 17]), moved = Object.freeze({ result: 'moved' });
    const calls = [], observations = [];
    const source = Object.freeze({
        readFile(value) { assert.equal(this, source); assert.equal(value, uri); calls.push('readFile'); return bytes; },
        stat(value) { assert.equal(this, source); assert.equal(value, uri); calls.push('stat'); return moved; },
        rename(...args) { assert.equal(this, source); assert.equal(args[0], uri); assert.equal(args[1], uri); assert.equal(args[2], moved); calls.push('rename'); return moved; },
        isWritableFileSystem(value) { assert.equal(this, source); return value === 'synthetic'; },
    });
    const before = Object.getOwnPropertyDescriptors(source), view = facade(source, (name, args) => { if (name === 'readFile') observations.push(args[0]); });
    assert.equal(view.readFile(uri), bytes); assert.equal(view.stat(uri), moved); assert.equal(view.rename(uri, uri, moved), moved);
    assert.equal(view.isWritableFileSystem('synthetic'), true); assert.deepEqual(calls, ['readFile', 'stat', 'rename']);
    assert.deepEqual(observations, [uri]); assert.deepEqual(Object.getOwnPropertyDescriptors(source), before);
});
test('F29 fixture configurable outer fs getter is replaced and exact original descriptor restored', () => {
    const realFs = Object.freeze({ readFile() { return realFs; } }), native = {}, originalGet = function () { assert.equal(this, native); return realFs; };
    Object.defineProperty(native, 'fs', { configurable: true, enumerable: false, get: originalGet });
    const before = Object.getOwnPropertyDescriptor(native, 'fs'), view = facade(realFs), restore = replaceGetter(native, 'fs', () => view);
    assert.equal(native.fs, view); assert.equal(native.fs.readFile(), realFs); assert(Object.isFrozen(realFs));
    restore(); assert.deepEqual(Object.getOwnPropertyDescriptor(native, 'fs'), before); assert.equal(native.fs, realFs);
});
test('F29 fixture getter replacement refuses unsupported descriptors before mutation', () => {
    const fixed = {}, data = {}, absent = {};
    Object.defineProperty(fixed, 'fs', { configurable: false, get() { return 'actual'; } });
    Object.defineProperty(data, 'fs', { configurable: true, value: Object.freeze({}) });
    for (const owner of [fixed, data, absent]) { const before = Object.getOwnPropertyDescriptor(owner, 'fs');
        assert.throws(() => replaceGetter(owner, 'fs', () => 'incorrect')); assert.deepEqual(Object.getOwnPropertyDescriptor(owner, 'fs'), before); }
});
test('F29 fixture replacement forwards a real accessor exception unchanged and restores any setter', () => {
    const owner = {}, error = Error('synthetic-native-getter'), setter = function () {};
    Object.defineProperty(owner, 'fs', { configurable: true, enumerable: true, get() { throw error; }, set: setter });
    const before = Object.getOwnPropertyDescriptor(owner, 'fs'), restore = replaceGetter(owner, 'fs', () => 'observed');
    assert.equal(Object.getOwnPropertyDescriptor(owner, 'fs').set, setter); assert.equal(owner.fs, 'observed');
    restore(); assert.deepEqual(Object.getOwnPropertyDescriptor(owner, 'fs'), before); assert.throws(() => owner.fs, value => value === error);
});
test('F29 fixture selects exactly the public MAIN command owner among real auxiliary allocations', () => {
    const sentinel = Object.freeze({ command: 'soterai.showAITimeline', priority: 95 }), guard = Object.freeze({ command: 'soterai.showProtectedFiles', priority: 94 });
    const main = { command: 'soterai.openProtectionCenter', priority: 100 };
    assert.equal(selectMain([sentinel, guard, main]), main); assert.equal(selectMain([guard, main, sentinel]), main);
    main.command = 'soterai.openControlPanel'; assert.equal(selectMain([sentinel, main, guard]), main);
});
test('F29 fixture main selector rejects missing/ambiguous owners and wrong priority', () => {
    const main = { command: 'soterai.openProtectionCenter', priority: 100 }, second = { command: 'soterai.openControlPanel', priority: 100 };
    assert.throws(() => selectMain([])); assert.throws(() => selectMain([{ command: 'soterai.showAITimeline', priority: 100 }]));
    assert.throws(() => selectMain([main, second])); assert.throws(() => selectMain([main, main]));
    assert.throws(() => selectMain([{ command: 'soterai.openProtectionCenter', priority: 95 }]));
});
test('F29 successor retains all30 fixed oracle blocks and only gate forwards the original native picker', () => {
    assert.equal((source.match(/await check\(async \(\) =>/g) || []).length, 30);
    assert(source.includes('rendererObserving = true;')); assert(source.includes('finally { rendererObserving = false; }'));
    assert(source.includes('if (rendererObserving) return Reflect.apply(quickPick, vscode.window, [choices, options]);'));
    assert(!source.includes('patch(vscode.workspace.fs, "readFile"')); assert(!source.includes('Object.defineProperty(config, "update"'));
    assert(!source.includes('statusItems[0]')); assert(!source.includes('assert.equal(statusItems.length, 1)'));
});
