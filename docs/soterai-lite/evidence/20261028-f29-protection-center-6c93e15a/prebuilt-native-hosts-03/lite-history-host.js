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

// packages/vscode-extension/src/__tests__/host/liteHistoryScanner.host.ts
var liteHistoryScanner_host_exports = {};
__export(liteHistoryScanner_host_exports, {
  beforeActivate: () => beforeActivate,
  run: () => run,
  setupDiagnostic: () => setupDiagnostic
});
module.exports = __toCommonJS(liteHistoryScanner_host_exports);
var vscode = __toESM(require("vscode"));
var import_strict = __toESM(require("node:assert/strict"));
var import_node_crypto = require("node:crypto");
var import_node_child_process = __toESM(require("node:child_process"));
var import_node_fs = __toESM(require("node:fs"));
var import_promises = __toESM(require("node:fs/promises"));
var import_node_path = require("node:path");
var GIT = "C:\\Program Files\\Git\\cmd\\git.exe";
var VERSION = "git version 2.53.0.windows.1";
var VALUE = "TEST_ONLY_F23_HOST_PRIVATE_f48d19c6";
var CALLER = "TEST_ONLY_F23_CALLER_NOT_AUTHORITY_42ba7e01";
var ORIGINAL = ".env.history-private";
var RENAMED = "renamed-history-private.snapshot";
var AUTHOR = "HISTORY_AUTHOR_CANARY_F23";
var MESSAGE = "HISTORY_COMMIT_CANARY_F23";
var SOURCE = "API_KEY=" + VALUE + "\nPORT=3000\n";
var KEY = "soterai.hygiene.hmacKey.v1";
var STATE = "soterai.lite.hygiene.exposure.v1";
var FLAG = "lite.historyScanner";
var nativeSpawn = import_node_child_process.default.spawn;
var nativeRead = import_promises.default.readFile;
var nativeReadSync = import_node_fs.default.readFileSync;
var restores = [];
var listeners = [];
var displayed = [];
var opened = [];
var metadata = [];
var reviews = [];
var children = [];
var historyClosures = [];
var started = performance.now();
var trace = [];
var root = "";
var setupJob = "";
var setupEnvironment = {};
var setupPrefix = [];
var stores = 0;
var vaultStores = 0;
var sourceCalls = 0;
var sourceEvents = 0;
var historyBodyReads = 0;
var approve = true;
var holdPrompt = false;
var promptEntered = false;
var heldAction;
var finishPrompt;
var holdDocument = false;
var documentEntered = false;
var finishDocument;
var lastReview;
var setupStage = "initial";
var sha = (bytes) => (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex");
var note = (event) => trace.push({ event, milliseconds: performance.now() - started });
var within = (base, file) => {
  const part = (0, import_node_path.relative)((0, import_node_path.resolve)(base), (0, import_node_path.resolve)(file));
  return part === "" || !part.startsWith("..") && !(0, import_node_path.isAbsolute)(part);
};
function noValues(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  for (const privateValue of [VALUE, CALLER, ORIGINAL, RENAMED, AUTHOR, MESSAGE]) (0, import_strict.default)(!text.includes(privateValue), "Private history entered metadata.");
  if (root) (0, import_strict.default)(!text.includes(root), "Original workspace path entered metadata.");
}
function patch(object, name, value) {
  const prior = Object.getOwnPropertyDescriptor(object, name);
  Object.defineProperty(object, name, { configurable: true, writable: true, value });
  restores.push(() => prior ? Object.defineProperty(object, name, prior) : Reflect.deleteProperty(object, name));
}
async function until(predicate) {
  const end = Date.now() + 5e3;
  while (!predicate() && Date.now() < end) await new Promise((done) => setTimeout(done, 10));
  (0, import_strict.default)(predicate(), "Expected synthetic native UI stage was not reached.");
}
function closedSuccess(receipt) {
  import_strict.default.equal(receipt.closed, true);
  import_strict.default.equal(receipt.code, 0);
  import_strict.default.equal(receipt.signal, null);
  import_strict.default.equal(receipt.stdoutEOF, true);
  import_strict.default.equal(receipt.stderrEOF, true);
  import_strict.default.equal(receipt.spawnFailed, false);
  import_strict.default.equal(receipt.streamError, false);
  import_strict.default.equal(receipt.overflow, false);
  import_strict.default.equal(receipt.signalsRequested, 0);
  import_strict.default.equal(receipt.invalidInput, false);
  if (receipt.phase === "history") import_strict.default.equal(receipt.stderrBytes, 0);
}
function observe(child, phase, operation) {
  const row = {
    phase,
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
    spawnFailed: false,
    streamError: false,
    overflow: false,
    signalsRequested: 0,
    stdinObjects: 0,
    invalidInput: false
  };
  children.push(row);
  return new Promise((done) => {
    const stdout = [], outHash = (0, import_node_crypto.createHash)("sha256"), errHash = (0, import_node_crypto.createHash)("sha256");
    let resolved = false;
    child.kill = (() => {
      row.signalsRequested++;
      throw Error("Synthetic history verification forbids signals.");
    });
    if (phase === "history" && child.stdin) {
      const end = child.stdin.end;
      child.stdin.end = function(...values) {
        const value = values[0], input = typeof value === "string" || Buffer.isBuffer(value) ? Buffer.from(value).toString("ascii") : "";
        if (operation !== "batch" || !/^(?:[a-f0-9]{40}\n){1,128}$/.test(input)) row.invalidInput = true;
        else row.stdinObjects = input.trimEnd().split("\n").length;
        return Reflect.apply(end, this, values);
      };
    }
    const finish = () => {
      if (resolved || !row.closed || !row.spawnFailed && (!row.stdoutEOF || !row.stderrEOF)) return;
      resolved = true;
      row.stdoutSha256 = outHash.digest("hex");
      row.stderrSha256 = errHash.digest("hex");
      done({ receipt: row, stdout: Buffer.concat(stdout) });
    };
    child.once("error", () => {
      row.spawnFailed = child.pid === void 0;
      row.streamError = !row.spawnFailed;
    });
    child.once("close", (code, signal) => {
      row.closed = true;
      row.code = code;
      row.signal = signal;
      finish();
    });
    for (const channel of ["stdout", "stderr"]) {
      const stream = child[channel];
      (0, import_strict.default)(stream);
      stream.on("data", (bytes) => {
        if (channel === "stdout") {
          row.stdoutBytes += bytes.length;
          outHash.update(bytes);
        } else {
          row.stderrBytes += bytes.length;
          errHash.update(bytes);
        }
        if (row.stdoutBytes + row.stderrBytes > (phase === "setup" ? 65536 : 1048576 + 128 * 96 + 8192)) row.overflow = true;
        if (phase === "setup" && channel === "stdout" && !row.overflow) stdout.push(Buffer.from(bytes));
      });
      stream.once("end", () => {
        if (channel === "stdout") row.stdoutEOF = true;
        else row.stderrEOF = true;
        finish();
      });
      stream.once("error", () => {
        row.streamError = true;
      });
    }
  });
}
async function git(operation, args) {
  (0, import_strict.default)(setupJob);
  const complete = await observe(nativeSpawn(GIT, [...setupPrefix, ...args], {
    cwd: root,
    env: setupEnvironment,
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  }), "setup", operation);
  closedSuccess(complete.receipt);
  return complete.stdout.toString("utf8");
}
async function repositoryBytes() {
  const entries = [];
  const walk = async (directory) => {
    for (const entry of await import_promises.default.readdir(directory, { withFileTypes: true })) {
      import_strict.default.equal(entry.isSymbolicLink(), false);
      const file = (0, import_node_path.join)(directory, entry.name);
      if (entry.isDirectory()) await walk(file);
      else {
        (0, import_strict.default)(entry.isFile());
        const bytes = await nativeRead(file);
        entries.push({ path: (0, import_node_path.relative)(root, file).replaceAll("\\", "/"), bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  };
  await walk(root);
  entries.sort((a, b) => a.path.localeCompare(b.path));
  return { files: entries.length, sha256: sha(JSON.stringify(entries)) };
}
async function prepareUnborn() {
  const temporary = process.env.TEMP;
  (0, import_strict.default)(temporary && within(process.env.USERPROFILE, temporary));
  await import_strict.default.rejects(import_promises.default.stat((0, import_node_path.join)(root, ".git")), { code: "ENOENT" });
  setupJob = await import_promises.default.mkdtemp((0, import_node_path.join)(temporary, "f23-host-git-setup-"));
  await import_promises.default.mkdir((0, import_node_path.join)(setupJob, "empty-hooks"));
  await import_promises.default.writeFile((0, import_node_path.join)(setupJob, "empty.gitconfig"), "", { flag: "wx" });
  setupEnvironment = {
    HOME: setupJob,
    USERPROFILE: setupJob,
    XDG_CONFIG_HOME: setupJob,
    TEMP: setupJob,
    TMP: setupJob,
    PATHEXT: ".EXE",
    GIT_CONFIG_SYSTEM: (0, import_node_path.join)(setupJob, "empty.gitconfig"),
    GIT_CONFIG_GLOBAL: (0, import_node_path.join)(setupJob, "empty.gitconfig"),
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_NO_REPLACE_OBJECTS: "1",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_PROTOCOL_FROM_USER: "0"
  };
  for (const key of ["SystemRoot", "WINDIR", "COMSPEC"]) {
    const value = process.env[key];
    if (value && (0, import_node_path.isAbsolute)(value) && !/[\x00-\x1f\x7f-\x9f]/.test(value) && !value.startsWith("\\\\")) setupEnvironment[key] = value;
  }
  setupPrefix = [
    "--no-pager",
    "--literal-pathspecs",
    "--no-lazy-fetch",
    "--no-replace-objects",
    "--no-optional-locks",
    "-c",
    "core.hooksPath=" + (0, import_node_path.join)(setupJob, "empty-hooks"),
    "-c",
    "core.fsmonitor=false",
    "-c",
    "credential.helper=",
    "-c",
    "protocol.allow=never",
    "-c",
    "core.autocrlf=false",
    "-c",
    "commit.gpgSign=false",
    "-c",
    "gc.auto=0",
    "-c",
    "maintenance.auto=false",
    "-c",
    "user.name=" + AUTHOR,
    "-c",
    "user.email=synthetic-f23-host@example.invalid"
  ];
  import_strict.default.equal((await git("version", ["--version"])).trim(), VERSION);
  await git("init", ["init", "--quiet", "--initial-branch=main", "--object-format=sha1", "--template=" + (0, import_node_path.join)(setupJob, "empty-hooks")]);
}
function historyOperation(args, settings) {
  const job = settings.env?.HOME;
  (0, import_strict.default)(job && (0, import_node_path.isAbsolute)(job));
  const prefix = [
    "--no-pager",
    "--literal-pathspecs",
    "-c",
    "core.hooksPath=" + (0, import_node_path.join)(job, "empty-hooks"),
    "-c",
    "core.fsmonitor=false",
    "-c",
    "credential.helper=",
    "-c",
    "commit.gpgSign=false",
    "--no-lazy-fetch",
    "--no-replace-objects",
    "--no-optional-locks",
    "-c",
    "protocol.allow=never",
    "-c",
    "core.pager=",
    "-c",
    "color.ui=false",
    "-c",
    "core.attributesFile=" + (0, import_node_path.join)(job, "empty.gitconfig"),
    "-c",
    "gc.auto=0",
    "-c",
    "maintenance.auto=false"
  ];
  import_strict.default.deepEqual(args.slice(0, prefix.length), prefix);
  const suffix = args.slice(prefix.length);
  if (suffix.length === 1 && suffix[0] === "--version") {
    import_strict.default.equal(settings.cwd, job);
    return "version";
  }
  import_strict.default.equal(settings.cwd, root);
  if (suffix[0] === "rev-list") {
    import_strict.default.deepEqual(suffix, ["rev-list", "--max-count=33", "--all", "--"]);
    return "commits";
  }
  if (suffix[0] === "ls-tree") {
    import_strict.default.equal(suffix.length, 7);
    import_strict.default.match(suffix[5], /^[a-f0-9]{40}$/);
    import_strict.default.deepEqual(suffix, ["ls-tree", "-r", "-z", "--full-tree", "--long", suffix[5], "--"]);
    return "tree";
  }
  import_strict.default.deepEqual(suffix, ["cat-file", "--batch"]);
  return "batch";
}
function setupDiagnostic() {
  return {
    syntheticOnly: true,
    stage: setupStage,
    sourceCalls,
    sourceEvents,
    historyBodyReads,
    stores,
    vaultStores,
    historyChildren: children.filter((child) => child.phase === "history").length,
    setupChildren: children.filter((child) => child.phase === "setup").length
  };
}
async function beforeActivate(context) {
  import_strict.default.equal(vscode.workspace.workspaceFolders?.length, 1);
  root = vscode.workspace.workspaceFolders[0].uri.fsPath;
  import_strict.default.match((0, import_node_path.resolve)(process.env.USERPROFILE ?? ""), /^D:\\SoterAI-Lite-test-profiles\\/i);
  import_strict.default.match((0, import_node_path.resolve)(root), /^D:\\SoterAI-Lite-test-profiles\\/i);
  (0, import_strict.default)(!within(root, context.globalStorageUri.fsPath));
  import_strict.default.equal(process.platform, "win32");
  const phase = process.env.SOTERAI_LITE_F17_PHASE;
  (0, import_strict.default)(phase === "primary" || phase === "restart");
  setupStage = "synthetic-repository-preparation";
  if (phase === "primary") await prepareUnborn();
  const historyPath = (value) => typeof value === "string" && within((0, import_node_path.join)(root, ".git", "objects"), value);
  patch(import_node_fs.default, "readFileSync", (...args) => {
    if (historyPath(args[0])) historyBodyReads++;
    return Reflect.apply(nativeReadSync, import_node_fs.default, args);
  });
  patch(import_promises.default, "readFile", (...args) => {
    if (historyPath(args[0])) historyBodyReads++;
    return Reflect.apply(nativeRead, import_promises.default, args);
  });
  patch(import_node_child_process.default, "spawn", (...values) => {
    const executable = values[0], args = values[1], settings = values[2];
    import_strict.default.equal(executable, GIT);
    (0, import_strict.default)(Array.isArray(args));
    import_strict.default.equal(settings.shell, false);
    import_strict.default.equal(settings.windowsHide, true);
    import_strict.default.equal(settings.timeout, void 0);
    import_strict.default.equal(settings.signal, void 0);
    import_strict.default.equal(settings.killSignal, void 0);
    for (const key of ["PATH", "OPENAI_API_KEY", "GIT_CONFIG_COUNT", "GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0", "GIT_OBJECT_DIRECTORY", "GIT_ALTERNATE_OBJECT_DIRECTORIES", "NODE_OPTIONS"])
      import_strict.default.equal(settings.env?.[key], void 0);
    import_strict.default.equal(settings.env?.GIT_NO_LAZY_FETCH, "1");
    import_strict.default.equal(settings.env?.GIT_NO_REPLACE_OBJECTS, "1");
    const operation = historyOperation(args, settings);
    const child = Reflect.apply(nativeSpawn, import_node_child_process.default, values);
    historyClosures.push(observe(child, "history", operation));
    return child;
  });
  const store = context.secrets.store;
  patch(context.secrets, "store", async (key, value) => {
    if (key === KEY) {
      stores++;
      import_strict.default.equal(Buffer.from(value, "base64").length, 32);
    }
    if (key === "soterai.vaultKey") vaultStores++;
    return store.call(context.secrets, key, value);
  });
  listeners.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("soterai")) note("soterai-configuration-event");
    }),
    context.secrets.onDidChange((event) => {
      if (event.key === KEY) note("history-key-event");
    })
  );
  const originalFile = (value) => value instanceof vscode.Uri && value.scheme === "file" && ([ORIGINAL, RENAMED, "public.txt"].some((name) => value.toString() === vscode.Uri.file((0, import_node_path.join)(root, name)).toString()) || within((0, import_node_path.join)(root, ".git"), value.fsPath));
  const open = vscode.workspace.openTextDocument;
  patch(vscode.workspace, "openTextDocument", async (...args) => {
    if (originalFile(args[0])) sourceCalls++;
    const input = args[0];
    if (typeof input?.content === "string") {
      noValues(input.content);
      metadata.push(input.content);
    }
    const document = await Reflect.apply(open, vscode.workspace, args);
    if (typeof input?.content === "string") opened.push(document);
    if (holdDocument && typeof input?.content === "string") {
      documentEntered = true;
      await new Promise((done) => finishDocument = done);
    }
    return document;
  });
  listeners.push(vscode.workspace.onDidOpenTextDocument((document) => {
    if (originalFile(document.uri)) sourceEvents++;
  }));
  const show = vscode.window.showTextDocument;
  patch(vscode.window, "showTextDocument", async (...args) => {
    const document = args[0];
    noValues(document.getText());
    displayed.push(document);
    return Reflect.apply(show, vscode.window, args);
  });
  patch(vscode.window, "showWarningMessage", async (message, options, ...items) => {
    noValues([message, options, items]);
    const history = /history/i.test(message), action = history ? items.length === 1 ? items[0] : void 0 : items.find((item) => item === "Create metadata export");
    if (!action) return void 0;
    import_strict.default.equal(options.modal, true);
    reviews.push({ action, safe: true });
    if (history && holdPrompt) {
      promptEntered = true;
      heldAction = action;
      return new Promise((done) => finishPrompt = done);
    }
    return approve ? action : void 0;
  });
  for (const name of ["showInformationMessage", "showErrorMessage"]) patch(vscode.window, name, async (message) => {
    noValues(message);
    return void 0;
  });
  setupStage = "instrumented-before-production-activation";
}
async function run(context) {
  const phase = process.env.SOTERAI_LITE_F17_PHASE, output = process.env.SOTERAI_LITE_F17_EVIDENCE;
  const config = vscode.workspace.getConfiguration("soterai"), oldGlobal = config.inspect(FLAG)?.globalValue;
  const runtime = sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js")));
  import_strict.default.equal(runtime, process.env.SOTERAI_LITE_F17_BUNDLE_SHA256);
  const receipt = (0, import_node_path.join)((0, import_node_path.dirname)(root), "history-restart.json"), observations = [];
  const check = async (scope, work) => {
    const row = { id: "F23-N" + String(observations.length + 1).padStart(2, "0"), scope, status: "NOT_RUN", errorName: void 0 };
    observations.push(row);
    try {
      await work();
      row.status = "PASS";
    } catch (error) {
      row.status = "FAIL";
      row.errorName = error instanceof Error ? error.name : "UnknownFailure";
    }
  };
  const call = async (name, ...args) => {
    note("command-start-" + name);
    const value = await vscode.commands.executeCommand("soterai." + name, ...args);
    noValues(value);
    trace.push({
      event: "command-end-" + name,
      milliseconds: performance.now() - started,
      status: typeof value?.status === "string" && /^[A-Z_]{1,80}$/.test(value.status) ? value.status : "METADATA",
      files: Number.isSafeInteger(value?.files) ? value.files : void 0,
      findings: Array.isArray(value?.findings) ? value.findings.length : void 0
    });
    return value;
  };
  const count = () => children.filter((child) => child.phase === "history").length;
  const closed = async () => {
    for (const completion of await Promise.all(historyClosures)) closedSuccess(completion.receipt);
  };
  const clean = () => {
    import_strict.default.equal(sourceCalls, 0);
    import_strict.default.equal(sourceEvents, 0);
    import_strict.default.equal(historyBodyReads, 0);
    import_strict.default.equal(vaultStores, 0);
    (0, import_strict.default)(!vscode.workspace.textDocuments.some((document) => document.uri.scheme === "file" && ([ORIGINAL, RENAMED, "public.txt"].some((name) => document.uri.toString() === vscode.Uri.file((0, import_node_path.join)(root, name)).toString()) || within((0, import_node_path.join)(root, ".git"), document.uri.fsPath))));
    noValues(context.globalState.get(STATE));
    noValues(metadata);
    children.forEach((child) => import_strict.default.equal(child.signalsRequested, 0));
  };
  const scan = async (...args) => {
    const before = await repositoryBytes(), value = await call("reviewGitHistory", ...args);
    await closed();
    import_strict.default.deepEqual(await repositoryBytes(), before, "Read-only history command changed repository bytes.");
    clean();
    return value;
  };
  let driverFailure;
  try {
    if (phase === "primary") {
      await check("Exact runtime, two native commands and no startup history body, child, document or analyzer key", async () => {
        import_strict.default.equal(await context.secrets.get(KEY), void 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(count(), 0);
        import_strict.default.equal(metadata.length, 0);
        const status = await call("historyScannerStatus", { approved: true, root: CALLER, ref: CALLER });
        import_strict.default.equal(status.status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.equal(status.busy, false);
        import_strict.default.equal(typeof status.scope, "string");
        const commands2 = await vscode.commands.getCommands(true);
        for (const name of ["reviewGitHistory", "historyScannerStatus"]) (0, import_strict.default)(commands2.includes("soterai." + name));
        clean();
      });
      await check("Native history cancellation rejects caller approval, root and ref before key or children", async () => {
        approve = false;
        const before = reviews.length, value = await scan({ approved: true, root: CALLER, ref: CALLER, text: CALLER }, true);
        approve = true;
        import_strict.default.equal(value.status, "CANCELLED");
        import_strict.default.equal(reviews.length, before + 1);
        import_strict.default.equal(count(), 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
      });
      await check("One pending real owner modal exposes busy status and refuses a second review without a child", async () => {
        holdPrompt = true;
        promptEntered = false;
        const pending = call("reviewGitHistory");
        await until(() => promptEntered);
        import_strict.default.equal((await call("historyScannerStatus")).busy, true);
        import_strict.default.equal((await call("reviewGitHistory", { approved: true })).status, "UNAVAILABLE");
        import_strict.default.equal(count(), 0);
        import_strict.default.equal(stores, 0);
        finishPrompt?.(void 0);
        import_strict.default.equal((await pending).status, "CANCELLED");
        holdPrompt = false;
        import_strict.default.equal((await call("historyScannerStatus")).busy, false);
        clean();
      });
      await check("Actual pinned Git unborn control is a bounded zero-commit analysis with closed native children", async () => {
        const value = await scan();
        import_strict.default.equal(value.status, "ANALYZED");
        import_strict.default.equal(value.commits, 0);
        import_strict.default.equal(value.files, 0);
        import_strict.default.deepEqual(value.findings, []);
        import_strict.default.deepEqual(children.filter((child) => child.phase === "history").map((child) => child.operation), ["version", "commits"]);
      });
      await check("Actual one-commit public control reports no findings and preserves every repository byte", async () => {
        await import_promises.default.writeFile((0, import_node_path.join)(root, "public.txt"), "PORT=3000\nMODE=public\n", { flag: "wx" });
        await git("public-add", ["add", "--", "public.txt"]);
        await git("public-commit", ["commit", "--quiet", "-m", MESSAGE]);
        const value = await scan();
        import_strict.default.equal(value.status, "ANALYZED");
        import_strict.default.equal(value.commits, 1);
        import_strict.default.equal(value.files, 1);
        import_strict.default.deepEqual(value.findings, []);
      });
      await check("Synthetic secret is committed, renamed and deleted while the public tip remains clean", async () => {
        await import_promises.default.writeFile((0, import_node_path.join)(root, ORIGINAL), SOURCE, { flag: "wx" });
        await git("secret-add", ["add", "--", ORIGINAL]);
        await git("secret-commit", ["commit", "--quiet", "-m", MESSAGE]);
        await git("secret-rename", ["mv", "--", ORIGINAL, RENAMED]);
        await git("rename-commit", ["commit", "--quiet", "-m", MESSAGE]);
        await git("secret-remove", ["rm", "--quiet", "--", RENAMED]);
        await git("deletion-commit", ["commit", "--quiet", "-m", MESSAGE]);
        await import_strict.default.rejects(nativeRead((0, import_node_path.join)(root, ORIGINAL)), { code: "ENOENT" });
        await import_strict.default.rejects(nativeRead((0, import_node_path.join)(root, RENAMED)), { code: "ENOENT" });
        import_strict.default.equal(await nativeRead((0, import_node_path.join)(root, "public.txt"), "utf8"), "PORT=3000\nMODE=public\n");
        clean();
      });
      await check("Actual reachable history detects deleted and renamed credentials once through blob deduplication", async () => {
        lastReview = await scan();
        import_strict.default.equal(lastReview.status, "ANALYZED");
        import_strict.default.equal(lastReview.commits, 4);
        import_strict.default.equal(lastReview.files, 2);
        import_strict.default.equal(lastReview.findings.length, 1);
        import_strict.default.equal(Buffer.from(await context.secrets.get(KEY), "base64").length, 32);
        import_strict.default.equal(await context.secrets.get("soterai.vaultKey"), void 0);
      });
      await check("Current native report is JSON metadata without originals, author, commit message, paths or values", async () => {
        (0, import_strict.default)(metadata.length >= 3);
        const document = JSON.parse(metadata.at(-1));
        import_strict.default.deepEqual(document, lastReview);
        for (const finding of document.findings) for (const field of ["id", "fileRef", "valueRef"]) import_strict.default.match(finding[field], /^[a-f0-9]{64}$/);
        (0, import_strict.default)(displayed.length >= 3);
        clean();
      });
      await check("Canonical possible-exposure ledger records exactly one keyed historical finding", async () => {
        const value = await call("openHygieneExposureLedger");
        import_strict.default.equal(value.rows.length, 1);
        for (const row of value.rows) {
          import_strict.default.equal(row.lastAction, "possible-project-exposure");
          for (const field of ["id", "rootRef", "fileRef", "valueRef"]) import_strict.default.match(row[field], /^[a-f0-9]{64}$/);
        }
        clean();
      });
      await check("A fresh actual history review keeps stable keyed identity while incrementing canonical observations", async () => {
        const before = await call("openHygieneExposureLedger"), fresh = await scan();
        import_strict.default.equal(fresh.findings.length, 1);
        import_strict.default.equal(fresh.findings[0].id, lastReview.findings[0].id);
        const after = await call("openHygieneExposureLedger");
        import_strict.default.equal(after.rows.length, 1);
        (0, import_strict.default)(after.rows[0].observations > before.rows[0].observations);
        lastReview = fresh;
      });
      await check("Public path, revision, text and approval arguments cannot redirect actual repository review", async () => {
        const value = await scan(vscode.Uri.file("C:\\foreign-f23-history"), { root: CALLER, ref: CALLER, approved: true, content: CALLER });
        import_strict.default.equal(value.status, "ANALYZED");
        import_strict.default.equal(value.commits, 4);
        import_strict.default.equal(value.findings[0].id, lastReview.findings[0].id);
      });
      await check("Historical findings grant no canonical current-file vault mutation authority", async () => {
        const before = await repositoryBytes();
        import_strict.default.equal((await call("reviewHygieneVault", lastReview.findings[0], { approved: true })).status, "REVIEW_FILES_FIRST");
        import_strict.default.deepEqual(await repositoryBytes(), before);
        import_strict.default.equal(await context.secrets.get("soterai.vaultKey"), void 0);
        clean();
      });
      await check("Metadata export cancellation leaves no export file", async () => {
        approve = false;
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "CANCELLED");
        approve = true;
        import_strict.default.equal((await import_promises.default.readdir((0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports")).catch(() => [])).length, 0);
        clean();
      });
      await check("Reviewed actual export contains one keyed row and no original history or credentials", async () => {
        import_strict.default.equal((await call("exportHygieneExposureLedger")).status, "EXPORTED");
        const directory = (0, import_node_path.join)(context.globalStorageUri.fsPath, "hygiene-exports"), files = await import_promises.default.readdir(directory);
        import_strict.default.equal(files.length, 1);
        const exported = await nativeRead((0, import_node_path.join)(directory, files[0]), "utf8");
        noValues(exported);
        import_strict.default.equal(JSON.parse(exported).rows.length, 1);
        clean();
      });
      await check("Native historical guidance offers only manual rotation and owner-coordinated removal", async () => {
        import_strict.default.match(lastReview.guidance, /rotat/i);
        import_strict.default.match(lastReview.guidance, /owner/i);
        import_strict.default.match(lastReview.guidance, /never rewrites history/i);
        import_strict.default.match(lastReview.scope, /unreachable/i);
        import_strict.default.match(lastReview.scope, /credential-validity/i);
        import_strict.default.deepEqual(lastReview.findings[0].suggestions, ["rotation-checklist"]);
        clean();
      });
      await check("Native finite grammar, isolated environment and actual close plus both EOFs hold for every history child", async () => {
        await closed();
        const product = children.filter((child) => child.phase === "history");
        (0, import_strict.default)(product.some((child) => child.operation === "batch"));
        (0, import_strict.default)(product.filter((child) => child.operation === "batch").every((child) => child.stdinObjects >= 1 && child.stdinObjects <= 128));
        product.forEach(closedSuccess);
        clean();
      });
      await check("Disable then reenable during an owner modal irreversibly withdraws that pending history approval", async () => {
        holdPrompt = true;
        promptEntered = false;
        const beforeChildren = count(), beforeMetadata = metadata.length;
        const pending = call("reviewGitHistory");
        await until(() => promptEntered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        finishPrompt?.(heldAction);
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        holdPrompt = false;
        import_strict.default.equal(count(), beforeChildren);
        import_strict.default.equal(metadata.length, beforeMetadata);
        clean();
      });
      await check("Owner disable prevents history children, analyzer-key writes, ledger changes and documents", async () => {
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        const before = JSON.stringify(context.globalState.get(STATE));
        const beforeChildren = count(), beforeStores = stores, beforeMetadata = metadata.length;
        import_strict.default.equal((await call("reviewGitHistory", { approved: true, enabled: true })).status, "UNAVAILABLE");
        import_strict.default.equal((await call("historyScannerStatus")).status, "UNAVAILABLE");
        import_strict.default.equal(JSON.stringify(context.globalState.get(STATE)), before);
        import_strict.default.equal(count(), beforeChildren);
        import_strict.default.equal(stores, beforeStores);
        import_strict.default.equal(metadata.length, beforeMetadata);
        clean();
      });
      await check("Native machine scope rejects a repository override while owner disable remains effective", async () => {
        await import_strict.default.rejects(async () => config.update(FLAG, true, vscode.ConfigurationTarget.Workspace), { name: "CodeExpectedError" });
        import_strict.default.equal((await call("historyScannerStatus")).status, "UNAVAILABLE");
        import_strict.default.equal((await call("reviewGitHistory", { approved: true })).status, "UNAVAILABLE");
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        clean();
      });
      await check("Disable then reenable after native metadata document creation suppresses stale display", async () => {
        holdDocument = true;
        documentEntered = false;
        const beforeDisplay = displayed.length;
        const pending = call("reviewGitHistory");
        await until(() => documentEntered);
        await config.update(FLAG, false, vscode.ConfigurationTarget.Global);
        await config.update(FLAG, true, vscode.ConfigurationTarget.Global);
        finishDocument?.();
        import_strict.default.equal((await pending).status, "UNAVAILABLE");
        holdDocument = false;
        import_strict.default.equal(displayed.length, beforeDisplay);
        await closed();
        clean();
      });
      await check("Reenabled status preserves exact keyed restart metadata without history or vault mutation", async () => {
        import_strict.default.equal((await call("historyScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        await closed();
        clean();
        (0, import_strict.default)(stores >= 1);
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.equal(ledger.rows.length, 1);
        await import_promises.default.writeFile(receipt, JSON.stringify({ ledger: context.globalState.get(STATE), repository: await repositoryBytes(), findingId: lastReview.findings[0].id, ledgerRowId: ledger.rows[0].id }) + "\n", { flag: "wx" });
      });
    } else {
      const prior = JSON.parse(await nativeRead(receipt, "utf8"));
      await check("Restart preserves keyed metadata and existing key without startup history, child, document or key writes", async () => {
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(count(), 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.equal((await call("historyScannerStatus")).status, "OWNER_REVIEW_REQUIRED");
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        import_strict.default.deepEqual(await repositoryBytes(), prior.repository);
        clean();
      });
      await check("Restart cancellation still requires native owner consent before fresh history authority", async () => {
        approve = false;
        import_strict.default.equal((await call("reviewGitHistory", { approved: true, findingId: prior.findingId })).status, "CANCELLED");
        approve = true;
        import_strict.default.equal(count(), 0);
        import_strict.default.equal(stores, 0);
        import_strict.default.equal(metadata.length, 0);
        import_strict.default.deepEqual(context.globalState.get(STATE), prior.ledger);
        clean();
      });
      await check("Restart carries no stale current-file vault authority from historical findings", async () => {
        import_strict.default.equal((await call("reviewHygieneVault", prior.findingId, { approved: true })).status, "REVIEW_FILES_FIRST");
        const ledger = await call("openHygieneExposureLedger");
        import_strict.default.equal(ledger.rows.length, 1);
        import_strict.default.equal(ledger.rows[0].id, prior.ledgerRowId);
        import_strict.default.equal(stores, 0);
        import_strict.default.deepEqual(await repositoryBytes(), prior.repository);
        clean();
      });
      await check("Fresh actual native restart review reestablishes one keyed historical finding without rewriting history or replacing its key", async () => {
        const value = await scan();
        import_strict.default.equal(value.status, "ANALYZED");
        import_strict.default.equal(value.commits, 4);
        import_strict.default.equal(value.files, 2);
        import_strict.default.equal(value.findings.length, 1);
        import_strict.default.equal(value.findings[0].id, prior.findingId);
        import_strict.default.equal(stores, 0);
        clean();
      });
    }
  } catch {
    driverFailure = "NativeHistoryDriverFailure";
  } finally {
    try {
      finishPrompt?.(void 0);
      finishDocument?.();
      holdPrompt = false;
      holdDocument = false;
      await config.update(FLAG, oldGlobal, vscode.ConfigurationTarget.Global);
      await closed();
      clean();
      for (const document of /* @__PURE__ */ new Set([...opened, ...displayed])) if (!document.isClosed && document.isUntitled) {
        await vscode.window.showTextDocument(document);
        await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");
      }
    } catch {
      driverFailure = "NativeHistoryWithdrawalUnconfirmed";
    }
    listeners.forEach((listener) => listener.dispose());
    for (const restore of restores.reverse()) restore();
  }
  const result = {
    schemaVersion: 1,
    phase,
    syntheticOnly: true,
    hostVersion: vscode.version,
    extensionBundleSha256: runtime,
    currentDeveloperBundleSha256: sha(await nativeRead((0, import_node_path.join)(context.extensionUri.fsPath, "dist/extension.js"))),
    hostProbeSha256: sha(await nativeRead(__filename)),
    observations,
    passed: observations.filter((row) => row.status === "PASS").length,
    failed: observations.filter((row) => row.status === "FAIL").length,
    notRun: observations.filter((row) => row.status === "NOT_RUN").length,
    sourceDocumentCalls: sourceCalls,
    sourceDocumentEvents: sourceEvents,
    directHistoryBodyReads: historyBodyReads,
    secretStorageStores: stores,
    vaultKeyStores: vaultStores,
    reviews,
    metadataDocuments: metadata.length,
    children,
    processSignalsRequested: children.reduce((sum, child) => sum + child.signalsRequested, 0),
    trace,
    driverFailure,
    independence: "LOW",
    ownerPresence: "SCRIPTED_NATIVE_API_DECISIONS_NOT_HUMAN_REVIEW",
    notTested: [
      "Human usability/accessibility",
      "Credential validity, provider rotation, actual AI access or remote copies",
      "History removal/rewrite and unreachable/reflog/message scanning",
      "Same-user unmanaged reads or independent uploads"
    ]
  };
  noValues(result);
  await import_promises.default.writeFile(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  if (result.failed || driverFailure) throw Error("Native history scanner incomplete");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  beforeActivate,
  run,
  setupDiagnostic
});
