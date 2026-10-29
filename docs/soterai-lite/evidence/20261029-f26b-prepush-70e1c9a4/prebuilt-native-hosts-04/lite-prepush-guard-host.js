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

// docs/soterai-lite/evidence/20261029-f26b-prepush-70e1c9a4/native-prepush-04.host.ts.txt
var native_prepush_04_host_ts_exports = {};
__export(native_prepush_04_host_ts_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(native_prepush_04_host_ts_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_http = __toESM(require("node:http"));
var import_node_path = require("node:path");
var import_node_zlib = require("node:zlib");
var GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
var SH = "C:\\Program Files\\Git\\usr\\bin\\sh.exe";
var GIT_SHA256 = "da240fe9bc24895b3e04150a4990b8a6ff329ecabcd8f19684c2cc310da5ef3f";
var SH_SHA256 = "fc362aae1f217d34d02237d99527839dd6cf85b37c7a0277109400bfa0faa594";
var PREFIX = "SOTERAI_LITE_F26B_HOOK_";
var FLAG = "lite.historyHooks.prePush";
var MARKER = ".synthetic-lite-f26b-prepush-host";
var SOURCE = ".env.prepush-worktree-unused";
var RENAMED = "unused-renamed.txt";
var CUSTOM = ".synthetic prepush hooks";
var PRIVATE = "sk-proj-" + "SYNTHETIC_F26B_NATIVE_PROVIDER_ONLY_VALUE".repeat(2);
var SECRET = "API_KEY=" + PRIVATE + "\n";
var ORIGINAL_ENV = "TEST_ONLY_F26B_ORIGINAL_ENV_70e1c9a4";
var RUNTIME_FILES = ["extension.js", "local-ai-broker.js", "soterai-mcp-server.js", "pre-commit-client.js"];
var COMMANDS = ["installPrePushGuard", "resumePrePushGuard", "restorePrePushGuard", "prePushGuardStatus"];
var ACTIONS = ["Review and install", "Resume reviewed owner", "Review and restore"];
var CHILD_LIMIT = 9e4;
var STREAM_LIMIT = 1048576 + 128 * 96 + 8192;
var ZERO = "0".repeat(40);
var nativeSpawn = import_node_child_process.default.spawn;
var nativeRead = import_promises.default.readFile;
var nativeReadSync = import_node_fs.default.readFileSync;
var nativeCreateServer = import_node_http.default.createServer;
var restorers = [];
var listeners = [];
var originalBodies = /* @__PURE__ */ new Map();
var children = [];
var pendingChildren = [];
var wires = [];
var reviews = [];
var stores = { signing: 0, backupKey: 0, record: 0, recovery: 0, unrelated: 0 };
var ownerListeners = [];
var root = "";
var profile = "";
var parent = "";
var output = "";
var caseId = "SETUP";
var setupStage = "initial";
var phase;
var approve = true;
var halted = false;
var metadataLeak = false;
var sourceDocuments = 0;
var sourceDocumentEvents = 0;
var directWorktreeReads = 0;
var directObjectReads = 0;
var ownerServers = 0;
var contextRef;
var ownerEnvironment = {};
var parentEnvironment = "";
var currentPin;
var codeSha256 = "";
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var environmentDigest = () => sha(JSON.stringify(Object.entries(process.env).sort(([a], [b]) => a.localeCompare(b))));
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
var samePath = (a, b) => (0, import_node_path.resolve)(a).toLowerCase() === (0, import_node_path.resolve)(b).toLowerCase();
var recordKey = () => "soterai.prePush.record.v1." + sha(root.toLowerCase());
var markerFile = () => (0, import_node_path.join)(root, ".git", "f26b-original-marker");
var stateFile = () => (0, import_node_path.join)(parent, "prepush-restart-state.json");
var closeReceiptFile = () => (0, import_node_path.join)(parent, "prepush-editor-close.json");
var tipsFile = () => (0, import_node_path.join)(parent, "prepush-synthetic-tips.json");
var configFile = () => (0, import_node_path.join)(root, ".git", "config");
var BASE_CONFIG = "[core]\n repositoryformatversion = 0\n bare = false\n autocrlf = false\n";
var tips;
function safeMetadata(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  if (text.includes(PRIVATE) || text.includes(SECRET) || text.includes(ORIGINAL_ENV)) {
    metadataLeak = true;
    throw Error("Synthetic private content entered public metadata.");
  }
}
function patch(target, name, value) {
  const previous = Object.getOwnPropertyDescriptor(target, name);
  Object.defineProperty(target, name, { configurable: true, writable: true, value });
  restorers.push(() => previous ? Object.defineProperty(target, name, previous) : Reflect.deleteProperty(target, name));
}
async function until(predicate, label, ms = 1e4) {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (await predicate()) return;
    await new Promise((done) => setTimeout(done, 20));
  }
  throw Error(label);
}
function ordinary(file) {
  (0, import_strict.default)(within(parent, file) || within(profile, file), "Fixture filesystem access escaped its retained synthetic container.");
  (0, import_strict.default)(!import_node_fs.default.lstatSync(file).isSymbolicLink());
  (0, import_strict.default)(samePath(import_node_fs.default.realpathSync(file), file));
}
async function fact(file) {
  try {
    ordinary(file);
    const stat = await import_promises.default.lstat(file);
    (0, import_strict.default)(stat.isFile() && stat.nlink === 1 && stat.size <= 536870912);
    const bytes = await nativeRead(file);
    return { present: true, bytes: bytes.length, sha256: sha(bytes), mode: stat.mode & 511 };
  } catch (error) {
    if (error.code === "ENOENT") return { present: false, bytes: 0, sha256: null, mode: null };
    throw error;
  }
}
function hashCode() {
  const digest = (0, import_node_crypto.createHash)("sha256"), chunk = Buffer.alloc(65536), fd = import_node_fs.default.openSync(process.execPath, "r");
  try {
    let offset = 0;
    for (; ; ) {
      const count = import_node_fs.default.readSync(fd, chunk, 0, chunk.length, offset);
      if (count === 0) break;
      offset += count;
      (0, import_strict.default)(offset <= 536870912);
      digest.update(chunk.subarray(0, count));
    }
    return digest.digest("hex");
  } finally {
    import_node_fs.default.closeSync(fd);
    chunk.fill(0);
  }
}
function closed(row) {
  (0, import_strict.default)(row.closed && row.stdoutEOF && row.stderrEOF && !row.busy && !row.spawnFailed && !row.streamError && !row.overflow && !row.timedOut);
  import_strict.default.equal(row.signal, null);
  import_strict.default.equal(row.signalsRequested, 0);
  (0, import_strict.default)(row.argumentsValid && row.environmentValid && row.parentEnvironmentUnchanged && !row.invalidInput);
}
function observe(child, kind, operation, argumentsValid = true, environmentValid = true) {
  const row = {
    caseId,
    kind,
    operation,
    closed: false,
    code: null,
    signal: null,
    stdoutEOF: false,
    stderrEOF: false,
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutSha256: "",
    stderrSha256: "",
    signalsRequested: 0,
    spawnFailed: false,
    streamError: false,
    overflow: false,
    timedOut: false,
    busy: true,
    argumentsValid,
    environmentValid,
    parentEnvironmentUnchanged: false,
    stdinObjects: 0,
    invalidInput: false
  };
  children.push(row);
  let finish, completed = false;
  const actual = new Promise((done) => finish = done);
  pendingChildren.push(actual);
  const out = [], err = [], outHash = (0, import_node_crypto.createHash)("sha256"), errHash = (0, import_node_crypto.createHash)("sha256");
  const timer = setTimeout(() => {
    row.timedOut = true;
    halted = true;
  }, CHILD_LIMIT);
  child.kill = (() => {
    row.signalsRequested++;
    halted = true;
    throw Error("Native pre-push fixture forbids signals.");
  });
  if (kind === "scan" && child.stdin) {
    const end = child.stdin.end;
    child.stdin.end = function(...values) {
      const input = typeof values[0] === "string" || Buffer.isBuffer(values[0]) ? Buffer.from(values[0]).toString("ascii") : "";
      if (!["commits", "batch"].includes(operation) || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
      else row.stdinObjects = input.trimEnd().split("\n").length;
      return Reflect.apply(end, this, values);
    };
  }
  const joinClose = () => {
    if (completed || !row.closed || !row.stdoutEOF || !row.stderrEOF) return;
    completed = true;
    clearTimeout(timer);
    row.busy = false;
    row.stdoutSha256 = outHash.digest("hex");
    row.stderrSha256 = errHash.digest("hex");
    row.parentEnvironmentUnchanged = environmentDigest() === parentEnvironment;
    finish({ receipt: row, stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
  };
  child.once("error", () => {
    row.spawnFailed = child.pid === void 0;
    row.streamError = child.pid !== void 0;
    halted = true;
  });
  child.once("close", (code, signal) => {
    row.closed = true;
    row.code = code;
    row.signal = signal;
    joinClose();
  });
  for (const channel of ["stdout", "stderr"]) {
    const stream = child[channel];
    if (!stream) {
      row.streamError = true;
      halted = true;
      continue;
    }
    stream.on("data", (bytes) => {
      if (channel === "stdout") {
        row.stdoutBytes += bytes.length;
        outHash.update(bytes);
      } else {
        row.stderrBytes += bytes.length;
        errHash.update(bytes);
      }
      if (row.stdoutBytes + row.stderrBytes > STREAM_LIMIT) {
        row.overflow = true;
        halted = true;
      }
      if (kind !== "scan" && !row.overflow) (channel === "stdout" ? out : err).push(Buffer.from(bytes));
    });
    stream.once("end", () => {
      if (channel === "stdout") row.stdoutEOF = true;
      else row.stderrEOF = true;
      joinClose();
    });
    stream.once("error", () => {
      row.streamError = true;
      halted = true;
    });
  }
  return Promise.race([actual, new Promise((_done, reject) => {
    const watch = setInterval(() => {
      if (completed) clearInterval(watch);
      else if (row.timedOut) {
        clearInterval(watch);
        reject(Error("STOP_UNCONFIRMED"));
      }
    }, 25);
  })]);
}
function minimalEnvironment() {
  const env2 = {};
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM", "SystemRoot", "WINDIR", "COMSPEC"])
    if (process.env[key] !== void 0) env2[key] = process.env[key];
  return {
    ...env2,
    GIT_TERMINAL_PROMPT: "0",
    GCM_INTERACTIVE: "never",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PAGER: "",
    PAGER: "",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_PROTOCOL_FROM_USER: "0",
    LC_ALL: "C",
    LANG: "C"
  };
}
function assertDiscovery(env2) {
  (0, import_strict.default)(env2);
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME", "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"])
    import_strict.default.equal(env2[key], ownerEnvironment[key]);
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_CONFIG", "GIT_DIR", "GIT_WORK_TREE"])
    import_strict.default.equal(env2[key], void 0);
}
async function runtimeFacts() {
  const result = [];
  for (const file of RUNTIME_FILES) {
    const bytes = await nativeRead((0, import_node_path.join)(contextRef.extensionUri.fsPath, "dist", file));
    result.push({ file, bytes: bytes.length, sha256: sha(bytes) });
  }
  import_strict.default.equal(result[0].sha256, process.env[PREFIX + "BUNDLE_SHA256"]);
  import_strict.default.equal(result[3].sha256, process.env[PREFIX + "WORKER_SHA256"]);
  return result;
}
async function backupFacts() {
  const directory = (0, import_node_path.join)(contextRef.globalStorageUri.fsPath, "config-backups");
  try {
    const names = (await import_promises.default.readdir(directory)).sort();
    (0, import_strict.default)(names.length <= 32);
    const result = [];
    for (const name of names) {
      import_strict.default.match(name, /^[a-f0-9]{32}[.]enc$/);
      const bytes = await nativeRead((0, import_node_path.join)(directory, name));
      for (const forbidden of [PRIVATE, SECRET, ...[...originalBodies.values()].map((body) => body.toString()), ...[...originalBodies.values()].map((body) => body.toString("base64"))])
        (0, import_strict.default)(!bytes.includes(Buffer.from(forbidden)), "Recovery must not retain a plaintext original in its encrypted file.");
      result.push({ name, fact: await fact((0, import_node_path.join)(directory, name)) });
    }
    return result;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
function envelope(raw, domain) {
  (0, import_strict.default)(currentPin);
  (0, import_strict.default)(raw.length <= 8192);
  const text = raw.toString("utf8"), value = JSON.parse(text);
  import_strict.default.equal(JSON.stringify(value), text);
  import_strict.default.deepEqual(Object.keys(value).sort(), ["domain", "payload", "signature"]);
  import_strict.default.equal(value.domain, domain);
  import_strict.default.match(value.signature, /^[A-Za-z0-9_-]{86}$/);
  const signature = Buffer.from(value.signature, "base64url");
  import_strict.default.equal(signature.toString("base64url"), value.signature);
  (0, import_strict.default)((0, import_node_crypto.verify)(null, Buffer.from(domain + "\0" + JSON.stringify(value.payload)), (0, import_node_crypto.createPublicKey)({ key: Buffer.from(currentPin.publicKey, "base64"), format: "der", type: "spki" }), signature));
  import_strict.default.equal(value.payload.root, root);
  import_strict.default.equal(value.payload.generation, currentPin.generation);
  return value.payload;
}
async function saved() {
  const raw = await contextRef.secrets.get(recordKey());
  (0, import_strict.default)(raw);
  const value = JSON.parse(raw);
  import_strict.default.equal(value.version, 1);
  import_strict.default.match(value.receipt.generation, /^[a-f0-9-]{36}$/);
  const pinBytes = Buffer.from(value.pin, "base64");
  import_strict.default.equal(pinBytes.toString("base64"), value.pin);
  const pin = JSON.parse(pinBytes.toString("utf8"));
  import_strict.default.equal(pin.root, root);
  import_strict.default.equal(pin.generation, value.receipt.generation);
  import_strict.default.equal(pin.worker, (0, import_node_path.join)(contextRef.extensionUri.fsPath, "dist", "pre-commit-client.js"));
  import_strict.default.equal(pin.runtime, process.execPath);
  import_strict.default.equal(pin.workerSha256, process.env[PREFIX + "WORKER_SHA256"]);
  (0, import_strict.default)(within(contextRef.globalStorageUri.fsPath, pin.descriptor));
  currentPin = pin;
  const descriptor = envelope(await nativeRead(pin.descriptor), "SoterAI-PrePush-Descriptor-v1");
  import_strict.default.equal(descriptor.workerSha256, pin.workerSha256);
  import_strict.default.equal(pin.runtimeSha256, codeSha256);
  import_strict.default.equal(descriptor.runtimeSha256, codeSha256);
  const url = new URL(descriptor.endpoint);
  import_strict.default.equal(url.hostname, "127.0.0.1");
  import_strict.default.equal(url.pathname, "/pre-push");
  (0, import_strict.default)(!url.username && !url.password && !url.search && !url.hash && Number(url.port) > 0);
  return { raw, value, pin, descriptor };
}
async function ownerClosed() {
  await until(() => ownerListeners.every((row) => row.closed), "Actual owner listeners did not close after withdrawal.");
}
async function policyFacts() {
  const result = [];
  for (const name of [".aiignore", ".soterai/policy.json", ".soterai/team-policy.json", ".soterai-policy.json"]) result.push({ relative: name, fact: await fact((0, import_node_path.join)(root, ...name.split("/"))) });
  return result;
}
function fileHash(file, expected) {
  (0, import_strict.default)(/^[a-f0-9]{64}$/.test(expected));
  const stat = import_node_fs.default.lstatSync(file, { bigint: true });
  (0, import_strict.default)(stat.isFile() && !stat.isSymbolicLink() && samePath(import_node_fs.default.realpathSync(file), file));
  if (file === GIT) (0, import_strict.default)(stat.nlink === 1n || stat.nlink === 2n);
  else import_strict.default.equal(stat.nlink, 1n);
  const digest = (0, import_node_crypto.createHash)("sha256"), chunk = Buffer.alloc(65536), fd = import_node_fs.default.openSync(file, "r");
  try {
    let total = 0;
    for (; ; ) {
      const bytes = import_node_fs.default.readSync(fd, chunk, 0, chunk.length, total);
      if (!bytes) break;
      total += bytes;
      (0, import_strict.default)(total <= 536870912);
      digest.update(chunk.subarray(0, bytes));
    }
    import_strict.default.equal(digest.digest("hex"), expected);
  } finally {
    import_node_fs.default.closeSync(fd);
    chunk.fill(0);
  }
  const after = import_node_fs.default.lstatSync(file, { bigint: true });
  for (const name of ["dev", "ino", "size", "mtimeNs", "ctimeNs", "birthtimeNs", "nlink"]) import_strict.default.equal(after[name], stat[name]);
}
function rootIdentity() {
  const rows = [];
  for (let directory = root; ; ) {
    const stat = import_node_fs.default.lstatSync(directory, { bigint: true });
    (0, import_strict.default)(stat.isDirectory() && !stat.isSymbolicLink());
    rows.push([directory.toLowerCase(), [stat.dev, stat.ino, stat.birthtimeNs].map((v) => v.toString()).join(":")]);
    const up = (0, import_node_path.dirname)(directory);
    if (up === directory) break;
    directory = up;
  }
  return sha(JSON.stringify(rows));
}
async function manualHistory() {
  await import_strict.default.rejects(import_promises.default.lstat((0, import_node_path.join)(root, ".git")), { code: "ENOENT" });
  for (const directory of ["objects/info", "objects/pack", "refs/heads", "hooks", "info"]) await import_promises.default.mkdir((0, import_node_path.join)(root, ".git", ...directory.split("/")), { recursive: true });
  await import_promises.default.writeFile(configFile(), BASE_CONFIG, { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "HEAD"), "ref: refs/heads/main\n", { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "info", "exclude"), "", { flag: "wx" });
  const created = /* @__PURE__ */ new Set();
  let sequence = 0;
  async function object(type, body) {
    const bytes = Buffer.from(body), raw = Buffer.concat([Buffer.from(type + " " + bytes.length + "\0"), bytes]), oid = (0, import_node_crypto.createHash)("sha1").update(raw).digest("hex");
    if (!created.has(oid)) {
      await import_promises.default.mkdir((0, import_node_path.join)(root, ".git", "objects", oid.slice(0, 2)), { recursive: true });
      await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "objects", oid.slice(0, 2), oid.slice(2)), (0, import_node_zlib.deflateSync)(raw), { flag: "wx" });
      created.add(oid);
    }
    return oid;
  }
  async function commit(name, blob, parents = []) {
    const tree = await object("tree", Buffer.concat([Buffer.from("100644 " + name + "\0"), Buffer.from(blob, "hex")])), when = 17e8 + ++sequence;
    return object("commit", "tree " + tree + "\n" + parents.map((p) => "parent " + p + "\n").join("") + "author Synthetic F26b <f26b@example.invalid> " + when + " +0000\ncommitter Synthetic F26b <f26b@example.invalid> " + when + " +0000\n\nSynthetic native " + sequence + "\n");
  }
  const pub = await object("blob", "Useful public example.\n"), secret = await object("blob", SECRET), unknown = await object("blob", "Public unknown format.\n");
  const publicTip = await commit("public.txt", pub), secretTip = await commit("secret.txt", secret), removed = await commit("public.txt", pub, [secretTip]);
  const renamed = await commit("renamed.txt", pub, [await commit("renamed.txt", secret, [secretTip])]);
  const left = await commit("left.txt", pub, [publicTip]), side = await commit("side.txt", secret, [publicTip]), merge = await commit("merged.txt", pub, [left, side]);
  let capped = publicTip;
  for (let index = 0; index < 32; index++) capped = await commit("public.txt", pub, [capped]);
  tips = { public: publicTip, secret: secretTip, removed, renamed, merge, capped, unknown: await commit("unknown.xyz", unknown) };
  await import_promises.default.writeFile((0, import_node_path.join)(root, ".git", "refs", "heads", "main"), publicTip + "\n", { flag: "wx" });
  await import_promises.default.writeFile((0, import_node_path.join)(root, SOURCE), SECRET, { flag: "wx" });
  await import_promises.default.writeFile(tipsFile(), JSON.stringify(tips), { flag: "wx" });
}
async function call(name) {
  (0, import_strict.default)(!halted);
  const value = await vscode.commands.executeCommand("soterai." + name);
  safeMetadata(value);
  (0, import_strict.default)(value);
  return value;
}
async function idle() {
  await until(async () => !(await call("prePushGuardStatus")).busy, "Owner remained busy.");
}
async function status(expected) {
  const value = await call("prePushGuardStatus");
  import_strict.default.equal(value.status, expected);
  import_strict.default.equal(value.busy, false);
}
var hook = (hooks = ".git/hooks") => (0, import_node_path.join)(root, hooks, "pre-push");
var transcript = (...oids) => Buffer.from(oids.map((oid, index) => `refs/heads/source${index} ${oid} refs/heads/target${index} ${ZERO}
`).join(""));
async function markerCount() {
  try {
    return (await nativeRead(markerFile(), "utf8")).split("\n").filter(Boolean).length;
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
}
function original(exit) {
  const quoted = markerFile().replace(/\\/g, "/").split("'").join(`'"'"'`);
  const bytes = Buffer.from("#!/bin/sh\ncommand printf '%s\\n' \"$1|$2|${SOTERAI_F26B_ORIGINAL_ENV-}|${SOTERAI_PRE_PUSH_REPLAY-absent}|${SOTERAI_PRE_PUSH_STATUS-absent}\"\n'C:/Program Files/Git/usr/bin/cat.exe'\ncommand printf '%s\\n' once >> '" + quoted + "'\nexit " + exit + "\n");
  originalBodies.set(exit, bytes);
  return bytes;
}
async function install(hooksRelative = ".git/hooks") {
  const count = reviews.length;
  import_strict.default.equal((await call("installPrePushGuard")).status, "APPLIED");
  import_strict.default.equal(reviews.length, count + 1);
  import_strict.default.equal(reviews.at(-1)?.action, ACTIONS[0]);
  await status("LIVE");
  const current = await saved();
  import_strict.default.equal(current.value.receipt.hooksRelative, hooksRelative);
  import_strict.default.equal(current.value.state, "APPLIED");
  const body = await nativeRead(hook(hooksRelative), "utf8");
  (0, import_strict.default)(body.startsWith("#!/bin/sh\n# SoterAI Lite pre-push v1 " + current.pin.generation + "\n"));
  (0, import_strict.default)(body.includes("--pre-push --pin") && body.includes("--replay") && body.includes("'C:/Program Files/Git/usr/bin/env.exe' -i "));
  (0, import_strict.default)((await backupFacts()).some((row) => row.name === current.value.receipt.backup + ".enc"));
  import_strict.default.deepEqual(await import_promises.default.readdir((0, import_node_path.join)(root, hooksRelative)), ["pre-push"], "No plaintext sibling recovery or generated stage remains.");
}
async function componentHook(raw, expected, decision, hooksRelative = ".git/hooks", originalExit, extra = {}) {
  (0, import_strict.default)(!halted);
  fileHash(SH, SH_SHA256);
  const beforeWire = wires.length, beforeMarker = await markerCount();
  const hookBefore = await fact(hook(hooksRelative)), configBefore = await fact(configFile()), sourceBefore = await fact((0, import_node_path.join)(root, SOURCE));
  const args = [hook(hooksRelative), "synthetic-remote", "synthetic-local-component-target"], env2 = { ...ownerEnvironment, SOTERAI_F26B_ORIGINAL_ENV: ORIGINAL_ENV, ...extra };
  const child = nativeSpawn(SH, args, { cwd: root, env: env2, shell: false, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const promise = observe(child, "hook-component", "DIRECT_INSTALLED_HOOK_NOT_GIT_PUSH");
  (0, import_strict.default)(child.stdin);
  child.stdin.once("error", () => {
  });
  child.stdin.end(raw);
  const value = await promise;
  closed(value.receipt);
  import_strict.default.equal(value.receipt.code, expected);
  import_strict.default.deepEqual(await fact(hook(hooksRelative)), hookBefore);
  import_strict.default.deepEqual(await fact(configFile()), configBefore);
  import_strict.default.deepEqual(await fact((0, import_node_path.join)(root, SOURCE)), sourceBefore);
  if (decision === "none") import_strict.default.equal(wires.length, beforeWire);
  else {
    import_strict.default.equal(wires.length, beforeWire + 1);
    const wire = wires.at(-1);
    await until(() => wire.requestClosed && wire.responseFinished && wire.responseClosed, "Component route HTTP exchange did not close.");
    import_strict.default.equal(wire.status, decision);
    (0, import_strict.default)(wire.requestValid && wire.signatureValid && wire.transcriptMatched);
    import_strict.default.equal(wire.transcriptSha256, sha(raw));
  }
  if (originalExit !== void 0) {
    import_strict.default.equal(expected, originalExit);
    import_strict.default.equal(await markerCount(), beforeMarker + 1);
    import_strict.default.equal(sha(value.stdout), sha(Buffer.concat([Buffer.from("synthetic-remote|synthetic-local-component-target|" + ORIGINAL_ENV + "|absent|absent\n"), raw])));
  } else {
    import_strict.default.equal(await markerCount(), beforeMarker);
    import_strict.default.equal(value.stdout.length, 0);
  }
  value.stdout.fill(0);
  value.stderr.fill(0);
}
async function directClient(raw, expected, decision) {
  (0, import_strict.default)(currentPin && !halted);
  const before = wires.length;
  const child = nativeSpawn(process.execPath, [currentPin.worker, "--pre-push", "--pin", Buffer.from(JSON.stringify(currentPin)).toString("base64url")], {
    cwd: root,
    env: { SystemRoot: currentPin.systemRoot, WINDIR: currentPin.systemRoot, ELECTRON_RUN_AS_NODE: "1" },
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"]
  });
  const pending = observe(child, "client", "DIRECT_EXACT_FOURTH_RUNTIME_PRE_PUSH");
  (0, import_strict.default)(child.stdin);
  child.stdin.once("error", () => {
  });
  child.stdin.end(raw);
  const done = await pending;
  closed(done.receipt);
  import_strict.default.equal(done.receipt.code, expected);
  import_strict.default.equal(done.stdout.length, 0);
  import_strict.default.equal(wires.length - before, decision === "none" ? 0 : 1);
  if (decision !== "none") {
    const wire = wires.at(-1);
    import_strict.default.equal(wire.status, decision);
    (0, import_strict.default)(wire.requestValid && wire.signatureValid && wire.transcriptMatched);
  }
  done.stdout.fill(0);
  done.stderr.fill(0);
}
function observeRequest(req, res) {
  if (req.method !== "POST" || req.url !== "/pre-push") return;
  const row = { caseId, requestEnded: false, requestClosed: false, responseFinished: false, responseClosed: false, requestValid: false, signatureValid: false, transcriptMatched: false, overflow: false };
  wires.push(row);
  const chunks = [];
  let count = 0, request;
  req.on("data", (chunk) => {
    count += chunk.length;
    if (count > 49152) row.overflow = true;
    else chunks.push(Buffer.from(chunk));
  });
  req.once("end", () => {
    row.requestEnded = true;
    try {
      const body = Buffer.concat(chunks).toString("utf8");
      request = JSON.parse(body);
      safeMetadata(body);
      import_strict.default.equal(JSON.stringify(request), body);
      import_strict.default.deepEqual(Object.keys(request).sort(), ["generation", "nonce", "session", "transcript", "version"]);
      import_strict.default.equal(req.socket.remoteAddress, "127.0.0.1");
      import_strict.default.match(req.headers.host ?? "", /^127[.]0[.]0[.]1:[0-9]+$/);
      import_strict.default.equal(req.headers.origin, void 0);
      import_strict.default.equal(request.version, 1);
      import_strict.default.equal(request.generation, currentPin?.generation);
      import_strict.default.match(request.session, /^[a-f0-9-]{36}$/);
      import_strict.default.match(request.nonce, /^[a-f0-9-]{36}$/);
      const raw = Buffer.from(request.transcript, "base64url");
      import_strict.default.equal(raw.toString("base64url"), request.transcript);
      (0, import_strict.default)(raw.length <= 32768);
      row.transcriptSha256 = sha(raw);
      raw.fill(0);
      row.generation = request.generation;
      row.session = request.session;
      row.nonce = request.nonce;
      row.requestValid = true;
    } catch {
      row.requestValid = false;
    }
    chunks.forEach((chunk) => chunk.fill(0));
  });
  req.once("close", () => row.requestClosed = true);
  const end = res.end;
  res.end = function(...values) {
    try {
      const bytes = values[0];
      if (Buffer.isBuffer(bytes) || typeof bytes === "string") {
        const decision = envelope(Buffer.from(bytes), "SoterAI-PrePush-Decision-v1");
        safeMetadata(decision);
        (0, import_strict.default)(request && row.requestValid);
        import_strict.default.equal(decision.session, request.session);
        import_strict.default.equal(decision.nonce, request.nonce);
        import_strict.default.deepEqual(Object.keys(decision).sort(), ["generation", "nonce", "root", "rootIdentity", "session", "status", "transcriptSha256", "version"]);
        import_strict.default.match(decision.rootIdentity, /^[a-f0-9]{64}$/);
        import_strict.default.equal(decision.rootIdentity, rootIdentity());
        (0, import_strict.default)(["ALLOW", "BLOCK", "UNAVAILABLE", "BUSY"].includes(decision.status));
        row.signatureValid = true;
        row.transcriptMatched = decision.transcriptSha256 === row.transcriptSha256;
        row.rootIdentity = decision.rootIdentity;
        row.status = decision.status;
      }
    } catch {
      row.signatureValid = false;
    }
    return Reflect.apply(end, this, values);
  };
  res.once("finish", () => row.responseFinished = true);
  res.once("close", () => row.responseClosed = true);
}
function productOperation(args, options) {
  const config = ["--no-pager", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "credential.helper=", "-c", "credential.interactive=false", "config", "--null", "--show-origin", "--show-scope", "--no-includes", "--get-regexp", "^(core[.]hookspath|include[.]path|includeif[.].*[.]path|extensions[.]worktreeconfig)$"];
  if (args.length === 1 && args[0] === "--version") {
    assertDiscovery(options.env);
    return { kind: "projection", operation: "version" };
  }
  if (args[0] === "--no-pager" && args.includes("--show-origin")) {
    import_strict.default.deepEqual(args, config);
    import_strict.default.equal(options.cwd, root);
    assertDiscovery(options.env);
    return { kind: "projection", operation: "config" };
  }
  const job = options.env?.HOME;
  (0, import_strict.default)(job && within(profile, job));
  const prefix = ["--no-pager", "--literal-pathspecs", "-c", "core.hooksPath=" + (0, import_node_path.join)(job, "empty-hooks"), "-c", "core.fsmonitor=false", "-c", "credential.helper=", "-c", "commit.gpgSign=false", "--no-lazy-fetch", "--no-replace-objects", "--no-optional-locks", "-c", "protocol.allow=never", "-c", "core.pager=", "-c", "color.ui=false", "-c", "core.attributesFile=" + (0, import_node_path.join)(job, "empty.gitconfig"), "-c", "gc.auto=0", "-c", "maintenance.auto=false"];
  import_strict.default.deepEqual(args.slice(0, prefix.length), prefix);
  const suffix = args.slice(prefix.length);
  for (const key of ["PATH", "NODE_OPTIONS", "NODE_PATH", "GIT_INDEX_FILE", "GIT_CONFIG_COUNT", "GIT_CONFIG_PARAMETERS", "GIT_OBJECT_DIRECTORY"]) import_strict.default.equal(options.env?.[key], void 0);
  if (suffix.length === 1 && suffix[0] === "--version") {
    import_strict.default.equal(options.cwd, job);
    return { kind: "scan", operation: "version" };
  }
  import_strict.default.equal(options.cwd, root);
  if (suffix[0] === "rev-list") {
    import_strict.default.deepEqual(suffix, ["rev-list", "--max-count=33", "--stdin", "--"]);
    return { kind: "scan", operation: "commits" };
  }
  if (suffix[0] === "ls-tree") {
    import_strict.default.equal(suffix.length, 7);
    import_strict.default.match(suffix[5], /^[a-f0-9]{40}$/);
    import_strict.default.deepEqual(suffix, ["ls-tree", "-r", "-z", "--full-tree", "--long", suffix[5], "--"]);
    return { kind: "scan", operation: "tree" };
  }
  import_strict.default.deepEqual(suffix, ["cat-file", "--batch"]);
  return { kind: "scan", operation: "batch" };
}
function setupDiagnostic() {
  return {
    preparedSourceOnly: true,
    syntheticOnly: true,
    stage: setupStage,
    phase,
    caseId,
    halted,
    busyChildren: children.filter((row) => row.busy).length,
    timedOutChildren: children.filter((row) => row.timedOut).length,
    scope: "F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH"
  };
}
async function beforeActivate(context) {
  contextRef = context;
  import_strict.default.equal(process.platform, "win32");
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  (0, import_strict.default)(vscode.workspace.isTrusted && !vscode.env.remoteName);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  parent = (0, import_node_path.dirname)(root);
  profile = process.env[PREFIX + "PROFILE"] ?? "";
  output = process.env[PREFIX + "EVIDENCE"] ?? "";
  const selected = process.env[PREFIX + "PHASE"];
  (0, import_strict.default)(selected === "primary" || selected === "restart");
  phase = selected;
  import_strict.default.equal(process.env[PREFIX + "DRIVER_KIND"], "native-bootstrap");
  import_strict.default.match((0, import_node_path.resolve)(root), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.match((0, import_node_path.resolve)(profile), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(within(parent, profile) && within(parent, output) && !within(root, output) && !within(root, context.globalStorageUri.fsPath));
  ordinary(root);
  ordinary(profile);
  ordinary(parent);
  import_strict.default.equal((await nativeRead((0, import_node_path.join)(root, MARKER), "utf8")).trim(), "synthetic-only-v1");
  for (const key of ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"]) import_strict.default.equal(process.env[key], profile);
  for (const key of ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM"]) {
    const file2 = process.env[key];
    (0, import_strict.default)(file2 && within(profile, file2));
    import_strict.default.equal((await nativeRead(file2)).length, 0);
  }
  import_strict.default.equal(process.env.GIT_CONFIG_NOSYSTEM, "1");
  for (const key of Object.keys(process.env)) if (/^GIT_/i.test(key)) (0, import_strict.default)(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"].includes(key.toUpperCase()));
  for (const key of ["HOMEDRIVE", "HOMEPATH"]) import_strict.default.equal(process.env[key], void 0, "Unknown inherited owner search locations must be removed by isolated launcher.");
  (0, import_strict.default)(process.env.TEMP && within(profile, process.env.TEMP));
  (0, import_strict.default)(process.env.TMP && within(profile, process.env.TMP));
  ownerEnvironment = minimalEnvironment();
  parentEnvironment = environmentDigest();
  codeSha256 = hashCode();
  fileHash(GIT, GIT_SHA256);
  fileHash(SH, SH_SHA256);
  setupStage = "manual-synthetic-loose-history";
  if (phase === "primary") await manualHistory();
  else {
    tips = JSON.parse(await nativeRead(tipsFile(), "utf8"));
    (0, import_strict.default)(Object.values(tips).every((value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)));
  }
  setupStage = "delegated-real-observers";
  patch(import_node_child_process.default, "spawn", (...values) => {
    (0, import_strict.default)(!halted);
    const executable = values[0], args = values[1], options = values[2];
    import_strict.default.equal(executable, GIT);
    (0, import_strict.default)(Array.isArray(args));
    import_strict.default.equal(options.shell, false);
    import_strict.default.equal(options.windowsHide, true);
    import_strict.default.equal(options.timeout, void 0);
    import_strict.default.equal(options.signal, void 0);
    import_strict.default.equal(options.killSignal, void 0);
    const selected2 = productOperation(args, options), child = Reflect.apply(nativeSpawn, import_node_child_process.default, values);
    void observe(child, selected2.kind, selected2.operation).catch(() => {
      halted = true;
    });
    return child;
  });
  patch(import_node_http.default, "createServer", (...values) => {
    const listener = values.at(-1);
    if (typeof listener !== "function") return Reflect.apply(nativeCreateServer, import_node_http.default, values);
    const args = values.slice();
    args[args.length - 1] = function(req, res) {
      observeRequest(req, res);
      return Reflect.apply(listener, this, [req, res]);
    };
    const server = Reflect.apply(nativeCreateServer, import_node_http.default, args);
    if (values[0]?.maxHeaderSize === 4096) {
      ownerServers++;
      const row = { listened: false, loopback: false, closed: false };
      ownerListeners.push(row);
      server.once("listening", () => {
        row.listened = true;
        const address = server.address();
        row.loopback = !!address && typeof address === "object" && address.address === "127.0.0.1" && address.port > 0;
        if (!row.loopback) halted = true;
      });
      server.once("close", () => row.closed = true);
    }
    return server;
  });
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key.startsWith("soterai.prePush.signing.v1.")) stores.signing++;
    else if (key.startsWith("soterai.configBackupKey.v1.")) stores.backupKey++;
    else if (key.startsWith("soterai.prePush.record.v1.")) {
      stores.record++;
      safeMetadata(value);
    } else if (/^soterai[.]prePush[.](?:recovery|receipt)[.]v1[.]/.test(key)) {
      stores.recovery++;
      safeMetadata(value);
    } else stores.unrelated++;
    return store.call(context.secrets, key, value);
  });
  const file = (value) => typeof value === "string" ? value : value instanceof vscode.Uri && value.scheme === "file" ? value.fsPath : void 0;
  const readObserved = (value) => {
    const selected2 = file(value);
    if (!selected2) return;
    if ([SOURCE, RENAMED].some((name) => samePath(selected2, (0, import_node_path.join)(root, name)))) directWorktreeReads++;
    if (within((0, import_node_path.join)(root, ".git", "objects"), selected2)) directObjectReads++;
  };
  patch(import_node_fs.default, "readFileSync", (...values) => {
    readObserved(values[0]);
    return Reflect.apply(nativeReadSync, import_node_fs.default, values);
  });
  patch(import_promises.default, "readFile", (...values) => {
    readObserved(values[0]);
    return Reflect.apply(nativeRead, import_promises.default, values);
  });
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...values) => {
    const selected2 = file(values[0]);
    if (selected2 && within(root, selected2)) sourceDocuments++;
    const content = values[0]?.content;
    if (typeof content === "string") safeMetadata(content);
    return Reflect.apply(open, vscode.workspace, values);
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (document.uri.scheme === "file" && within(root, document.uri.fsPath)) sourceDocumentEvents++;
  }));
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    safeMetadata([message, options, items]);
    const action = items.find((item) => ACTIONS.includes(item));
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ caseId, action, modal: true, approved: approve });
    return approve ? action : void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (...values) => {
    safeMetadata(values);
    return void 0;
  });
  setupStage = "before-real-extension-activation";
}
async function run(context) {
  import_strict.default.equal(context, contextRef);
  const configuration = vscode.workspace.getConfiguration("soterai"), initialFlag = configuration.inspect(FLAG)?.globalValue;
  const runtimes = await runtimeFacts(), executionManifest = await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"));
  const initialPolicy = await policyFacts();
  const observations = [], checks = [];
  let driverFailure, restartState, prior, customOriginal, beforeCustom;
  const add = (scope, work) => checks.push({ scope, work });
  const noEffects = () => ({ stores: { ...stores }, servers: ownerServers, wires: wires.length });
  const privateClean = () => {
    import_strict.default.equal(sourceDocuments, 0);
    import_strict.default.equal(sourceDocumentEvents, 0);
    import_strict.default.equal(directWorktreeReads, 0);
    import_strict.default.equal(directObjectReads, 0);
    (0, import_strict.default)(!metadataLeak);
    import_strict.default.equal(environmentDigest(), parentEnvironment);
  };
  const setFlag = async (value) => {
    await configuration.update(FLAG, value, vscode.ConfigurationTarget.Global);
    await idle();
  };
  if (phase === "primary") {
    add("Exact four runtimes/four commands/default-false restricted machine setting are present", async () => {
      import_strict.default.equal(configuration.inspect(FLAG)?.defaultValue, false);
      (0, import_strict.default)(initialFlag === void 0 || initialFlag === false);
      const commands2 = await vscode.commands.getCommands(true), manifest = JSON.parse(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "package.json"), "utf8"));
      for (const name of COMMANDS) {
        (0, import_strict.default)(commands2.includes("soterai." + name));
        (0, import_strict.default)(manifest.contributes.commands.some((row) => row.command === "soterai." + name));
      }
      const entry = manifest.contributes.configuration.properties["soterai." + FLAG];
      import_strict.default.equal(entry.default, false);
      import_strict.default.equal(entry.scope, "machine");
      (0, import_strict.default)(manifest.capabilities.untrustedWorkspaces.restrictedConfigurations.includes("soterai." + FLAG));
      privateClean();
    });
    add("Default-disabled install rejects caller authority without keys/backups/hook/listener", async () => {
      const before = noEffects();
      const reply = await vscode.commands.executeCommand("soterai.installPrePushGuard", { approve: true });
      import_strict.default.equal(reply.status, "UNAVAILABLE");
      import_strict.default.deepEqual(noEffects(), before);
      (0, import_strict.default)(!(await fact(hook())).present);
      await status("UNAVAILABLE");
    });
    add("Workspace setting cannot enable the machine owner route", async () => {
      await import_strict.default.rejects(
        async () => {
          await configuration.update(FLAG, true, vscode.ConfigurationTarget.Workspace);
        },
        (error) => error instanceof Error && error.name === "CodeExpectedError" && error.message.includes("soterai." + FLAG) && error.message.includes("Workspace Settings") && error.message.includes("only into User settings")
      );
      await idle();
      import_strict.default.equal(configuration.get(FLAG), false);
      import_strict.default.equal(configuration.inspect(FLAG)?.workspaceValue, void 0);
      import_strict.default.equal((await call("installPrePushGuard")).status, "UNAVAILABLE");
    });
    add("Global enable and cancelled explicit install leave no recovery/signing/owner effects", async () => {
      await setFlag(true);
      const before = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("installPrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), before);
      (0, import_strict.default)(!(await fact(hook())).present);
      await status("OWNER_REVIEW_REQUIRED");
    });
    add("Reviewed default installation creates signed live owner and encrypted absence recovery", async () => {
      await install();
      const current = await saved();
      import_strict.default.equal(current.value.receipt.originalPresent, false);
      import_strict.default.equal(stores.signing, 1);
      import_strict.default.equal(stores.backupKey, 1);
    });
    add("Direct installed wrapper public history passes signed full-object component route", async () => {
      await componentHook(transcript(tips.public), 0, "ALLOW");
      const rows = children.filter((row) => row.caseId === caseId && row.kind === "scan");
      import_strict.default.deepEqual(rows.map((row) => row.operation), ["version", "commits", "tree", "batch"]);
    });
    add("Exact packaged fourth runtime runs as actual finite Code Node child", async () => {
      await directClient(transcript(tips.public), 0, "ALLOW");
    });
    add("Removed historical secret is blocked although worktree and proposed tip are outside scanner authority", async () => {
      await componentHook(transcript(tips.removed), 1, "BLOCK");
      (0, import_strict.default)(children.filter((row) => row.caseId === caseId && row.operation === "tree").length >= 2);
    });
    add("Renamed then overwritten historical secret is still blocked", async () => {
      await componentHook(transcript(tips.renamed), 1, "BLOCK");
      (0, import_strict.default)(children.filter((row) => row.caseId === caseId && row.operation === "tree").length >= 3);
    });
    add("Both merge parents remain in scope including removed side-branch secret", async () => {
      await componentHook(transcript(tips.merge), 1, "BLOCK");
      (0, import_strict.default)(children.filter((row) => row.caseId === caseId && row.operation === "tree").length >= 4);
    });
    add("Every proposed tip is scanned and a second secret branch withholds whole request", async () => {
      await componentHook(transcript(tips.public, tips.secret), 1, "BLOCK");
    });
    add("33-commit sentinel makes direct component route unavailable before tree/blob access", async () => {
      await componentHook(transcript(tips.capped), 1, "UNAVAILABLE");
      import_strict.default.deepEqual(children.filter((row) => row.caseId === caseId && row.kind === "scan").map((row) => row.operation), ["version", "commits"]);
    });
    add("Unsupported historical format withholds the whole request", async () => {
      await componentHook(transcript(tips.unknown), 1, "UNAVAILABLE");
    });
    add("Malformed complete transcript refuses before HTTP/scanner/original execution", async () => {
      await componentHook(Buffer.from(transcript(tips.public).toString().trimEnd()), 1, "none");
    });
    add("Deletion-only proposal requires live signed owner and only checked Git version", async () => {
      await componentHook(Buffer.from(`(delete) ${ZERO} refs/heads/main ${tips.public}
`), 0, "ALLOW");
      import_strict.default.deepEqual(children.filter((row) => row.caseId === caseId && row.kind === "scan").map((row) => row.operation), ["version"]);
    });
    add("Cancelled restore preserves exact default installation/live owner/encrypted recovery", async () => {
      const before = await fact(hook()), backups = await backupFacts(), effects = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("restorePrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(await fact(hook()), before);
      import_strict.default.deepEqual(await backupFacts(), backups);
      import_strict.default.deepEqual(noEffects(), effects);
      await status("LIVE");
    });
    add("Reviewed default restore withdraws owner and restores original absence", async () => {
      import_strict.default.equal((await call("restorePrePushGuard")).status, "RESTORED");
      (0, import_strict.default)(!(await fact(hook())).present);
      await idle();
      await status("OWNER_REVIEW_REQUIRED");
    });
    add("Supported local custom hooks path preserves supported original bytes/mode", async () => {
      await import_promises.default.mkdir((0, import_node_path.join)(root, CUSTOM));
      customOriginal = original(7);
      await import_promises.default.writeFile(hook(CUSTOM), customOriginal, { flag: "wx" });
      beforeCustom = await fact(hook(CUSTOM));
      await import_promises.default.writeFile(configFile(), BASE_CONFIG + " hooksPath = " + CUSTOM + "\n");
    });
    add("Cancelled custom install does not alter original or encrypted recovery", async () => {
      const effects = noEffects(), backups = await backupFacts();
      approve = false;
      try {
        import_strict.default.equal((await call("installPrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
      import_strict.default.deepEqual(await backupFacts(), backups);
      import_strict.default.deepEqual(noEffects(), effects);
    });
    add("Reviewed custom installation backs up actual original encrypted and preserves mode", async () => {
      (0, import_strict.default)(beforeCustom);
      await install(CUSTOM);
      import_strict.default.equal((await fact(hook(CUSTOM))).mode, beforeCustom.mode);
      import_strict.default.equal((await saved()).value.receipt.originalPresent, true);
      await backupFacts();
    });
    add("Direct custom wrapper replays exact stdin/arguments/environment once with original exit seven", async () => {
      await componentHook(transcript(tips.public), 7, "ALLOW", CUSTOM, 7);
    });
    add("Custom secret block prevents original execution and marker growth", async () => {
      await componentHook(transcript(tips.removed), 1, "BLOCK", CUSTOM);
    });
    add("Caller reserved-variable collision blocks before HTTP/original execution", async () => {
      await componentHook(transcript(tips.public), 1, "none", CUSTOM, void 0, { SOTERAI_PRE_PUSH_REPLAY: "TEST_ONLY_EXISTING_OWNER_VALUE" });
    });
    add("Actual machine disable withdraws live owner and installed custom wrapper refuses", async () => {
      await setFlag(false);
      await status("UNAVAILABLE");
      await ownerClosed();
      await componentHook(transcript(tips.public), 1, "none", CUSTOM);
    });
    add("Reviewed restore while disabled restores exact original bytes/mode; original direct route retains exit seven", async () => {
      import_strict.default.equal((await call("restorePrePushGuard")).status, "RESTORED");
      import_strict.default.deepEqual(await fact(hook(CUSTOM)), beforeCustom);
      (0, import_strict.default)(customOriginal && (await nativeRead(hook(CUSTOM))).equals(customOriginal));
      await componentHook(transcript(tips.public), 7, "none", CUSTOM, 7);
    });
    add("Default effective path is re-established and fresh installation is explicitly reviewed", async () => {
      await import_promises.default.writeFile(configFile(), BASE_CONFIG);
      await setFlag(true);
      await install();
    });
    add("Owner config-byte drift withdraws and blocks without stale ALLOW; exact config restored without automatic owner", async () => {
      const backups = await backupFacts();
      await import_promises.default.writeFile(configFile(), BASE_CONFIG + "# TEST_ONLY_F26B_CONFIG_DRIFT\n");
      await until(async () => (await call("prePushGuardStatus")).status !== "LIVE", "Config drift must withdraw owner.");
      await idle();
      await ownerClosed();
      await componentHook(transcript(tips.public), 1, "none");
      await import_promises.default.writeFile(configFile(), BASE_CONFIG);
      await status("OWNER_REVIEW_REQUIRED");
      import_strict.default.deepEqual(await backupFacts(), backups);
    });
    add("Cancelled explicit resume after drift preserves old endpoint/key/backup/hook", async () => {
      const current = await saved(), before = await fact(hook()), effects = noEffects(), backups = await backupFacts();
      approve = false;
      try {
        import_strict.default.equal((await call("resumePrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), effects);
      import_strict.default.equal((await saved()).descriptor.session, current.descriptor.session);
      import_strict.default.deepEqual(await fact(hook()), before);
      import_strict.default.deepEqual(await backupFacts(), backups);
    });
    add("Reviewed explicit resume creates a fresh signed session without new signing/recovery keys", async () => {
      const current = await saved(), keys = [stores.signing, stores.backupKey];
      import_strict.default.equal((await call("resumePrePushGuard")).status, "RESUMED");
      await status("LIVE");
      import_strict.default.notEqual((await saved()).descriptor.session, current.descriptor.session);
      import_strict.default.deepEqual([stores.signing, stores.backupKey], keys);
      await componentHook(transcript(tips.public), 0, "ALLOW");
    });
    add("All actual direct children close/EOF/no signals; retain exact restart/withdrawal basis", async () => {
      await Promise.all(pendingChildren);
      children.forEach(closed);
      privateClean();
      const current = await saved();
      import_strict.default.deepEqual(await runtimeFacts(), runtimes);
      import_strict.default.deepEqual(await policyFacts(), initialPolicy);
      (0, import_strict.default)(ownerListeners.every((row) => row.listened && row.loopback));
      restartState = {
        schemaVersion: 1,
        syntheticOnly: true,
        scope: "F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH",
        root,
        ready: true,
        oldFlag: initialFlag,
        runtimeBindings: runtimes,
        executionManifest,
        hook: await fact(hook()),
        config: await fact(configFile()),
        source: await fact((0, import_node_path.join)(root, SOURCE)),
        head: await fact((0, import_node_path.join)(root, ".git", "HEAD")),
        generation: current.pin.generation,
        publicPinSha256: sha(Buffer.from(current.value.pin, "base64")),
        recordSha256: sha(current.raw),
        descriptor: await fact(current.pin.descriptor),
        session: current.descriptor.session,
        tips,
        backupFacts: await backupFacts(),
        ownerEnvironmentSha256: sha(JSON.stringify(ownerEnvironment)),
        driverSha256: sha(await nativeRead(__filename)),
        policy: initialPolicy
      };
      safeMetadata(restartState);
      await import_promises.default.writeFile(stateFile(), JSON.stringify(restartState, null, 2) + "\n", { flag: "wx" });
    });
  } else {
    add("Actual isolated restart does not auto-resume/start listener/write keys or mutate retained bytes", async () => {
      prior = JSON.parse(await nativeRead(stateFile(), "utf8"));
      (0, import_strict.default)(prior && prior.schemaVersion === 1 && prior.ready && prior.syntheticOnly && prior.root === root && prior.scope === "F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH");
      import_strict.default.equal(children.length, 0);
      import_strict.default.equal(wires.length, 0);
      import_strict.default.equal(ownerServers, 0);
      import_strict.default.equal(reviews.length, 0);
      import_strict.default.deepEqual(stores, { signing: 0, backupKey: 0, record: 0, recovery: 0, unrelated: 0 });
      await status("OWNER_REVIEW_REQUIRED");
      import_strict.default.deepEqual(await runtimeFacts(), prior.runtimeBindings);
      import_strict.default.deepEqual(executionManifest, prior.executionManifest);
      import_strict.default.equal(sha(await nativeRead(__filename)), prior.driverSha256);
      for (const [file, expected] of [[hook(), prior.hook], [configFile(), prior.config], [(0, import_node_path.join)(root, SOURCE), prior.source], [(0, import_node_path.join)(root, ".git", "HEAD"), prior.head]]) import_strict.default.deepEqual(await fact(file), expected);
      const current = await saved();
      import_strict.default.equal(sha(current.raw), prior.recordSha256);
      import_strict.default.equal(current.descriptor.session, prior.session);
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
      privateClean();
    });
    add("Launcher actual prior editor close/EOF/absence is mandatory; direct wrapper blocks before explicit owner resume", async () => {
      (0, import_strict.default)(prior);
      const close = JSON.parse(await nativeRead(closeReceiptFile(), "utf8"));
      import_strict.default.equal(close.schemaVersion, 1);
      import_strict.default.equal(close.status, "ACTUAL_F26B_PRIMARY_EDITOR_CLOSED");
      import_strict.default.equal(close.syntheticOnly, true);
      import_strict.default.equal(close.primaryStateSha256, sha(await nativeRead(stateFile())));
      import_strict.default.equal(close.code.observedExit, true);
      import_strict.default.equal(close.code.exitCode, 0);
      import_strict.default.equal(close.code.stdoutEOF, true);
      import_strict.default.equal(close.code.stderrEOF, true);
      import_strict.default.equal(close.code.signalsRequested, 0);
      import_strict.default.equal(close.code.pidAbsentTwice, true);
      import_strict.default.equal(close.code.streamsStable, true);
      import_strict.default.equal(close.code.ownedWindowClose, "workbench.action.closeWindow");
      import_strict.default.equal(close.code.executable, process.execPath);
      await componentHook(transcript(prior.tips.public), 1, "none");
      await status("OWNER_REVIEW_REQUIRED");
    });
    add("Cancelled restart resume preserves signing/recovery/hook/descriptor and has no listener", async () => {
      (0, import_strict.default)(prior);
      const before = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("resumePrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(noEffects(), before);
      import_strict.default.equal((await saved()).descriptor.session, prior.session);
      import_strict.default.deepEqual(await fact(hook()), prior.hook);
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
    });
    add("Explicit reviewed restart resume signs fresh session and actual component public/secret routes work", async () => {
      (0, import_strict.default)(prior);
      import_strict.default.equal((await call("resumePrePushGuard")).status, "RESUMED");
      await status("LIVE");
      const current = await saved();
      import_strict.default.notEqual(current.descriptor.session, prior.session);
      import_strict.default.equal(current.pin.generation, prior.generation);
      import_strict.default.equal(sha(Buffer.from(current.value.pin, "base64")), prior.publicPinSha256);
      import_strict.default.equal(stores.signing, 0);
      import_strict.default.equal(stores.backupKey, 0);
      import_strict.default.deepEqual(await backupFacts(), prior.backupFacts);
      await componentHook(transcript(prior.tips.public), 0, "ALLOW");
      await componentHook(transcript(prior.tips.removed), 1, "BLOCK");
    });
    add("Cancelled restart restore leaves exact reviewed installation and live owner", async () => {
      (0, import_strict.default)(prior);
      const before = await fact(hook()), effects = noEffects();
      approve = false;
      try {
        import_strict.default.equal((await call("restorePrePushGuard")).status, "CANCELLED");
      } finally {
        approve = true;
      }
      import_strict.default.deepEqual(await fact(hook()), before);
      import_strict.default.deepEqual(noEffects(), effects);
      await status("LIVE");
    });
    add("Reviewed restart restore returns exact absence/policy and safely withdraws owner; all direct children closed", async () => {
      (0, import_strict.default)(prior);
      import_strict.default.equal((await call("restorePrePushGuard")).status, "RESTORED");
      (0, import_strict.default)(!(await fact(hook())).present);
      await idle();
      await status("OWNER_REVIEW_REQUIRED");
      await setFlag(prior.oldFlag);
      await ownerClosed();
      await Promise.all(pendingChildren);
      children.forEach(closed);
      privateClean();
      import_strict.default.deepEqual(await runtimeFacts(), runtimes);
      import_strict.default.deepEqual(await policyFacts(), prior.policy);
    });
  }
  import_strict.default.equal(checks.length, phase === "primary" ? 30 : 6);
  for (let index = 0; index < checks.length; index++) observations.push({ id: "F26B-H" + (phase === "primary" ? "P" : "R") + String(index + 1).padStart(2, "0"), scope: checks[index].scope, status: "NOT_RUN" });
  try {
    for (let index = 0; index < checks.length; index++) {
      caseId = observations[index].id;
      setupStage = caseId;
      try {
        (0, import_strict.default)(!halted);
        await checks[index].work();
        observations[index].status = "PASS";
      } catch (error) {
        observations[index].status = "FAIL";
        observations[index].errorName = error instanceof Error ? error.name : "UnknownFailure";
        driverFailure = halted ? "STOP_UNCONFIRMED" : "NativePrePushComponentFailure";
        break;
      }
    }
  } finally {
    const busy = children.some((row) => row.busy);
    if (!busy) {
      listeners.forEach((listener) => listener.dispose());
      for (const restore of restorers.reverse()) restore();
    }
    const summary = {
      schemaVersion: 1,
      phase,
      syntheticOnly: true,
      scope: "F26B_COMPONENT_NATIVE_ROUTE_NOT_CONFIGURED_PUSH",
      fixtureStatus: "PREPARED_NATIVE_FIXTURE_ACTUAL_RESULTS_ONLY",
      hostVersion: vscode.version,
      extensionBundleSha256: runtimes[0].sha256,
      workerSha256: runtimes[3].sha256,
      runtimeBindings: runtimes,
      currentRuntimeBindings: await runtimeFacts(),
      executionManifest,
      currentExecutionManifest: await fact((0, import_node_path.join)(context.extensionUri.fsPath, "package.json")),
      hostProbeSha256: sha(await nativeRead(__filename)),
      codeSha256,
      observations,
      expectedChecks: phase === "primary" ? 30 : 6,
      passed: observations.filter((row) => row.status === "PASS").length,
      failed: observations.filter((row) => row.status === "FAIL").length,
      notRun: observations.filter((row) => row.status === "NOT_RUN").length,
      children,
      requests: wires,
      reviews,
      secretStores: stores,
      ownerServers,
      ownerListeners,
      sourceDocuments,
      sourceDocumentEvents,
      directWorktreeReads,
      directObjectReads,
      metadataLeak,
      parentEnvironmentUnchanged: environmentDigest() === parentEnvironment,
      driverFailure,
      busyChildren: children.filter((row) => row.busy).length,
      timedOutChildren: children.filter((row) => row.timedOut).length,
      readyForInterphase: phase === "primary" && !!restartState && !driverFailure && !busy,
      safeWithdrawal: phase === "restart" && !driverFailure ? "REVIEWED_RESTORE_TO_ABSENCE_AND_FLAG_RESTORED" : "NOT_RUN",
      limits: { refs: 32, commits: 32, blobs: 128, blobBytes: 65536, admittedBytes: 1048576, operationMilliseconds: 6e4, fixtureChildMilliseconds: CHILD_LIMIT },
      signalsRequested: children.reduce((sum, row) => sum + row.signalsRequested, 0),
      independence: "LOW",
      review: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
      nestedClientClosure: "NOT_INFERRED_FROM_SH;SUPPLEMENTAL_DIRECT_PACKAGED_CLIENT_CLOSE_EOF_OBSERVATION",
      configuredGitPush: "NOT_AUTHORIZED_NOT_RUN_REQUIRED_FOR_FEATURE_DONE",
      notTested: ["Actual configured owner Git push or remote/local collector", "Same-user bypass/atomic OS confinement", "Human review/accessibility/usability", "Registered-value guarantee", "Other platforms/remote workspaces", "In-flight cancellation remains unit-only unless separately witnessed"]
    };
    safeMetadata(summary);
    await import_promises.default.writeFile(output, JSON.stringify(summary, null, 2) + "\n", { flag: "wx" });
    if (busy) throw Error("STOP_UNCONFIRMED: retain editor ownership, do not close/advance.");
  }
  if (driverFailure || observations.some((row) => row.status !== "PASS")) throw Error("Native pre-push component incomplete.");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
