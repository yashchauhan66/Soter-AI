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

// packages/vscode-extension/src/__tests__/host/liteBrokerLifecycle.host.ts
var liteBrokerLifecycle_host_exports = {};
__export(liteBrokerLifecycle_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteBrokerLifecycle_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var childProcess = __toESM(require("node:child_process"));
var import_node_crypto = require("node:crypto");
var import_node_net = require("node:net");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var runs = [];
var restores = [];
var captured;
var sha = (data) => (0, import_node_crypto.createHash)("sha256").update(data).digest("hex");
function patch(object, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => {
    if (descriptor) Object.defineProperty(object, name, descriptor);
    else Reflect.deleteProperty(object, name);
  });
}
function noTokens(value) {
  const text = JSON.stringify(value);
  for (const run2 of runs) for (const key of ["SOTERAI_BROKER_TOKEN", "SOTERAI_BROKER_CONTROL_TOKEN", "SOTERAI_PROVIDER_API_KEY"]) if (run2.env[key]) import_strict.default.ok(!text.includes(run2.env[key]), "Native report contains private auth");
}
async function until(check, ms = 1e4) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((done) => setTimeout(done, 25));
  }
  throw Error("Native lifecycle condition unavailable");
}
function setupDiagnostic() {
  return { contextCaptured: !!captured, childCount: runs.length };
}
function beforeActivate(context) {
  captured = context;
  import_strict.default.match((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
  const original = childProcess.spawn;
  patch(require("node:child_process"), "spawn", function(executable, argv, options) {
    const child = Reflect.apply(original, childProcess, [executable, argv, options]);
    if (argv?.length === 1 && /[\\/]dist[\\/]local-ai-broker\.js$/.test(argv[0])) {
      const row = { child, env: { ...options.env }, argv: [...argv], closed: false, out: false, err: false };
      runs.push(row);
      child.once("close", () => {
        row.closed = true;
      });
      child.stdout?.once("end", () => {
        row.out = true;
      });
      child.stderr?.once("end", () => {
        row.err = true;
      });
    }
    return child;
  });
  for (const name of ["showInformationMessage", "showWarningMessage", "showErrorMessage"]) patch(vscode.window, name, async (message) => {
    noTokens(message);
    return void 0;
  });
  patch(vscode.env.clipboard, "writeText", async () => void 0);
}
function manager(context) {
  const found = context.subscriptions.find((value) => typeof value.ownedSnapshot === "function");
  import_strict.default.ok(found);
  return found;
}
function http(run2, url, route, token = run2.env.SOTERAI_BROKER_CONTROL_TOKEN, session = run2.env.SOTERAI_BROKER_SESSION) {
  return fetch(url + route, { headers: { authorization: `Bearer ${token}`, ...session ? { "x-soterai-session": session } : {} } });
}
async function stopped(current) {
  await current.stop();
  await until(() => runs.every((row) => row.closed && row.out && row.err));
  import_strict.default.equal(current.ownedSnapshot().state, "stopped");
}
async function peer(context, root) {
  const current = manager(context), status = await current.start();
  await (0, import_promises.writeFile)((0, import_node_path.join)(root, "peer-ready.json"), JSON.stringify({ url: status.url, session: current.ownedSnapshot().session, hostVersion: vscode.version }) + "\n", { flag: "wx" });
  try {
    await until(async () => {
      try {
        await (0, import_promises.readFile)((0, import_node_path.join)(root, "peer-stop.json"));
        return true;
      } catch {
        return false;
      }
    }, 4e4);
  } finally {
    await stopped(current);
  }
  await (0, import_promises.writeFile)((0, import_node_path.join)(root, "peer-closed.json"), JSON.stringify({ status: "PASS", closed: runs.every((row) => row.closed && row.out && row.err), hostVersion: vscode.version }) + "\n", { flag: "wx" });
}
async function concurrentPeer(context, current, root) {
  const profile = (0, import_node_path.join)(root, "peer-profile"), extensions = (0, import_node_path.join)(root, "peer-extensions"), workspace2 = vscode.workspace.workspaceFolders[0].uri.fsPath;
  await (0, import_promises.mkdir)((0, import_node_path.join)(profile, "User"), { recursive: true });
  await (0, import_promises.mkdir)((0, import_node_path.join)(profile, "Temp"));
  await (0, import_promises.mkdir)(extensions);
  const ownProfile = process.env.SOTERAI_LITE_F14_PROFILE;
  await (0, import_promises.writeFile)((0, import_node_path.join)(profile, "User/settings.json"), await (0, import_promises.readFile)((0, import_node_path.join)(ownProfile, "User/settings.json")), { flag: "wx" });
  const env2 = {};
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env2[key] = process.env[key];
  Object.assign(env2, {
    USERPROFILE: profile,
    APPDATA: (0, import_node_path.join)(profile, "AppData/Roaming"),
    LOCALAPPDATA: (0, import_node_path.join)(profile, "AppData/Local"),
    TEMP: (0, import_node_path.join)(profile, "Temp"),
    TMP: (0, import_node_path.join)(profile, "Temp"),
    SOTERAI_LITE_F14_PROFILE: profile,
    SOTERAI_LITE_F14_PHASE: "peer",
    SOTERAI_LITE_F14_PEER_ROOT: root,
    SOTERAI_LITE_F14_EVIDENCE: (0, import_node_path.join)(root, "peer-results.json"),
    SOTERAI_LITE_F14_BUNDLE_SHA256: process.env.SOTERAI_LITE_F14_BUNDLE_SHA256,
    SOTERAI_LITE_F14_DRIVER_KIND: "native-bootstrap"
  });
  const child = childProcess.spawn(process.execPath, [`--extensionDevelopmentPath=${context.extensionUri.fsPath}`, `--user-data-dir=${profile}`, `--extensions-dir=${extensions}`, "--new-window", "--disable-extensions", "--disable-extension=vscode.git", "--disable-extension=vscode.github-authentication", "--disable-extension=vscode.microsoft-authentication", "--disable-workspace-trust", "--disable-gpu", "--disable-updates", "--skip-welcome", "--skip-release-notes", workspace2], { env: env2, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.on("data", () => void 0);
  child.stderr?.on("data", () => void 0);
  let closed = false;
  child.once("close", () => {
    closed = true;
  });
  try {
    await until(async () => {
      try {
        await (0, import_promises.readFile)((0, import_node_path.join)(root, "peer-ready.json"));
        return true;
      } catch {
        return false;
      }
    }, 3e4);
    const remote = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, "peer-ready.json"), "utf8"));
    import_strict.default.notEqual(remote.url, current.url);
    import_strict.default.notEqual(remote.session, current.ownedSnapshot().session);
    import_strict.default.equal((await http(runs.at(-1), remote.url, "/version")).status, 401);
    import_strict.default.equal((await current.status()).running, true);
  } finally {
    await (0, import_promises.writeFile)((0, import_node_path.join)(root, "peer-stop.json"), "{}\n", { flag: "wx" });
  }
  await until(async () => {
    try {
      await (0, import_promises.readFile)((0, import_node_path.join)(root, "peer-closed.json"));
      return closed;
    } catch {
      return false;
    }
  }, 2e4);
  import_strict.default.equal(JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, "peer-closed.json"), "utf8")).closed, true);
}
async function run(context) {
  import_strict.default.equal(captured, context);
  const phase = process.env.SOTERAI_LITE_F14_PHASE, output = process.env.SOTERAI_LITE_F14_EVIDENCE;
  if (phase === "peer") {
    try {
      await peer(context, process.env.SOTERAI_LITE_F14_PEER_ROOT);
    } finally {
      for (const restore of restores.reverse()) restore();
    }
    return;
  }
  const profile = process.env.SOTERAI_LITE_F14_PROFILE, root = (0, import_node_path.dirname)(profile), current = manager(context), config = vscode.workspace.getConfiguration("soterai");
  const originalFlag = config.inspect("lite.gatewayLifecycle")?.globalValue;
  const runtime = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F14_BUNDLE_SHA256);
  import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
  const count = phase === "primary" ? 16 : 3, offset = phase === "primary" ? 0 : 16;
  const observations = Array.from({ length: count }, (_, i) => ({ id: "F14-H" + String(offset + i + 1).padStart(2, "0"), status: "NOT_RUN", scope: "Actual owned broker lifecycle" }));
  const check = async (index, action) => {
    const row = observations[index - 1];
    try {
      await action();
      row.status = "PASS";
    } catch {
      row.status = "FAIL";
    }
  };
  let driverFailure, firstRun, firstUrl = "";
  try {
    if (phase === "primary") {
      await check(1, async () => {
        const pkg = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
        import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayLifecycle"].scope, "machine");
        import_strict.default.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayLifecycle"));
      });
      await check(2, async () => {
        import_strict.default.equal((await current.status()).running, false);
        import_strict.default.equal(runs.length, 0);
        import_strict.default.equal(current.memorySessionId, void 0);
      });
      await check(3, async () => {
        const held = (0, import_node_net.createServer)();
        let owned = false;
        await new Promise((done, reject) => {
          held.once("error", (e) => e.code === "EADDRINUSE" ? done() : reject(e));
          held.listen(47321, "127.0.0.1", () => {
            owned = true;
            done();
          });
        });
        try {
          const s = await vscode.commands.executeCommand("soterai.startLocalAIBroker");
          import_strict.default.equal(s?.running, true);
          import_strict.default.notEqual(current.port, 47321);
          firstUrl = current.url;
          firstRun = runs.at(-1);
          import_strict.default.ok(firstRun);
        } finally {
          if (owned) await new Promise((done) => held.close(() => done()));
        }
      });
      await check(4, async () => {
        import_strict.default.ok(firstRun);
        import_strict.default.equal(firstRun.argv.length, 1);
        import_strict.default.equal(firstRun.env.SOTERAI_BROKER_PORT, "0");
        import_strict.default.notEqual(firstRun.env.SOTERAI_BROKER_TOKEN, firstRun.env.SOTERAI_BROKER_CONTROL_TOKEN);
        noTokens(current.ownedSnapshot());
      });
      await check(5, async () => {
        const before = runs.length;
        import_strict.default.equal((await current.start()).running, true);
        import_strict.default.equal(runs.length, before);
      });
      await check(6, async () => {
        import_strict.default.ok(firstRun);
        import_strict.default.equal((await http(firstRun, current.url, "/version", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 200);
        import_strict.default.equal((await http(firstRun, current.url, "/v1/lifecycle/status", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 403);
        import_strict.default.equal((await http(firstRun, current.url, "/version", firstRun.env.SOTERAI_BROKER_CONTROL_TOKEN, "wrong-window")).status, 403);
      });
      await check(7, async () => {
        import_strict.default.deepEqual((await current.status()).safeMode, { enabled: true, level: "strict", ...(await current.status()).safeMode ?? {} });
        import_strict.default.equal((await current.status()).safeMode?.enabled, true);
        import_strict.default.equal((await current.status()).safeMode?.level, "strict");
      });
      await check(8, async () => {
        const result2 = await current.request("/v1/scan", { method: "POST", body: JSON.stringify({ content: "Public arithmetic example 2 plus 2." }) });
        import_strict.default.equal(result2.decision, "allow");
      });
      await check(9, async () => {
        const result2 = await current.request("/v1/scan", { method: "POST", body: JSON.stringify({ content: "OPENAI_API_KEY=sk-proj-1234567890abcdefghijklmnopqrstuv" }) });
        import_strict.default.notEqual(result2.decision, "allow");
      });
      await check(10, async () => {
        const before = current.ownedSnapshot().session;
        await current.restart();
        import_strict.default.notEqual(current.ownedSnapshot().session, before);
        import_strict.default.ok(firstRun?.closed && firstRun.out && firstRun.err);
      });
      await check(11, async () => concurrentPeer(context, current, root));
      await check(12, async () => {
        import_strict.default.ok(firstRun);
        const active = runs.at(-1);
        import_strict.default.notEqual(active.env.SOTERAI_BROKER_TOKEN, firstRun.env.SOTERAI_BROKER_TOKEN);
        import_strict.default.equal((await http(active, current.url, "/version", firstRun.env.SOTERAI_BROKER_TOKEN)).status, 401);
      });
      await check(13, async () => {
        await config.update("lite.gatewayLifecycle", false, vscode.ConfigurationTarget.Global);
        await stopped(current);
        await import_strict.default.rejects(current.start());
        import_strict.default.equal(context.globalState.get("soterai.safeMode"), void 0);
        await config.update("lite.gatewayLifecycle", true, vscode.ConfigurationTarget.Global);
        await current.start();
      });
      await check(14, async () => {
        const before = current.ownedSnapshot().session;
        await vscode.commands.executeCommand("soterai.rotateCanary");
        await stopped(current);
        await current.start();
        import_strict.default.notEqual(current.ownedSnapshot().session, before);
      });
      await check(15, async () => {
        await context.globalState.update("soterai.safeMode", { enabled: true, level: "enterprise" });
        await current.restart();
        import_strict.default.equal((await current.status()).safeMode?.level, "enterprise");
      });
      await check(16, async () => {
        await stopped(current);
        noTokens(runs.map((row) => ({ closed: row.closed, out: row.out, err: row.err })));
        await (0, import_promises.writeFile)((0, import_node_path.join)(root, "restart-binding.json"), JSON.stringify({ priorSession: firstRun?.env.SOTERAI_BROKER_SESSION, priorUrl: firstUrl, savedMode: context.globalState.get("soterai.safeMode") }) + "\n", { flag: "wx" });
      });
    } else {
      await check(1, async () => {
        const prior = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, "restart-binding.json"), "utf8"));
        import_strict.default.equal(current.ownedSnapshot().state, "stopped");
        import_strict.default.equal(runs.length, 0);
        import_strict.default.equal(current.memorySessionId, void 0);
        import_strict.default.equal((await current.status()).running, false);
        import_strict.default.ok(prior.priorSession);
      });
      await check(2, async () => {
        const prior = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(root, "restart-binding.json"), "utf8"));
        await current.start();
        import_strict.default.notEqual(current.ownedSnapshot().session, prior.priorSession);
        import_strict.default.equal((await current.status()).safeMode?.level, "enterprise");
        import_strict.default.deepEqual(context.globalState.get("soterai.safeMode"), prior.savedMode);
      });
      await check(3, async () => {
        await stopped(current);
        import_strict.default.ok(runs.length > 0);
        import_strict.default.equal(context.globalState.get("soterai.safeMode")?.level, "enterprise");
      });
    }
  } catch {
    driverFailure = "NativeLifecycleDriverFailure";
  } finally {
    try {
      await stopped(current);
      await config.update("lite.gatewayLifecycle", originalFlag, vscode.ConfigurationTarget.Global);
    } catch {
      driverFailure = "NativeOwnedShutdownUnconfirmed";
    }
    for (const restore of restores.reverse()) restore();
  }
  const result = {
    schemaVersion: 1,
    phase,
    syntheticOnly: true,
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js"))),
    hostProbeSha256: sha(await (0, import_promises.readFile)(__filename)),
    observations,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    ...driverFailure ? { driverFailure } : {},
    childRuns: runs.map((row) => ({ closed: row.closed, stdoutEOF: row.out, stderrEOF: row.err, safe: true })),
    sourceDocumentCalls: 0,
    sourceDocumentEvents: 0,
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    observedAt: (/* @__PURE__ */ new Date()).toISOString(),
    notTested: ["Clean installed-VSIX lifecycle", "Independent human/tool routes", "Unmanaged traffic", "OS confinement"]
  };
  noTokens(result);
  await (0, import_promises.writeFile)(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || result.notRun || driverFailure) throw Error("F14 native lifecycle incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
