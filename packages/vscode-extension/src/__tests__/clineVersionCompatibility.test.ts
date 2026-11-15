import "./phase2/register.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import * as stub from "./phase2/vscode-stub";
import { ClineAdapter } from "../adapters/ClineAdapter";
const policy = () => require("../adapters/ClineAdapterPolicy") as any;
const vendor = process.env.SOTERAI_CLINE_ARTIFACT_FIXTURE;
const manifestHash = "4c9213753c57e7d651b09be215853e4555238718b4974413b7e63993a42b219e";
const runtimeHash = "ae4cec19fd74dc97681dcfcfe5a6644cae4a5f5f19396f1424dcd9eada659559";
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

test("the reviewed installed Cline 4.1.26 artifact is accepted; changed bytes and future versions are refused", t => {
    if (!vendor || !fs.existsSync(path.join(vendor, "package.json"))) { t.skip("Explicit isolated public Cline 4.1.26 artifact fixture required"); return; }
    const manifest = fs.readFileSync(path.join(vendor, "package.json")), runtime = fs.readFileSync(path.join(vendor, "dist/extension.js"));
    assert.equal(sha(manifest), manifestHash); assert.equal(sha(runtime), runtimeHash);
    assert.equal(policy().verifyClineArtifact(manifest, runtime), true);
    assert.equal(policy().verifyClineArtifact(Buffer.from(manifest.toString().replace('"4.1.26"', '"4.1.27"')), runtime), false);
    assert.equal(policy().verifyClineArtifact(manifest, Buffer.concat([runtime, Buffer.from("changed")])), false);
});

test("custom Cline profile paths are refused before a default-profile write", () => {
    const supported = policy().clineDefaultPathsEnvironment;
    assert.equal(typeof supported, "function");
    assert.equal(supported({}), true);
    for (const key of ["CLINE_DIR", "CLINE_DATA_DIR", "CLINE_PROVIDER_SETTINGS_PATH", "CLINE_GLOBAL_SETTINGS_PATH", "CLINE_MCP_SETTINGS_PATH"]) {
        assert.equal(supported({ [key]: "D:\\another-profile" }), false, key);
        assert.equal(supported({ [key]: " " }), true, key);
    }
    let reads = 0;
    assert.equal(supported(Object.defineProperty({}, "CLINE_DIR", { get() { reads++; return "private"; } })), false);
    assert.equal(reads, 0);
});
test("a custom profile override stops configure before reading artifacts or writing defaults", async t => {
    stub.resetState("D:\\synthetic-cline-profile");
    const context = stub.makeExtensionContext("D:\\synthetic-cline-storage"), prior = process.env.CLINE_PROVIDER_SETTINGS_PATH;
    process.env.CLINE_PROVIDER_SETTINGS_PATH = "D:\\synthetic-custom-providers.json";
    const adapter = new ClineAdapter(context as never, {} as never, { isEnabled: () => true } as never);
    t.after(() => { adapter.dispose(); if (prior === undefined) delete process.env.CLINE_PROVIDER_SETTINGS_PATH; else process.env.CLINE_PROVIDER_SETTINGS_PATH = prior; });
    let reads = 0;
    t.mock.method(adapter as any, "artifact", async () => { reads++; throw Error("Unexpected artifact read"); });
    assert.deepEqual(await adapter.configure(), { status: "CLINE_DEFAULT_PROFILE_REQUIRED" });
    assert.equal(reads, 0);
});

// Execute short pure functions from the actual hash-bound public vendor bundle.
// No Cline extension activation, profiles, provider calls or private values occur.
function functionSource(source: string, name: string): string {
    const start = source.indexOf("function " + name + "("); assert.ok(start >= 0);
    const next = source.indexOf("function ", start + 9); assert.ok(next > start);
    const text = source.slice(start, next).trim(); assert.ok(text.length < 3000);
    return text;
}
test("actual 4.1.26 path and hook-result functions retain the reviewed contracts", t => {
    if (!vendor) { t.skip("Explicit isolated public Cline 4.1.26 artifact fixture required"); return; }
    const file = path.join(vendor, "dist/extension.js");
    if (!fs.existsSync(file)) { t.skip("Exact public Cline 4.1.26 artifact unavailable"); return; }
    const bytes = fs.readFileSync(file); assert.equal(sha(bytes), runtimeHash);
    const source = bytes.toString("utf8"), functions = ["rR", "_y", "w6i", "DLe", "ggt", "T4u", "zt0", "Lvr"].map(name => functionSource(source, name)).join("\n");
    const context: any = { process: { env: {} }, xo: { join: path.win32.join }, iue: "D:\\synthetic-profile", h6i: undefined, OJu: "cline_mcp_settings.json" };
    vm.runInNewContext(functions + "; result={provider:w6i(),global:DLe(),mcp:ggt(),cancel:Lvr({cancel:true,errorMessage:'Blocked synthetic operation'}),allow:Lvr({cancel:false}),parameters:T4u({path:'public.txt',files:[{path:'public.txt'}]})};", context, { timeout: 1000 });
    assert.equal(context.result.provider, "D:\\synthetic-profile\\.cline\\data\\settings\\providers.json");
    assert.equal(context.result.global, "D:\\synthetic-profile\\.cline\\data\\settings\\global-settings.json");
    assert.equal(context.result.mcp, "D:\\synthetic-profile\\.cline\\data\\settings\\cline_mcp_settings.json");
    assert.equal(context.result.cancel.stop, true); assert.equal(context.result.allow, undefined);
    assert.equal(context.result.parameters.files, '[{"path":"public.txt"}]');
    for (const key of ["CLINE_DIR", "CLINE_DATA_DIR", "CLINE_PROVIDER_SETTINGS_PATH", "CLINE_GLOBAL_SETTINGS_PATH", "CLINE_MCP_SETTINGS_PATH"]) context.process.env[key] = " \t ";
    assert.equal(context.w6i(), context.result.provider);
    assert.equal(context.DLe(), context.result.global);
    assert.equal(context.ggt(), context.result.mcp);
});
