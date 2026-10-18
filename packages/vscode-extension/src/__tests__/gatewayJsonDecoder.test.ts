import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeBoundedJson } from "../../../../apps/local-ai-broker/src/BoundedJson";

const decode = (text: string, limits = {}) => decodeBoundedJson(Buffer.from(text, "utf8"), limits);
test("F15a-J01 public nested Unicode/escaped values return complete canonical JSON", () => {
    const value = decode(' { "text":"public\\n🙂", "values":[true,false,null,2e2],"nested":{"x":"ok"} } ');
    assert.equal(value.body.text, "public\n🙂"); assert.deepEqual(JSON.parse(value.canonical), JSON.parse(' { "text":"public\\n🙂", "values":[true,false,null,2e2],"nested":{"x":"ok"} } '));
    assert.ok(Object.isFrozen(value.body)); assert.ok(Object.isFrozen(value.body.values));
});
for (const input of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"nested":{"key":1,"key":2}}']) test("F15a-J02 duplicate decoded key refuses " + input, () => assert.throws(() => decode(input)));
test("F15a-J03 case-sensitive keys remain distinct inert data", () => { const v = decode('{"A":1,"a":2,"__proto__":{"safe":1},"constructor":3}'); assert.equal(v.body.A, 1); assert.equal(v.body.a, 2); assert.equal(Object.getPrototypeOf(v.body), null); assert.equal(({} as { safe?: number }).safe, undefined); assert.ok(Object.hasOwn(v.body, "__proto__")); });
for (const input of ['', '[]', 'null', '"text"', '42', '{"a":1}x', '{"a":}', '{"a":1,}', '{a:1}', '{"a":NaN}']) test("F15a-J04 invalid or nonobject JSON refuses " + input, () => assert.throws(() => decode(input)));
for (const input of ['{"a":1e999}', '{"a":9007199254740993}', '{"a":"\\ud800"}', '{"a":"\\udfff"}', '{"\\ud800":1}']) test("F15a-J05 nonfinite/unsafe number or lone surrogate refuses " + input, () => assert.throws(() => decode(input)));
test("F15a-J06 BOM outside JSON refuses while registered-like BOM inside text stays byte-exact", () => { assert.throws(() => decode('\ufeff{"x":1}')); assert.equal(decode('{"x":"\ufeffsynthetic-private-prefix"}').body.x, "\ufeffsynthetic-private-prefix"); });
test("F15a-J07 malformed UTF8 never substitutes a replacement character", () => { assert.throws(() => decodeBoundedJson(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xc0, 0xaf, 0x22, 0x7d]))); });
test("F15a-J08 exact byte limit succeeds; one extra byte refuses", () => { const text = '{"x":"🙂"}', size = Buffer.byteLength(text); assert.ok(decode(text, { maxBytes: size }).body); assert.throws(() => decode(text, { maxBytes: size - 1 })); });
test("F15a-J09 depth and key/value node budgets reject overflow without unbounded recursion", () => { assert.ok(decode('{"a":1}', { maxDepth: 1, maxNodes: 3 }).body); assert.throws(() => decode('{"a":{"b":1}}', { maxDepth: 1 })); assert.throws(() => decode('{"a":1}', { maxNodes: 2 })); assert.throws(() => decode('{"a":'.repeat(10000) + '0' + '}'.repeat(10000))); });
test("F15a-J10 decoded string UTF8 budget includes Unicode and keys", () => { assert.ok(decode('{"x":"🙂"}', { maxStringBytes: 4 }).body); assert.throws(() => decode('{"x":"🙂"}', { maxStringBytes: 3 })); assert.throws(() => decode('{"long-key":1}', { maxStringBytes: 3 })); });
test("F15a-J11 errors never echo arbitrary input fragments", () => { try { decode('{"synthetic-never-echo-private-X9":'); assert.fail(); } catch (error) { assert.ok(!String(error).includes("synthetic-never-echo-private-X9")); } });
