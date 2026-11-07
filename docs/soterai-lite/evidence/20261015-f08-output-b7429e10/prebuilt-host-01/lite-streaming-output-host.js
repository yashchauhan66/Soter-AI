"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// packages/vscode-extension/src/__tests__/host/liteStreamingOutput.host.ts
var liteStreamingOutput_host_exports = {};
__export(liteStreamingOutput_host_exports, {
  run: () => run
});
module.exports = __toCommonJS(liteStreamingOutput_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var FLAG = "lite.outputRedactor";
var COMMAND = "soterai.testProtection";
var MARKER = ".synthetic-lite-f08-host";
var CASES = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"];
var SCOPES = {
  S01: "Public stdout and stderr remain usable after completed stream filtering.",
  S02: "A raw registered value split over chunks is redacted.",
  S03: "A registered encoded value split over chunks is redacted.",
  S04: "UTF-8 scalar bytes split across chunks remain recognized.",
  S05: "ANSI SGR insertion and split sequences are removed before matching.",
  S06: "OSC payloads never reach the released plain-text output.",
  S07: "Nonzero process exit retains sanitized public output and status.",
  S08: "Incomplete final UTF-8 or control flush withholds all output.",
  S09: "Oversized combined output is withheld without a raw fallback.",
  S10: "Fresh sequential operations retain separate private states; interleaved instances have separate unit coverage."
};
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var within = (root, target) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(root), (0, import_node_path.resolve)(target));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
function record(value, keys) {
  import_strict.default.ok(value && typeof value === "object" && !Array.isArray(value));
  import_strict.default.ok([Object.prototype, null].includes(Object.getPrototypeOf(value)));
  import_strict.default.deepEqual(Object.keys(value).sort(), [...keys].sort());
}
function report(value) {
  record(value, ["pass", "matching", "output"]);
  import_strict.default.equal(typeof value.pass, "boolean");
  record(value.matching, ["status", "cases"]);
  import_strict.default.ok(["PASS", "FAIL", "WITHHELD"].includes(value.matching.status));
  import_strict.default.ok(Array.isArray(value.matching.cases) && value.matching.cases.length <= 10);
  for (const retained of value.matching.cases) {
    record(retained, ["id", "pass"]);
    import_strict.default.match(retained.id, /^M(?:0[1-9]|10)$/);
    import_strict.default.equal(typeof retained.pass, "boolean");
  }
  if (value.pass === true) {
    import_strict.default.equal(value.matching.status, "PASS");
    import_strict.default.equal(value.matching.cases.length, 10);
    import_strict.default.ok(value.matching.cases.every((item) => item.pass === true));
  }
  record(value.output, ["status", "cases"]);
  import_strict.default.ok(["PASS", "FAIL", "WITHHELD"].includes(value.output.status));
  import_strict.default.ok(Array.isArray(value.output.cases) && value.output.cases.length <= CASES.length);
  const seen = /* @__PURE__ */ new Set();
  const cases = value.output.cases.map((candidate) => {
    record(candidate, ["id", "pass"]);
    import_strict.default.ok(CASES.includes(candidate.id));
    import_strict.default.equal(typeof candidate.pass, "boolean");
    const id = candidate.id;
    import_strict.default.ok(!seen.has(id));
    seen.add(id);
    return { id, pass: candidate.pass };
  });
  const safe = {
    pass: value.pass,
    output: { status: value.output.status, cases }
  };
  import_strict.default.ok(Buffer.byteLength(JSON.stringify(safe), "utf8") <= 4096);
  return safe;
}
async function waitUntil(predicate, label) {
  const deadline = performance.now() + 15e3;
  while (performance.now() < deadline) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(label);
}
async function run(context) {
  const output = process.env.SOTERAI_LITE_F08_EVIDENCE, profile = process.env.SOTERAI_LITE_F08_PROFILE;
  if (!output || !profile || !(0, import_node_path.isAbsolute)(output) || !(0, import_node_path.isAbsolute)(profile)) throw new Error("F08 requires isolated absolute paths.");
  const observations = [
    { id: "F08-H00", scope: "Actual packaged runtime activates and registers the production test command.", status: "NOT_RUN" },
    ...CASES.map((id) => ({ id: `F08-${id}`, scope: SCOPES[id], status: "NOT_RUN" })),
    { id: "F08-H11", scope: "Machine flag withdrawal makes the production seam WITHHELD with pass=false and safe metadata only.", status: "NOT_RUN" },
    { id: "F08-H12", scope: "Re-enabling the machine flag restores all ten real singleton cases in a fresh invocation.", status: "NOT_RUN" }
  ];
  const reports = [];
  let runtime = "", bundle = "", root = "", driverFailure;
  let oldFlag, restoreFlag = false;
  const check = async (id, action) => {
    const row = observations.find((item) => item.id === id);
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.diagnostic = `${error instanceof Error ? error.name : "UnknownFailure"} in ${id}`;
    }
    console.log(`LITE_SECRET_MATCHING_HOST ${id} ${row.status}`);
  };
  const setFlag = async (enabled) => {
    await vscode.workspace.getConfiguration("soterai").update(FLAG, enabled, vscode.ConfigurationTarget.Global);
    await waitUntil(
      () => vscode.workspace.getConfiguration("soterai").inspect(FLAG)?.globalValue === enabled,
      "Isolated machine flag did not settle."
    );
  };
  try {
    import_strict.default.equal(process.env.SOTERAI_LITE_F08_DRIVER_KIND, "native-bootstrap");
    import_strict.default.equal((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), (0, import_node_path.resolve)(profile));
    import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\SoterAI-Lite-test-profiles\\/i);
    import_strict.default.ok(within((0, import_node_path.dirname)(profile), output));
    import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
    import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
    import_strict.default.ok(vscode.workspace.isTrusted);
    const folder = vscode.workspace.workspaceFolders[0];
    import_strict.default.equal(folder.uri.scheme, "file");
    root = folder.uri.fsPath;
    import_strict.default.ok(within((0, import_node_path.dirname)(profile), root));
    import_strict.default.equal(await (0, import_promises.readFile)((0, import_node_path.join)(root, MARKER), "utf8"), "synthetic-only-v1");
    import_strict.default.ok(within(profile, context.globalStorageUri.with({ scheme: "file" }).fsPath));
    const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
    import_strict.default.ok(extension);
    bundle = (0, import_node_path.join)(extension.extensionPath, "dist", "extension.js");
    runtime = sha(await (0, import_promises.readFile)(bundle));
    import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F08_BUNDLE_SHA256);
    await check("F08-H00", async () => {
      await waitUntil(() => extension.isActive, "Actual packaged extension did not activate.");
      await waitUntil(async () => (await vscode.commands.getCommands(true)).includes(COMMAND), "Production command did not register.");
    });
    import_strict.default.equal(observations.find((item) => item.id === "F08-H00")?.status, "PASS");
    oldFlag = vscode.workspace.getConfiguration("soterai").inspect(FLAG)?.globalValue;
    restoreFlag = true;
    await setFlag(true);
    const first = report(await vscode.commands.executeCommand(COMMAND));
    reports.push({ phase: "enabled", result: first });
    for (const id of CASES) await check(`F08-${id}`, async () => {
      import_strict.default.equal(first.pass, true);
      import_strict.default.equal(first.output.status, "PASS");
      import_strict.default.equal(first.output.cases.length, CASES.length);
      import_strict.default.equal(first.output.cases.find((item) => item.id === id)?.pass, true);
    });
    await check("F08-H11", async () => {
      await setFlag(false);
      const withdrawn = report(await vscode.commands.executeCommand(COMMAND));
      reports.push({ phase: "withdrawn", result: withdrawn });
      import_strict.default.equal(withdrawn.pass, false);
      import_strict.default.equal(withdrawn.output.status, "WITHHELD");
    });
    await check("F08-H12", async () => {
      await setFlag(true);
      const fresh = report(await vscode.commands.executeCommand(COMMAND));
      reports.push({ phase: "reenabled", result: fresh });
      import_strict.default.equal(fresh.pass, true);
      import_strict.default.equal(fresh.output.status, "PASS");
      import_strict.default.equal(fresh.output.cases.length, CASES.length);
      for (const id of CASES) import_strict.default.equal(fresh.output.cases.find((item) => item.id === id)?.pass, true);
    });
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    if (restoreFlag) {
      try {
        await vscode.workspace.getConfiguration("soterai").update(FLAG, oldFlag, vscode.ConfigurationTarget.Global);
      } catch {
        driverFailure = "IsolatedFlagRestoreFailure";
      }
    }
  }
  const currentRuntime = bundle ? sha(await (0, import_promises.readFile)(bundle)) : "";
  if (currentRuntime !== runtime) driverFailure = "RuntimeIdentityChanged";
  const result = {
    schemaVersion: 1,
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    phase: "single",
    syntheticOnly: true,
    workspace: root,
    declaredProfilePath: (0, import_node_path.resolve)(profile),
    hostVersion: vscode.version,
    extensionMode: "Development",
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: currentRuntime,
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    reports,
    passed: observations.filter((item) => item.status === "PASS").length,
    failed: observations.filter((item) => item.status === "FAIL").length,
    notRun: observations.filter((item) => item.status === "NOT_RUN").length,
    ...driverFailure ? { driverFailure } : {},
    identityScope: "Byte-identical packaged runtime invoked through the actual registered command in a normal isolated developer window; no clean-profile installed-VSIX claim.",
    interactionScope: "Production synthetic in-process transports and value-free returned case metadata; no network, external agent, streaming or gateway-routing proof.",
    commandScope: "Ten matching cases plus registration and flag withdrawal/re-enable checks; all case oracles originate from the production synthetic self-test.",
    independence: "LOW",
    ownerPresence: "SYNTHETIC_SELF_TEST_NO_OWNER_APPROVAL_ASSERTION"
  };
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || driverFailure) throw new Error("F08 native fixture incomplete or failed; inspect safe observations.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  run
});
