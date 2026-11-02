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

// docs/soterai-lite/evidence/20261101-f28-reliability-9a4c2e71/native-reliability-03.host.ts
var native_reliability_03_host_exports = {};
__export(native_reliability_03_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(native_reliability_03_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = __toESM(require("node:path"));
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_crypto = require("node:crypto");
var PREFIX = "SOTERAI_LITE_F28_";
var FLAG = "lite.reliability";
var MARKER = ".synthetic-lite-f28-host";
var PUBLIC = "Public F28 operational note.\n";
var PRIVATE = "SYNTHETIC_F28_VALUE_NEVER_RELEASE_20261101";
var ENV = "PRIVATE_TOKEN=" + PRIVATE + "\nPUBLIC_PORT=8080\n";
var MASKED = "PRIVATE_TOKEN=[MASKED]\nPUBLIC_PORT=[MASKED]";
var originalOpen = import_promises.default.open;
var sha = (v) => (0, import_node_crypto.createHash)("sha256").update(v).digest("hex");
var primaryScopes = [
  "Exact four packaged runtimes, driver, default-true restricted machine setting and native command",
  "Actual activation-body measurement is within the fixed startup bound and reader is ready",
  "Actual packaged public read has exact native consent and useful output",
  "Sensitive saved environment returns names with every value masked and no original document",
  "Cancelled actual native consent releases no text",
  "Oversized default input reaches no consent and releases no prefix",
  "Binary and malformed UTF8 saved inputs release no partial result",
  "Actual multiple-hardlink input is withheld",
  "Actual internal Windows directory junction is withheld",
  "Actual workspace-root junction alias is withheld",
  "Deterministically scheduled actual file replacement before open is withheld before consent",
  "Deterministically scheduled actual parent replacement before open is withheld before consent",
  "Deterministically scheduled actual same-length content drift is withheld before consent",
  "Actual second workspace root preserves independent policy and public control",
  "Actual workspace-folder change revokes a pending native approval",
  "Flag withdrawal with unfinished real open withholds and retains its slot until observed close",
  "Disabled shared reader withholds new original reads",
  "Re-enable requires a fresh native consent and exact public control",
  "Actual five-second owned read expiry withholds while unfinished IO keeps its slot until real close",
  "Actual packaged selected128 reads in a4096-file repo remain under the whole-scan measurement bound",
  "Two concurrent isolated native windows preserve machine-flag/read isolation and close the peer naturally",
  "Actual filesystem outage is a generic withheld result without raw diagnostic reflection",
  "No original synthetic environment value enters native TextDocuments or public result metadata",
  "Runtime bytes stay exact and all delayed source handles are observed closed",
  "Primary withdrawal persists disabled state and an exact restart basis with no active reads"
];
var restartScopes = [
  "Actual same-profile restart preserves exact runtime and disabled shared reader",
  "Re-enable after restart requires fresh exact native public consent",
  "Sensitive saved values remain masked after restart",
  "Pending approval is revoked by disabling the guard without returning originals",
  "Reviewed fixture withdrawal restores the original owner setting and observes zero active reads"
];
var root = "";
var parent = "";
var profile = "";
var output = "";
var phase = "";
var config;
var decision = async () => "Allow safe read once";
var prompts = 0;
var docEvents = 0;
var originalFlag;
var sourceOpened = 0;
var sourceClosed = 0;
var fixtureHandles = 0;
var driverFailure = null;
var restorers = [];
var listeners = [];
var measurements = [];
var peerChildren = [];
var peerOwner = { started: false, closed: false, stdoutEOF: false, stderrEOF: false, timedOut: false };
function setupDiagnostic() {
  return { halted: fixtureHandles !== 0 || peerOwner.started && (!peerOwner.closed || !peerOwner.stdoutEOF || !peerOwner.stderrEOF), busyChildren: peerOwner.started && !peerOwner.closed ? 1 : 0, timedOutChildren: peerOwner.timedOut ? 1 : 0, unfinishedFixtureHandles: fixtureHandles };
}
var wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function bounded(work, milliseconds = 1e4) {
  let timer;
  try {
    return await Promise.race([work, new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(Error("Bounded synthetic operation incomplete.")), milliseconds);
    })]);
  } finally {
    clearTimeout(timer);
  }
}
async function until(predicate, milliseconds = 1e4) {
  const end = performance.now() + milliseconds;
  while (performance.now() < end) {
    if (await predicate()) return;
    await wait(20);
  }
  throw Error("Bounded synthetic observation incomplete.");
}
function patch(target, name, value) {
  const item = target, old = item[name];
  item[name] = value;
  let restored = false;
  const restore = () => {
    if (!restored) {
      restored = true;
      item[name] = old;
    }
  };
  restorers.push(restore);
  return restore;
}
function within(base, file2) {
  const relative = import_node_path.default.relative(import_node_path.default.resolve(base), import_node_path.default.resolve(file2));
  return relative === "" || relative !== ".." && !relative.startsWith(".." + import_node_path.default.sep) && !import_node_path.default.isAbsolute(relative);
}
var file = (relative) => import_node_path.default.join(root, relative);
var uri = (relative) => vscode.Uri.file(file(relative));
async function put(filename, value) {
  (0, import_strict.default)(within(parent, filename));
  await import_promises.default.writeFile(filename, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
}
async function status() {
  const value = await vscode.commands.executeCommand("soterai.readReliabilityStatus");
  (0, import_strict.default)(value);
  return value;
}
async function setFlag(value) {
  await config.update(FLAG, value, vscode.ConfigurationTarget.Global);
  await until(() => config.inspect(FLAG)?.globalValue === value);
  await wait(30);
}
function withheld(value) {
  (0, import_strict.default)(value && value.status !== "ALLOWED_ONCE");
  import_strict.default.equal(Object.hasOwn(value, "text"), false);
  (0, import_strict.default)(!JSON.stringify(value).includes(PRIVATE));
}
async function read(relative) {
  const result = await vscode.commands.executeCommand("soterai.readProjectFileSafely", uri(relative));
  (0, import_strict.default)(result);
  return result;
}
async function publicRead(relative = "public.txt") {
  const before = prompts, result = await read(relative);
  import_strict.default.equal(result.status, "ALLOWED_ONCE");
  import_strict.default.equal(result.text, PUBLIC);
  import_strict.default.equal(prompts, before + 1);
}
async function runtimes(context) {
  const extension = vscode.extensions.getExtension("soterai.soterai-ide-guard");
  (0, import_strict.default)(extension && extension.isActive);
  import_strict.default.equal(extension.extensionPath.toLowerCase(), context.extensionPath.toLowerCase());
  const rows = [];
  for (const name of ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js", "pre-commit-client.js"]) {
    const raw = await import_promises.default.readFile(import_node_path.default.join(extension.extensionPath, "dist", name));
    rows.push({ name, bytes: raw.length, sha256: sha(raw) });
  }
  import_strict.default.equal(rows[0].sha256, process.env[PREFIX + "BUNDLE_SHA256"]);
  return rows;
}
async function beforeActivate(context) {
  phase = process.env[PREFIX + "PHASE"] ?? "";
  output = process.env[PREFIX + "EVIDENCE"] ?? "";
  profile = process.env[PREFIX + "PROFILE"] ?? "";
  (0, import_strict.default)(["primary", "restart", "peer"].includes(phase));
  (0, import_strict.default)(import_node_path.default.isAbsolute(output) && import_node_path.default.isAbsolute(profile));
  import_strict.default.equal(context.extensionMode, vscode.ExtensionMode.Development);
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  parent = import_node_path.default.dirname(root);
  (0, import_strict.default)(/^D:\\SoterAI-Lite-test-profiles\\f28-reliability-native-[0-9TZ]+-[a-f0-9]{8}\\workspace$/i.test(root));
  import_strict.default.equal(import_node_path.default.resolve(profile).toLowerCase(), import_node_path.default.join(parent, phase === "peer" ? "peer-profile" : "profile").toLowerCase());
  import_strict.default.equal(import_node_path.default.resolve(process.env.USERPROFILE ?? "").toLowerCase(), import_node_path.default.resolve(profile).toLowerCase());
  (0, import_strict.default)(within(parent, output) && !within(root, output));
  import_strict.default.equal(await import_promises.default.readFile(file(MARKER), "utf8"), "synthetic-only-v1");
  (0, import_strict.default)(vscode.workspace.isTrusted && !vscode.env.remoteName);
  config = vscode.workspace.getConfiguration("soterai");
  originalFlag = config.inspect(FLAG)?.globalValue;
  await context.globalState.update("soterai.onboarded", true);
  patch(vscode.window, "showWarningMessage", async (...args) => {
    if (args.includes("Allow safe read once")) {
      prompts++;
      (0, import_strict.default)(!String(args[1]?.detail ?? "").includes(PRIVATE));
      return decision(...args);
    }
    return void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async () => void 0);
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.uri.scheme === "file" && document.uri.fsPath.toLowerCase() === file(".env.f28").toLowerCase()) docEvents++;
  }));
  if (phase === "primary") {
    await import_promises.default.writeFile(file("public.txt"), PUBLIC, { flag: "wx" });
    await import_promises.default.writeFile(file(".env.f28"), ENV, { flag: "wx" });
    for (const name of ["file-race.txt", "content-race.txt", "cancel-open.txt", "timeout-open.txt", "outage.txt"]) await import_promises.default.writeFile(file(name), "public", { flag: "wx" });
    await import_promises.default.mkdir(file("parent-race"));
    await import_promises.default.writeFile(file("parent-race/public.txt"), "public", { flag: "wx" });
    await import_promises.default.mkdir(file("bulk"));
    for (let first = 0; first < 4096; first += 32) await Promise.all(Array.from({ length: 32 }, (_, j) => import_promises.default.writeFile(file("bulk/public-" + (first + j) + ".txt"), PUBLIC, { flag: "wx" })));
  }
}
async function delayedOpen(relative, action) {
  const target = file(relative);
  let enter, release, opened = 0, closed = 0;
  const entered = new Promise((resolve) => {
    enter = resolve;
  }), hold = new Promise((resolve) => {
    release = resolve;
  });
  const restore = patch(import_promises.default, "open", async (...args) => {
    const handle = await originalOpen(...args);
    if (import_node_path.default.resolve(String(args[0])).toLowerCase() !== target.toLowerCase()) return handle;
    sourceOpened++;
    fixtureHandles++;
    opened++;
    const close = handle.close.bind(handle);
    let didClose = false;
    patch(handle, "close", async () => {
      await close();
      if (!didClose) {
        didClose = true;
        sourceClosed++;
        fixtureHandles--;
        closed++;
      }
    });
    enter();
    await hold;
    return handle;
  });
  const pending = read(relative);
  void pending.catch(() => void 0);
  try {
    await until(async () => {
      await Promise.race([entered, wait(20)]);
      return opened > 0;
    });
    await action(pending, () => opened, () => closed);
  } finally {
    release();
    await until(() => closed === opened);
    restore();
    await wait(30);
  }
}
async function peerRun(context) {
  const ready = import_node_path.default.join(parent, "f28-peer-ready.json"), probe = import_node_path.default.join(parent, "f28-peer-probe.json"), answer = import_node_path.default.join(parent, "f28-peer-answer.json"), stop = import_node_path.default.join(parent, "f28-peer-stop.json");
  await runtimes(context);
  import_strict.default.equal((await status()).status, "READY");
  await put(ready, { status: "READY", hostPid: process.pid, version: vscode.version, bundle: process.env[PREFIX + "BUNDLE_SHA256"] });
  await until(async () => import_promises.default.stat(probe).then(() => true, () => false), 6e4);
  await publicRead();
  await put(answer, { status: "PASS", reader: (await status()).status, publicDigest: sha(PUBLIC), prompts });
  await until(async () => import_promises.default.stat(stop).then(() => true, () => false), 6e4);
  import_strict.default.equal((await status()).activeReads, 0);
  await put(output, { status: "PASS_SCOPED_F28_PEER_NATIVE_PUBLIC_CONTROL", runtimeBindings: await runtimes(context), driverFailure: null, signalsRequested: 0 });
}
async function concurrentPeer(context) {
  const peerProfile = import_node_path.default.join(parent, "peer-profile"), extensions2 = import_node_path.default.join(parent, "peer-extensions"), ready = import_node_path.default.join(parent, "f28-peer-ready.json"), probe = import_node_path.default.join(parent, "f28-peer-probe.json"), answer = import_node_path.default.join(parent, "f28-peer-answer.json"), stop = import_node_path.default.join(parent, "f28-peer-stop.json");
  await import_promises.default.mkdir(import_node_path.default.join(peerProfile, "User"), { recursive: true });
  await import_promises.default.mkdir(import_node_path.default.join(peerProfile, "Temp"));
  await import_promises.default.mkdir(extensions2);
  await import_promises.default.writeFile(import_node_path.default.join(peerProfile, "User/settings.json"), await import_promises.default.readFile(import_node_path.default.join(profile, "User/settings.json")), { flag: "wx" });
  const env2 = {};
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) if (process.env[key]) env2[key] = process.env[key];
  Object.assign(env2, { USERPROFILE: peerProfile, APPDATA: import_node_path.default.join(peerProfile, "AppData/Roaming"), LOCALAPPDATA: import_node_path.default.join(peerProfile, "AppData/Local"), TEMP: import_node_path.default.join(peerProfile, "Temp"), TMP: import_node_path.default.join(peerProfile, "Temp"), GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: import_node_path.default.join(profile, "empty-global.gitconfig"), GIT_CONFIG_SYSTEM: import_node_path.default.join(profile, "empty-system.gitconfig") });
  for (const suffix of ["BUNDLE_SHA256", "DRIVER_SHA256", "SOURCE_PROOF_SHA256", "VSIX_SHA256"]) env2[PREFIX + suffix] = process.env[PREFIX + suffix];
  env2[PREFIX + "PROFILE"] = peerProfile;
  env2[PREFIX + "PHASE"] = "peer";
  env2[PREFIX + "EVIDENCE"] = import_node_path.default.join(parent, "peer-results.json");
  const child = import_node_child_process.default.spawn(process.execPath, ["--extensionDevelopmentPath=" + context.extensionUri.fsPath, "--user-data-dir=" + peerProfile, "--extensions-dir=" + extensions2, "--new-window", "--disable-extensions", "--disable-extension=vscode.git", "--disable-extension=vscode.github-authentication", "--disable-extension=vscode.microsoft-authentication", "--disable-workspace-trust", "--disable-gpu", "--disable-updates", "--skip-welcome", "--skip-release-notes", root], { env: env2, windowsHide: true, shell: false, stdio: ["ignore", "pipe", "pipe"] });
  peerOwner.started = true;
  let closed = false, code = null, signal = null, stdoutEOF = false, stderrEOF = false, overflow = false, error = false;
  const buffers = { stdout: [], stderr: [] }, sizes = { stdout: 0, stderr: 0 };
  for (const channel of ["stdout", "stderr"]) {
    child[channel].on("data", (chunk) => {
      const left = 1048576 - sizes[channel];
      if (chunk.length > left) overflow = true;
      if (left > 0) {
        const part = chunk.subarray(0, left);
        buffers[channel].push(part);
        sizes[channel] += part.length;
      }
    });
    child[channel].once("end", () => {
      if (channel === "stdout") {
        stdoutEOF = true;
        peerOwner.stdoutEOF = true;
      } else {
        stderrEOF = true;
        peerOwner.stderrEOF = true;
      }
    });
    child[channel].on("error", () => {
      error = true;
    });
  }
  child.on("error", () => {
    error = true;
  });
  child.once("close", (exit, stopped) => {
    closed = true;
    peerOwner.closed = true;
    code = exit;
    signal = stopped;
  });
  try {
    await until(async () => import_promises.default.stat(ready).then(() => true, () => false), 6e4);
    const value = JSON.parse(await import_promises.default.readFile(ready, "utf8"));
    import_strict.default.equal(value.status, "READY");
    import_strict.default.equal(value.bundle, process.env[PREFIX + "BUNDLE_SHA256"]);
    await setFlag(false);
    import_strict.default.equal((await status()).status, "DISABLED");
    await put(probe, { status: "PROBE_AFTER_PRIMARY_FLAG_DISABLED" });
    await until(async () => import_promises.default.stat(answer).then(() => true, () => false), 6e4);
    const answerValue = JSON.parse(await import_promises.default.readFile(answer, "utf8"));
    import_strict.default.equal(answerValue.status, "PASS");
    import_strict.default.equal(answerValue.reader, "READY");
    import_strict.default.equal(answerValue.publicDigest, sha(PUBLIC));
    import_strict.default.equal((await status()).status, "DISABLED");
  } finally {
    await put(stop, { status: "NORMAL_PEER_WINDOW_CLOSE_REQUESTED_NO_SIGNALS" });
    try {
      await until(() => closed && stdoutEOF && stderrEOF, 9e4);
    } catch (error2) {
      peerOwner.timedOut = true;
      throw error2;
    }
    await setFlag(true);
    const streams = [];
    for (const channel of ["stdout", "stderr"]) {
      const raw = Buffer.concat(buffers[channel]), target = import_node_path.default.join(parent, "peer-" + channel + ".bin");
      await import_promises.default.writeFile(target, raw, { flag: "wx" });
      streams.push({ channel, bytes: raw.length, sha256: sha(raw), file: target });
    }
    peerChildren.push({ pid: child.pid ?? null, closed, code, signal, stdoutEOF, stderrEOF, overflow, streamError: error, profile: peerProfile, streams, signalsRequested: 0 });
  }
  (0, import_strict.default)(closed && code === 0 && signal === null && stdoutEOF && stderrEOF && !overflow && !error);
  import_strict.default.equal(JSON.parse(await import_promises.default.readFile(import_node_path.default.join(parent, "peer-results.json"), "utf8")).status, "PASS_SCOPED_F28_PEER_NATIVE_PUBLIC_CONTROL");
}
async function run(context) {
  if (phase === "peer") {
    try {
      await peerRun(context);
    } finally {
      restorers.reverse().forEach((restore) => restore());
      listeners.forEach((l) => l.dispose());
    }
    return;
  }
  const scopes = phase === "primary" ? primaryScopes : restartScopes, rows = scopes.map((scope, index2) => ({ id: "F28-H" + (phase === "primary" ? "P" : "R") + String(index2 + 1).padStart(2, "0"), scope, status: "NOT_RUN" }));
  let bindings = [], safeWithdrawal = "NOT_COMPLETED", readyForInterphase = false, index = 0;
  const check = async (action) => {
    const row = rows[index++];
    (0, import_strict.default)(row);
    try {
      await action();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.errorName = error instanceof Error ? error.name : "UnknownFailure";
      throw error;
    } finally {
      console.log("F28_NATIVE " + row.id + " " + row.status);
    }
  };
  try {
    bindings = await runtimes(context);
    import_strict.default.equal(sha(await import_promises.default.readFile(__filename)), process.env[PREFIX + "DRIVER_SHA256"]);
    if (phase === "primary") {
      await check(async () => {
        const m = context.extension.packageJSON, p = m.contributes.configuration.properties["soterai.lite.reliability"];
        (0, import_strict.default)(p && p.default === true && p.scope === "machine");
        (0, import_strict.default)(m.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai.lite.reliability"));
        (0, import_strict.default)((await vscode.commands.getCommands(true)).includes("soterai.readReliabilityStatus"));
      });
      await check(async () => {
        const s = await status();
        import_strict.default.equal(s.status, "READY");
        import_strict.default.equal(s.limits.startupMilliseconds, 1500);
        (0, import_strict.default)(typeof s.startupMilliseconds === "number" && s.startupMilliseconds >= 0 && s.startupMilliseconds < 1500);
        measurements.push({ kind: "ACTIVATION_BODY_EXCLUDES_MODULE_LOADING", milliseconds: s.startupMilliseconds });
      });
      await check(async () => publicRead());
      await check(async () => {
        const r = await read(".env.f28");
        import_strict.default.equal(r.status, "ALLOWED_ONCE");
        import_strict.default.equal(r.text, MASKED);
      });
      await check(async () => {
        decision = async () => void 0;
        try {
          const r = await read("public.txt");
          import_strict.default.equal(r.status, "DENIED");
          withheld(r);
        } finally {
          decision = async () => "Allow safe read once";
        }
      });
      await check(async () => {
        await import_promises.default.writeFile(file("oversized.txt"), "p".repeat(65537), { flag: "wx" });
        const before = prompts;
        withheld(await read("oversized.txt"));
        import_strict.default.equal(prompts, before);
      });
      await check(async () => {
        for (const [name, bytes] of [["binary.txt", Buffer.from("a\0b")], ["invalid.txt", Buffer.from([192, 175])]]) {
          await import_promises.default.writeFile(file(name), bytes, { flag: "wx" });
          withheld(await read(name));
        }
      });
      await check(async () => {
        await import_promises.default.writeFile(file("hardlink-source.txt"), PUBLIC, { flag: "wx" });
        await import_promises.default.link(file("hardlink-source.txt"), file("hardlink.txt"));
        try {
          withheld(await read("hardlink.txt"));
          import_strict.default.equal((await import_promises.default.lstat(file("public.txt"))).nlink, 1);
        } finally {
          await import_promises.default.writeFile(file("single.txt"), PUBLIC, { flag: "wx" });
        }
      });
      await check(async () => {
        await import_promises.default.mkdir(file("ordinary"));
        await import_promises.default.writeFile(file("ordinary/public.txt"), PUBLIC, { flag: "wx" });
        await import_promises.default.symlink(file("ordinary"), file("linked"), "junction");
        withheld(await read("linked/public.txt"));
      });
      await check(async () => {
        const alias = import_node_path.default.join(parent, "workspace-alias");
        await import_promises.default.symlink(root, alias, "junction");
        (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 0, { uri: vscode.Uri.file(alias) }));
        await until(() => vscode.workspace.workspaceFolders?.length === 2);
        try {
          const r = await vscode.commands.executeCommand("soterai.readProjectFileSafely", vscode.Uri.file(import_node_path.default.join(alias, "ordinary/public.txt")));
          (0, import_strict.default)(r);
          withheld(r);
        } finally {
          (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 1));
          await until(() => vscode.workspace.workspaceFolders?.length === 1);
        }
      });
      await check(async () => {
        let changed = false;
        const before = prompts, restore = patch(import_promises.default, "open", async (...args) => {
          if (!changed && import_node_path.default.resolve(String(args[0])).toLowerCase() === file("file-race.txt").toLowerCase()) {
            changed = true;
            await import_promises.default.rename(file("file-race.txt"), file("file-race.old"));
            await import_promises.default.writeFile(file("file-race.txt"), "public", { flag: "wx" });
          }
          return originalOpen(...args);
        });
        try {
          withheld(await read("file-race.txt"));
          (0, import_strict.default)(changed);
          import_strict.default.equal(prompts, before);
        } finally {
          restore();
        }
      });
      await check(async () => {
        let changed = false;
        const before = prompts, restore = patch(import_promises.default, "open", async (...args) => {
          if (!changed && import_node_path.default.resolve(String(args[0])).toLowerCase() === file("parent-race/public.txt").toLowerCase()) {
            changed = true;
            await import_promises.default.rename(file("parent-race"), file("parent-race-old"));
            await import_promises.default.mkdir(file("parent-race"));
            await import_promises.default.writeFile(file("parent-race/public.txt"), "public", { flag: "wx" });
          }
          return originalOpen(...args);
        });
        try {
          withheld(await read("parent-race/public.txt"));
          (0, import_strict.default)(changed);
          import_strict.default.equal(prompts, before);
        } finally {
          restore();
        }
      });
      await check(async () => {
        let changed = false;
        const before = prompts, restore = patch(import_promises.default, "open", async (...args) => {
          const h = await originalOpen(...args);
          if (import_node_path.default.resolve(String(args[0])).toLowerCase() === file("content-race.txt").toLowerCase()) {
            const native = h.read.bind(h);
            patch(h, "read", async (...a) => {
              const result = await native(...a);
              if (!changed && result.bytesRead) {
                changed = true;
                await import_promises.default.writeFile(file("content-race.txt"), "secret");
              }
              return result;
            });
          }
          return h;
        });
        try {
          withheld(await read("content-race.txt"));
          (0, import_strict.default)(changed);
          import_strict.default.equal(prompts, before);
        } finally {
          restore();
        }
      });
      await check(async () => {
        const second = import_node_path.default.join(parent, "second-workspace");
        await import_promises.default.mkdir(second);
        await import_promises.default.writeFile(import_node_path.default.join(second, "public.txt"), PUBLIC, { flag: "wx" });
        (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 0, { uri: vscode.Uri.file(second) }));
        await until(() => vscode.workspace.workspaceFolders?.length === 2);
        try {
          const r = await vscode.commands.executeCommand("soterai.readProjectFileSafely", vscode.Uri.file(import_node_path.default.join(second, "public.txt")));
          import_strict.default.equal(r?.text, PUBLIC);
          import_strict.default.equal(r?.status, "ALLOWED_ONCE");
          await publicRead();
        } finally {
          (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 1));
          await until(() => vscode.workspace.workspaceFolders?.length === 1);
        }
      });
      await check(async () => {
        let enter, answer;
        const entered = new Promise((r) => {
          enter = r;
        });
        decision = async () => {
          enter();
          return new Promise((r) => {
            answer = r;
          });
        };
        const pending = read("single.txt");
        try {
          await bounded(entered);
          (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 0, { uri: vscode.Uri.file(import_node_path.default.join(parent, "second-workspace")) }));
          await until(() => vscode.workspace.workspaceFolders?.length === 2);
          withheld(await pending);
        } finally {
          answer?.("Allow safe read once");
          decision = async () => "Allow safe read once";
          if (vscode.workspace.workspaceFolders?.length === 2) {
            (0, import_strict.default)(vscode.workspace.updateWorkspaceFolders(1, 1));
            await until(() => vscode.workspace.workspaceFolders?.length === 1);
          }
        }
      });
      await check(async () => {
        await delayedOpen("cancel-open.txt", async (pending) => {
          await setFlag(false);
          withheld(await pending);
          const s = await status();
          import_strict.default.equal(s.status, "DISABLED");
          (0, import_strict.default)(s.activeReads >= 1);
          measurements.push({ kind: "WITHDRAWN_OPEN_SLOT_RETAINED", activeReads: s.activeReads });
        });
        import_strict.default.equal((await status()).activeReads, 0);
      });
      await check(async () => {
        const before = prompts;
        withheld(await read("single.txt"));
        import_strict.default.equal(prompts, before);
      });
      await check(async () => {
        await setFlag(true);
        await publicRead("single.txt");
      });
      await check(async () => {
        await delayedOpen("timeout-open.txt", async (pending) => {
          const start = performance.now();
          withheld(await pending);
          const elapsed = performance.now() - start;
          (0, import_strict.default)(elapsed >= 4500 && elapsed < 8e3);
          (0, import_strict.default)((await status()).activeReads >= 1);
          measurements.push({ kind: "OWNED_FIVE_SECOND_TIMER_WITHHELD_IO_STILL_OWNED", milliseconds: elapsed });
        });
        import_strict.default.equal((await status()).activeReads, 0);
      });
      await check(async () => {
        const start = performance.now(), before = prompts;
        for (let i = 0; i < 128; i++) await publicRead("bulk/public-" + i + ".txt");
        const elapsed = performance.now() - start;
        (0, import_strict.default)(elapsed < 6e4);
        import_strict.default.equal(prompts, before + 128);
        measurements.push({ kind: "ACTUAL_PACKAGED_COMMAND_SELECTED128_OF4096", selected: 128, bulkSyntheticFiles: 4096, milliseconds: elapsed, budgetMilliseconds: 6e4 });
      });
      await check(async () => concurrentPeer(context));
      await check(async () => {
        const restore = patch(import_promises.default, "open", async (...args) => {
          if (import_node_path.default.resolve(String(args[0])).toLowerCase() === file("outage.txt").toLowerCase()) throw Error(PRIVATE);
          return originalOpen(...args);
        });
        try {
          withheld(await read("outage.txt"));
        } finally {
          restore();
        }
      });
      await check(async () => {
        import_strict.default.equal(docEvents, 0);
        (0, import_strict.default)(vscode.workspace.textDocuments.every((d) => !d.getText().includes(PRIVATE)));
      });
      await check(async () => {
        import_strict.default.deepEqual(await runtimes(context), bindings);
        import_strict.default.equal(fixtureHandles, 0);
        import_strict.default.equal(sourceOpened, sourceClosed);
        import_strict.default.equal((await status()).activeReads, 0);
      });
      await check(async () => {
        await setFlag(false);
        withheld(await read("single.txt"));
        import_strict.default.equal((await status()).activeReads, 0);
        await put(import_node_path.default.join(parent, "f28-restart-state.json"), { schemaVersion: 1, syntheticOnly: true, originalFlagPresent: originalFlag !== void 0, originalFlag: originalFlag ?? null, runtimeBindings: bindings, primaryChecks: 25, disabled: true, driverSha256: process.env[PREFIX + "DRIVER_SHA256"] });
        readyForInterphase = true;
        safeWithdrawal = "PRIMARY_DISABLED_NO_PENDING_READS_RESTART_REQUIRED";
      });
    } else {
      const saved = JSON.parse(await import_promises.default.readFile(import_node_path.default.join(parent, "f28-restart-state.json"), "utf8"));
      (0, import_strict.default)(saved.syntheticOnly && saved.schemaVersion === 1 && saved.disabled);
      import_strict.default.deepEqual(saved.runtimeBindings, bindings);
      await check(async () => {
        import_strict.default.equal((await status()).status, "DISABLED");
        const before = prompts;
        withheld(await read("single.txt"));
        import_strict.default.equal(prompts, before);
      });
      await check(async () => {
        await setFlag(true);
        await publicRead("single.txt");
      });
      await check(async () => {
        const r = await read(".env.f28");
        import_strict.default.equal(r.status, "ALLOWED_ONCE");
        import_strict.default.equal(r.text, MASKED);
      });
      await check(async () => {
        let enter, answer;
        const entered = new Promise((r) => {
          enter = r;
        });
        decision = async () => {
          enter();
          return new Promise((r) => {
            answer = r;
          });
        };
        const pending = read("single.txt");
        try {
          await bounded(entered);
          await setFlag(false);
          withheld(await pending);
        } finally {
          answer?.("Allow safe read once");
          decision = async () => "Allow safe read once";
        }
      });
      await check(async () => {
        await setFlag(saved.originalFlagPresent ? saved.originalFlag : void 0);
        import_strict.default.equal(config.inspect(FLAG)?.globalValue, saved.originalFlagPresent ? saved.originalFlag : void 0);
        import_strict.default.equal((await status()).activeReads, 0);
        import_strict.default.deepEqual(await runtimes(context), bindings);
        safeWithdrawal = "ORIGINAL_FLAG_RESTORED_NO_PENDING_READS";
      });
    }
  } catch (error) {
    driverFailure = error instanceof Error ? error.name : "UnknownFailure";
  } finally {
    restorers.reverse().forEach((restore) => restore());
    listeners.forEach((l) => l.dispose());
    const body = { schemaVersion: 1, phase, syntheticOnly: true, scope: "F28_SCRIPTED_ACTUAL_PACKAGED_COMMANDS_AND_DETERMINISTIC_REAL_FS_SCHEDULING_NOT_NATURAL_ADVERSARY", hostVersion: vscode.version, extensionBundleSha256: bindings[0]?.sha256 ?? null, runtimeBindings: bindings, hostProbeSha256: sha(await import_promises.default.readFile(__filename)), sourceProofSha256: process.env[PREFIX + "SOURCE_PROOF_SHA256"] ?? null, observations: rows, expectedChecks: rows.length, passed: rows.filter((r) => r.status === "PASS").length, failed: rows.filter((r) => r.status === "FAIL").length, notRun: rows.filter((r) => r.status === "NOT_RUN").length, driverFailure, readyForInterphase, safeWithdrawal, measurements, sourceHandleOpens: sourceOpened, sourceHandleCloses: sourceClosed, unfinishedFixtureHandles: fixtureHandles, originalEnvironmentDocumentEvents: docEvents, peerChildren, prompts, readStatus: await status(), optionalPrivilegedSymlink: "NOT_TESTED_COMPONENT_CAPABILITY_SKIPS_RETAINED", nestedVendorChildren: "NO_INFERRED_ALL_DESCENDANT_EOF", configuredGitPush: "NOT_AUTHORIZED_NOT_RUN", signalsRequested: 0, independence: "LOW_SCRIPTED_NATIVE" };
    (0, import_strict.default)(!JSON.stringify(body).includes(PRIVATE));
    await put(output, body);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
