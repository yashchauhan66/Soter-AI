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

// packages/vscode-extension/src/__tests__/host/liteGatewayDeflate.host.ts
var liteGatewayDeflate_host_exports = {};
__export(liteGatewayDeflate_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteGatewayDeflate_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var childProcess = __toESM(require("node:child_process"));
var import_node_crypto = require("node:crypto");
var import_node_zlib = require("node:zlib");
var import_node_net = require("node:net");
var import_node_http = require("node:http");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var runs = [];
var restores = [];
var captured;
var setup = { phase: "initial" };
var sha = (data) => (0, import_node_crypto.createHash)("sha256").update(data).digest("hex");
function patch(object, name, value) {
  const descriptor = Object.getOwnPropertyDescriptor(object, name);
  setup = { phase: "patch", name, frozen: Object.isFrozen(object), configurable: descriptor?.configurable, writable: descriptor?.writable };
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
  return { contextCaptured: !!captured, childCount: runs.length, ...setup };
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
  setup = { phase: "harness-installed" };
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
  const ownProfile = process.env.SOTERAI_LITE_F15D_PROFILE;
  await (0, import_promises.writeFile)((0, import_node_path.join)(profile, "User/settings.json"), await (0, import_promises.readFile)((0, import_node_path.join)(ownProfile, "User/settings.json")), { flag: "wx" });
  const env = {};
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env[key] = process.env[key];
  Object.assign(env, {
    USERPROFILE: profile,
    APPDATA: (0, import_node_path.join)(profile, "AppData/Roaming"),
    LOCALAPPDATA: (0, import_node_path.join)(profile, "AppData/Local"),
    TEMP: (0, import_node_path.join)(profile, "Temp"),
    TMP: (0, import_node_path.join)(profile, "Temp"),
    SOTERAI_LITE_F15D_PROFILE: profile,
    SOTERAI_LITE_F15D_PHASE: "peer",
    SOTERAI_LITE_F15D_PEER_ROOT: root,
    SOTERAI_LITE_F15D_EVIDENCE: (0, import_node_path.join)(root, "peer-results.json"),
    SOTERAI_LITE_F15D_BUNDLE_SHA256: process.env.SOTERAI_LITE_F15D_BUNDLE_SHA256,
    SOTERAI_LITE_F15D_DRIVER_KIND: "native-bootstrap"
  });
  const child = childProcess.spawn(process.execPath, [`--extensionDevelopmentPath=${context.extensionUri.fsPath}`, `--user-data-dir=${profile}`, `--extensions-dir=${extensions}`, "--new-window", "--disable-extensions", "--disable-extension=vscode.git", "--disable-extension=vscode.github-authentication", "--disable-extension=vscode.microsoft-authentication", "--disable-workspace-trust", "--disable-gpu", "--disable-updates", "--skip-welcome", "--skip-release-notes", workspace2], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
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
  const phase = process.env.SOTERAI_LITE_F15D_PHASE, output = process.env.SOTERAI_LITE_F15D_EVIDENCE;
  if (phase === "peer") {
    try {
      await peer(context, process.env.SOTERAI_LITE_F15D_PEER_ROOT);
    } finally {
      for (const restore of restores.reverse()) restore();
    }
    return;
  }
  const profile = process.env.SOTERAI_LITE_F15D_PROFILE, root = (0, import_node_path.dirname)(profile), current = manager(context), config = vscode.workspace.getConfiguration("soterai");
  const originalFlag = config.inspect("lite.gatewayLifecycle")?.globalValue;
  const runtime = sha(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F15D_BUNDLE_SHA256);
  import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
  const count = phase === "primary" ? 48 : 3, offset = phase === "primary" ? 0 : 16;
  const observations = Array.from({ length: count }, (_, i) => ({ id: phase === "primary" && i >= 40 ? "F15d-D" + String(i - 39).padStart(2, "0") : phase === "primary" && i >= 32 ? "F15c-B" + String(i - 31).padStart(2, "0") : phase === "primary" && i >= 24 ? "F15b-G" + String(i - 23).padStart(2, "0") : phase === "primary" && i >= 16 ? "F15a-J" + String(i - 15).padStart(2, "0") : "F14-H" + String(offset + i + 1).padStart(2, "0"), status: "NOT_RUN", scope: "Actual owned broker lifecycle" }));
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
        const registry = Reflect.get(current, "canaries");
        import_strict.default.equal(typeof registry.rotate, "function");
        await registry.rotate();
        await stopped(current);
        await current.start();
        import_strict.default.notEqual(current.ownedSnapshot().session, before);
      });
      await check(15, async () => {
        await context.globalState.update("soterai.safeMode", { enabled: true, level: "enterprise" });
        await current.restart();
        import_strict.default.equal((await current.status()).safeMode?.level, "enterprise");
      });
      const wires = [], latencies = [];
      const provider = (0, import_node_http.createServer)((req, res) => {
        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", () => {
          wires.push(Buffer.concat(chunks));
          res.setHeader("content-type", "application/json");
          res.end('{"choices":[{"message":{"content":"Public synthetic response"}}]}');
        });
      });
      await new Promise((done) => provider.listen(0, "127.0.0.1", done));
      const address = provider.address();
      import_strict.default.ok(address && typeof address !== "string");
      const originalProvider = config.inspect("broker.openAIProviderUrl")?.globalValue;
      const originalJson = config.inspect("lite.gatewayJsonBodies")?.globalValue;
      const payload = Buffer.from(JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: "Public JSON hello \u{1F642}" }] }));
      const post = (body, type = "application/json") => new Promise((resolve2, reject) => {
        const begin = Date.now(), active = runs.at(-1);
        const req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": type, "content-length": String(body.length) } }, (res) => {
          res.resume();
          res.once("end", () => {
            latencies.push(Date.now() - begin);
            resolve2(res.statusCode ?? 0);
          });
        });
        req.once("error", reject);
        req.end(body);
      });
      try {
        await check(17, async () => {
          await config.update("broker.openAIProviderUrl", `http://127.0.0.1:${address.port}`, vscode.ConfigurationTarget.Global);
          await context.secrets.store("soterai.providerApiKey", "synthetic-f15a-provider-no-account");
          await stopped(current);
          await current.start();
          import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_JSON_BODIES, "1");
          import_strict.default.equal(await post(payload), 200);
          import_strict.default.equal(wires.length, 1);
          import_strict.default.match(wires[0].toString("utf8"), /Public JSON hello 🙂/);
        });
        await check(18, async () => {
          const count2 = wires.length;
          for (const body of [Buffer.from('{"messages":[],"\\u006dessages":[]}'), Buffer.concat([Buffer.from([239, 187, 191]), payload]), Buffer.from([192, 175]), Buffer.from('{"messages":[')]) import_strict.default.equal(await post(body), 400);
          import_strict.default.equal(await post(payload, "text/plain"), 415);
          import_strict.default.equal(wires.length, count2);
        });
        await check(19, async () => {
          const count2 = wires.length, secret = "sk-proj-" + "SYNTHETIC_NATIVE_F15A".repeat(5);
          import_strict.default.ok(await post(Buffer.from(JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: secret }] }))) >= 400);
          import_strict.default.equal(wires.length, count2);
        });
        await check(20, async () => {
          const count2 = wires.length, active = runs.at(-1);
          let req;
          const response = new Promise((resolve2, reject) => {
            req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-length": String(payload.length) } }, (res) => {
              res.resume();
              res.once("end", () => resolve2(res.statusCode ?? 0));
            });
            req.once("error", reject);
            req.write(payload.subarray(0, 20));
          });
          await new Promise((done) => setTimeout(done, 50));
          import_strict.default.equal(wires.length, count2);
          req.end(payload.subarray(20));
          import_strict.default.equal(await response, 200);
          import_strict.default.equal(wires.length, count2 + 1);
        });
        await check(21, async () => {
          const count2 = wires.length, active = runs.at(-1);
          const req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-length": String(payload.length) } });
          req.on("error", () => void 0);
          req.write(payload.subarray(0, 20));
          await new Promise((done) => setTimeout(done, 30));
          req.destroy();
          await new Promise((done) => setTimeout(done, 40));
          import_strict.default.equal(wires.length, count2);
          import_strict.default.equal((await current.status()).running, true);
        });
        await check(22, async () => {
          const saved = context.globalState.get("soterai.safeMode"), count2 = wires.length;
          await config.update("lite.gatewayJsonBodies", false, vscode.ConfigurationTarget.Global);
          await stopped(current);
          await import_strict.default.rejects(current.start());
          import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_JSON_BODIES, "0");
          import_strict.default.notEqual(current.ownedSnapshot().state, "healthy");
          import_strict.default.deepEqual(context.globalState.get("soterai.safeMode"), saved);
          import_strict.default.equal(wires.length, count2);
          await stopped(current);
          await config.update("lite.gatewayJsonBodies", true, vscode.ConfigurationTarget.Global);
          await current.start();
          import_strict.default.equal(await post(payload), 200);
        });
        await check(23, async () => {
          const count2 = wires.length, active = runs.at(-1);
          let req;
          const response = new Promise((resolve2, reject) => {
            req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-length": String(payload.length) } }, (res) => {
              res.resume();
              res.once("end", () => resolve2(res.statusCode ?? 0));
            });
            req.once("error", reject);
            req.write(payload.subarray(0, 20));
          });
          await new Promise((done) => setTimeout(done, 40));
          const stopping = current.stop();
          req.end(payload.subarray(20));
          import_strict.default.ok(await response >= 400);
          await stopping;
          await stopped(current);
          import_strict.default.equal(wires.length, count2);
        });
        await check(24, async () => {
          const pkg = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
          import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayJsonBodies"].scope, "machine");
          import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayJsonBodies"].default, true);
          import_strict.default.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayJsonBodies"));
          import_strict.default.ok(latencies.length > 0);
          import_strict.default.ok(latencies.every((ms) => ms < 5e3));
          await (0, import_promises.writeFile)((0, import_node_path.join)(root, "json-latencies.json"), JSON.stringify({ status: "PASS_SCOPED", milliseconds: latencies, maxMilliseconds: Math.max(...latencies), budgetMilliseconds: 5e3, scope: "Observed complete loopback JSON requests; not a general throughput guarantee" }) + "\n", { flag: "wx" });
        });
        const gzipTimes = [], originalGzip = config.inspect("lite.gatewayGzipBodies")?.globalValue;
        const gpost = (body, coding = "gzip", duplicate = false) => new Promise((resolve2, reject) => {
          const begin = Date.now(), active = runs.at(-1), headers = ["Host", new URL(current.url).host, "Authorization", "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "Content-Type", "application/json", "Content-Length", String(body.length), "Content-Encoding", coding, ...duplicate ? ["Content-Encoding", "gzip"] : []];
          const req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers }, (res) => {
            res.resume();
            res.once("end", () => {
              gzipTimes.push(Date.now() - begin);
              resolve2(res.statusCode ?? 0);
            });
          });
          req.on("error", reject);
          req.end(body);
        });
        try {
          await check(25, async () => {
            await current.start();
            const count2 = wires.length;
            import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_GZIP_BODIES, "1");
            import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload)), 200);
            import_strict.default.equal(wires.length, count2 + 1);
            import_strict.default.deepEqual(JSON.parse(wires.at(-1).toString()), JSON.parse(payload.toString()));
            const pkg = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
            import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayGzipBodies"].scope, "machine");
            import_strict.default.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayGzipBodies"));
          });
          await check(26, async () => {
            const count2 = wires.length, good = (0, import_node_zlib.gzipSync)(payload), bad = Buffer.from(good);
            bad[bad.length - 8] ^= 1;
            for (const data of [bad, good.subarray(0, good.length - 1), Buffer.concat([good, Buffer.from([0])]), Buffer.concat([good, (0, import_node_zlib.gzipSync)(Buffer.alloc(0))]), (0, import_node_zlib.gzipSync)(Buffer.from('{"messages":[],"messages":[]}'))]) import_strict.default.equal(await gpost(data), 400);
            import_strict.default.equal(wires.length, count2);
          });
          await check(27, async () => {
            const count2 = wires.length;
            import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(Buffer.alloc(1e5, 65))), 413);
            import_strict.default.equal(wires.length, count2);
          });
          await check(28, async () => {
            const count2 = wires.length;
            import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload), "gzip, identity"), 415);
            import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload), "gzip", true), 415);
            import_strict.default.equal(wires.length, count2);
          });
          await check(29, async () => {
            const count2 = wires.length, secret = "sk-proj-" + "SYNTHETIC_NATIVE_GZIP_F15D".repeat(5);
            import_strict.default.ok(await gpost((0, import_node_zlib.gzipSync)(Buffer.from(JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: secret }] })))) >= 400);
            import_strict.default.equal(wires.length, count2);
          });
          await check(30, async () => {
            const saved = context.globalState.get("soterai.safeMode");
            await config.update("lite.gatewayGzipBodies", false, vscode.ConfigurationTarget.Global);
            await stopped(current);
            await current.start();
            import_strict.default.equal((await current.status()).running, true);
            import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_GZIP_BODIES, "0");
            const count2 = wires.length;
            import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload)), 503);
            import_strict.default.equal(wires.length, count2);
            import_strict.default.equal(await post(payload), 200);
            import_strict.default.deepEqual(context.globalState.get("soterai.safeMode"), saved);
            await config.update("lite.gatewayGzipBodies", true, vscode.ConfigurationTarget.Global);
            await stopped(current);
            await current.start();
          });
          await check(31, async () => {
            const data = (0, import_node_zlib.gzipSync)(payload), count2 = wires.length, active = runs.at(-1);
            let req;
            const result2 = new Promise((resolve2, reject) => {
              req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "gzip", "content-length": String(data.length) } }, (res) => {
                res.resume();
                res.once("end", () => resolve2(res.statusCode ?? 0));
              });
              req.on("error", reject);
              req.write(data.subarray(0, data.length - 8));
            });
            await new Promise((done) => setTimeout(done, 40));
            import_strict.default.equal(wires.length, count2);
            req.end(data.subarray(data.length - 8));
            import_strict.default.equal(await result2, 200);
            import_strict.default.equal(wires.length, count2 + 1);
          });
          await check(32, async () => {
            const data = (0, import_node_zlib.gzipSync)(payload), count2 = wires.length, active = runs.at(-1);
            const cancelled = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "gzip", "content-length": String(data.length) } });
            cancelled.on("error", () => void 0);
            cancelled.write(data.subarray(0, 15));
            await new Promise((done) => setTimeout(done, 25));
            cancelled.destroy();
            await new Promise((done) => setTimeout(done, 25));
            import_strict.default.equal(wires.length, count2);
            let req;
            const result2 = new Promise((resolve2) => {
              req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "gzip", "content-length": String(data.length) } }, (res) => {
                res.resume();
                res.once("end", () => resolve2(res.statusCode ?? 0));
              });
              req.on("error", () => resolve2(0));
              req.write(data.subarray(0, 15));
            });
            await new Promise((done) => setTimeout(done, 35));
            const stopping = current.stop();
            await new Promise((done) => setTimeout(done, 35));
            req.end(data.subarray(15));
            const status = await result2;
            import_strict.default.ok(status === 0 || status >= 400);
            await stopping;
            await stopped(current);
            import_strict.default.equal(wires.length, count2);
            import_strict.default.ok(gzipTimes.length > 0 && gzipTimes.every((ms) => ms < 5e3));
            await (0, import_promises.writeFile)((0, import_node_path.join)(root, "gzip-latencies.json"), JSON.stringify({ status: "PASS_SCOPED", milliseconds: gzipTimes, maxMilliseconds: Math.max(...gzipTimes), budgetMilliseconds: 5e3, scope: "Observed bounded complete loopback gzip JSON requests" }) + "\n", { flag: "wx" });
          });
          const brTimes = [], originalBrotli = config.inspect("lite.gatewayBrotliBodies")?.globalValue;
          const bpost = (body, coding = "br", duplicate = false) => new Promise((resolve2, reject) => {
            const begin = Date.now(), active = runs.at(-1), headers = ["Host", new URL(current.url).host, "Authorization", "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "Content-Type", "application/json", "Content-Length", String(body.length), "Content-Encoding", coding, ...duplicate ? ["Content-Encoding", "br"] : []];
            const req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers }, (res) => {
              res.resume();
              res.once("end", () => {
                brTimes.push(Date.now() - begin);
                resolve2(res.statusCode ?? 0);
              });
            });
            req.on("error", reject);
            req.end(body);
          });
          try {
            await check(33, async () => {
              await current.start();
              const count2 = wires.length;
              import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_BROTLI_BODIES, "1");
              import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(payload)), 200);
              import_strict.default.equal(wires.length, count2 + 1);
              import_strict.default.deepEqual(JSON.parse(wires.at(-1).toString()), JSON.parse(payload.toString()));
              const pkg = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
              import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayBrotliBodies"].scope, "machine");
              import_strict.default.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayBrotliBodies"));
            });
            await check(34, async () => {
              const count2 = wires.length, good = (0, import_node_zlib.brotliCompressSync)(payload), bad = Buffer.from(good);
              bad.fill(255);
              for (const data of [bad, good.subarray(0, good.length - 1), Buffer.concat([good, Buffer.from([0])]), Buffer.concat([good, (0, import_node_zlib.brotliCompressSync)(Buffer.alloc(0))]), (0, import_node_zlib.brotliCompressSync)(Buffer.from('{"messages":[],"messages":[]}'))]) import_strict.default.equal(await bpost(data), 400);
              import_strict.default.equal(wires.length, count2);
            });
            await check(35, async () => {
              const count2 = wires.length;
              import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(Buffer.alloc(1e5, 65))), 413);
              import_strict.default.equal(wires.length, count2);
            });
            await check(36, async () => {
              const count2 = wires.length;
              import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(payload), "br, identity"), 415);
              import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(payload), "br", true), 415);
              import_strict.default.equal(wires.length, count2);
            });
            await check(37, async () => {
              const count2 = wires.length, secret = "sk-proj-" + "SYNTHETIC_NATIVE_GZIP_F15B".repeat(5);
              import_strict.default.ok(await bpost((0, import_node_zlib.brotliCompressSync)(Buffer.from(JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: secret }] })))) >= 400);
              import_strict.default.equal(wires.length, count2);
            });
            await check(38, async () => {
              const saved = context.globalState.get("soterai.safeMode");
              await config.update("lite.gatewayBrotliBodies", false, vscode.ConfigurationTarget.Global);
              await stopped(current);
              await current.start();
              import_strict.default.equal((await current.status()).running, true);
              import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_BROTLI_BODIES, "0");
              const count2 = wires.length;
              import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(payload)), 503);
              import_strict.default.equal(wires.length, count2);
              import_strict.default.equal(await post(payload), 200);
              import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload)), 200);
              import_strict.default.deepEqual(context.globalState.get("soterai.safeMode"), saved);
              await config.update("lite.gatewayBrotliBodies", true, vscode.ConfigurationTarget.Global);
              await stopped(current);
              await current.start();
            });
            await check(39, async () => {
              const data = (0, import_node_zlib.brotliCompressSync)(payload), count2 = wires.length, active = runs.at(-1);
              let req;
              const result2 = new Promise((resolve2, reject) => {
                req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "br", "content-length": String(data.length) } }, (res) => {
                  res.resume();
                  res.once("end", () => resolve2(res.statusCode ?? 0));
                });
                req.on("error", reject);
                req.write(data.subarray(0, data.length - 8));
              });
              await new Promise((done) => setTimeout(done, 40));
              import_strict.default.equal(wires.length, count2);
              req.end(data.subarray(data.length - 8));
              import_strict.default.equal(await result2, 200);
              import_strict.default.equal(wires.length, count2 + 1);
            });
            await check(40, async () => {
              const data = (0, import_node_zlib.brotliCompressSync)(payload), count2 = wires.length, active = runs.at(-1);
              const cancelled = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "br", "content-length": String(data.length) } });
              cancelled.on("error", () => void 0);
              cancelled.write(data.subarray(0, 15));
              await new Promise((done) => setTimeout(done, 25));
              cancelled.destroy();
              await new Promise((done) => setTimeout(done, 25));
              import_strict.default.equal(wires.length, count2);
              let req;
              const result2 = new Promise((resolve2) => {
                req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "br", "content-length": String(data.length) } }, (res) => {
                  res.resume();
                  res.once("end", () => resolve2(res.statusCode ?? 0));
                });
                req.on("error", () => resolve2(0));
                req.write(data.subarray(0, 15));
              });
              await new Promise((done) => setTimeout(done, 35));
              const stopping = current.stop();
              await new Promise((done) => setTimeout(done, 35));
              req.end(data.subarray(15));
              const status = await result2;
              import_strict.default.ok(status === 0 || status >= 400);
              await stopping;
              await stopped(current);
              import_strict.default.equal(wires.length, count2);
              import_strict.default.ok(brTimes.length > 0 && brTimes.every((ms) => ms < 5e3));
              await (0, import_promises.writeFile)((0, import_node_path.join)(root, "brotli-latencies.json"), JSON.stringify({ status: "PASS_SCOPED", milliseconds: brTimes, maxMilliseconds: Math.max(...brTimes), budgetMilliseconds: 5e3, scope: "Observed bounded complete loopback Brotli JSON requests" }) + "\n", { flag: "wx" });
            });
            const deflateTimes = [], originalDeflate = config.inspect("lite.gatewayDeflateBodies")?.globalValue;
            const dpost = (body, coding = "deflate", duplicate = false) => new Promise((resolve2, reject) => {
              const begin = Date.now(), active = runs.at(-1), headers = ["Host", new URL(current.url).host, "Authorization", "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "Content-Type", "application/json", "Content-Length", String(body.length), "Content-Encoding", coding, ...duplicate ? ["Content-Encoding", "deflate"] : []];
              const req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers }, (res) => {
                res.resume();
                res.once("end", () => {
                  deflateTimes.push(Date.now() - begin);
                  resolve2(res.statusCode ?? 0);
                });
              });
              req.on("error", reject);
              req.end(body);
            });
            try {
              await check(41, async () => {
                await current.start();
                const count2 = wires.length;
                import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_DEFLATE_BODIES, "1");
                import_strict.default.equal(await dpost((0, import_node_zlib.deflateSync)(payload)), 200);
                import_strict.default.equal(wires.length, count2 + 1);
                import_strict.default.deepEqual(JSON.parse(wires.at(-1).toString()), JSON.parse(payload.toString()));
                const pkg = JSON.parse(await (0, import_promises.readFile)((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
                import_strict.default.equal(pkg.contributes.configuration.properties["soterai.lite.gatewayDeflateBodies"].scope, "machine");
                import_strict.default.ok(pkg.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.gatewayDeflateBodies"));
              });
              await check(42, async () => {
                await current.request("/v1/safe-mode/enable", { method: "POST", body: JSON.stringify({ level: "enterprise" }) });
                for (const [coding, encode] of [["gzip", import_node_zlib.gzipSync], ["br", import_node_zlib.brotliCompressSync], ["deflate", import_node_zlib.deflateSync]]) await import_strict.default.rejects(current.request("/v1/safe-mode/enable", { method: "POST", headers: { "content-encoding": coding }, body: new Uint8Array(encode(Buffer.alloc(0))).buffer }));
                import_strict.default.equal((await current.status()).safeMode?.level, "enterprise");
                const count2 = wires.length, good = (0, import_node_zlib.deflateSync)(payload), bad = Buffer.from(good);
                bad.fill(255);
                for (const data of [(0, import_node_zlib.deflateRawSync)(payload), (0, import_node_zlib.gzipSync)(payload), (0, import_node_zlib.brotliCompressSync)(payload), bad, good.subarray(0, good.length - 1), Buffer.concat([good, Buffer.from([0])]), Buffer.concat([good, (0, import_node_zlib.deflateSync)(Buffer.alloc(0))]), (0, import_node_zlib.deflateSync)(Buffer.from('{"messages":[],"messages":[]}'))]) import_strict.default.equal(await dpost(data), 400);
                import_strict.default.equal(wires.length, count2);
              });
              await check(43, async () => {
                const count2 = wires.length;
                import_strict.default.equal(await dpost((0, import_node_zlib.deflateSync)(Buffer.alloc(1e5, 65))), 413);
                import_strict.default.equal(wires.length, count2);
              });
              await check(44, async () => {
                const count2 = wires.length;
                import_strict.default.equal(await dpost((0, import_node_zlib.deflateSync)(payload), "deflate, identity"), 415);
                import_strict.default.equal(await dpost((0, import_node_zlib.deflateSync)(payload), "deflate", true), 415);
                import_strict.default.equal(wires.length, count2);
              });
              await check(45, async () => {
                const count2 = wires.length, secret = "sk-proj-" + "SYNTHETIC_NATIVE_GZIP_F15B".repeat(5);
                import_strict.default.ok(await dpost((0, import_node_zlib.deflateSync)(Buffer.from(JSON.stringify({ model: "synthetic", messages: [{ role: "user", content: secret }] })))) >= 400);
                import_strict.default.equal(wires.length, count2);
              });
              await check(46, async () => {
                const saved = context.globalState.get("soterai.safeMode");
                await config.update("lite.gatewayDeflateBodies", false, vscode.ConfigurationTarget.Global);
                await stopped(current);
                await current.start();
                import_strict.default.equal((await current.status()).running, true);
                import_strict.default.equal(runs.at(-1).env.SOTERAI_GATEWAY_DEFLATE_BODIES, "0");
                const count2 = wires.length;
                import_strict.default.equal(await dpost((0, import_node_zlib.deflateSync)(payload)), 503);
                import_strict.default.equal(wires.length, count2);
                import_strict.default.equal(await post(payload), 200);
                import_strict.default.equal(await gpost((0, import_node_zlib.gzipSync)(payload)), 200);
                import_strict.default.equal(await bpost((0, import_node_zlib.brotliCompressSync)(payload)), 200);
                import_strict.default.deepEqual(context.globalState.get("soterai.safeMode"), saved);
                await config.update("lite.gatewayDeflateBodies", true, vscode.ConfigurationTarget.Global);
                await stopped(current);
                await current.start();
              });
              await check(47, async () => {
                const data = (0, import_node_zlib.deflateSync)(payload), count2 = wires.length, active = runs.at(-1);
                let req;
                const result2 = new Promise((resolve2, reject) => {
                  req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "deflate", "content-length": String(data.length) } }, (res) => {
                    res.resume();
                    res.once("end", () => resolve2(res.statusCode ?? 0));
                  });
                  req.on("error", reject);
                  req.write(data.subarray(0, data.length - 8));
                });
                await new Promise((done) => setTimeout(done, 40));
                import_strict.default.equal(wires.length, count2);
                req.end(data.subarray(data.length - 8));
                import_strict.default.equal(await result2, 200);
                import_strict.default.equal(wires.length, count2 + 1);
              });
              await check(48, async () => {
                const data = (0, import_node_zlib.deflateSync)(payload), count2 = wires.length, active = runs.at(-1);
                const cancelled = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "deflate", "content-length": String(data.length) } });
                cancelled.on("error", () => void 0);
                cancelled.write(data.subarray(0, 15));
                await new Promise((done) => setTimeout(done, 25));
                cancelled.destroy();
                await new Promise((done) => setTimeout(done, 25));
                import_strict.default.equal(wires.length, count2);
                let req;
                const result2 = new Promise((resolve2) => {
                  req = (0, import_node_http.request)(current.url + "/v1/ai/openai-compatible/chat/completions", { method: "POST", headers: { authorization: "Bearer " + active.env.SOTERAI_BROKER_TOKEN, "content-type": "application/json", "content-encoding": "deflate", "content-length": String(data.length) } }, (res) => {
                    res.resume();
                    res.once("end", () => resolve2(res.statusCode ?? 0));
                  });
                  req.on("error", () => resolve2(0));
                  req.write(data.subarray(0, 15));
                });
                await new Promise((done) => setTimeout(done, 35));
                const stopping = current.stop();
                await new Promise((done) => setTimeout(done, 35));
                req.end(data.subarray(15));
                const status = await result2;
                import_strict.default.ok(status === 0 || status >= 400);
                await stopping;
                await stopped(current);
                import_strict.default.equal(wires.length, count2);
                import_strict.default.ok(deflateTimes.length > 0 && deflateTimes.every((ms) => ms < 5e3));
                await (0, import_promises.writeFile)((0, import_node_path.join)(root, "deflate-latencies.json"), JSON.stringify({ status: "PASS_SCOPED", milliseconds: deflateTimes, maxMilliseconds: Math.max(...deflateTimes), budgetMilliseconds: 5e3, scope: "Observed bounded complete loopback deflate JSON requests" }) + "\n", { flag: "wx" });
              });
            } finally {
              await stopped(current);
              await config.update("lite.gatewayDeflateBodies", originalDeflate, vscode.ConfigurationTarget.Global);
            }
          } finally {
            await stopped(current);
            await config.update("lite.gatewayBrotliBodies", originalBrotli, vscode.ConfigurationTarget.Global);
          }
        } finally {
          await stopped(current);
          await config.update("lite.gatewayGzipBodies", originalGzip, vscode.ConfigurationTarget.Global);
        }
      } finally {
        await stopped(current);
        await config.update("lite.gatewayJsonBodies", originalJson, vscode.ConfigurationTarget.Global);
        await config.update("broker.openAIProviderUrl", originalProvider, vscode.ConfigurationTarget.Global);
        await context.secrets.delete("soterai.providerApiKey");
        await new Promise((done) => {
          provider.close(() => done());
          provider.closeIdleConnections();
        });
      }
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
