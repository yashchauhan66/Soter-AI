"use strict";
(self["webpackChunk_soterai_jupyterlab_guard"] = self["webpackChunk_soterai_jupyterlab_guard"] || []).push([["lib_index_js"],{

/***/ "./lib/broker.js"
/*!***********************!*\
  !*** ./lib/broker.js ***!
  \***********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   BrokerClient: () => (/* binding */ BrokerClient),
/* harmony export */   BrokerError: () => (/* binding */ BrokerError),
/* harmony export */   LocalLoopbackTransport: () => (/* binding */ LocalLoopbackTransport),
/* harmony export */   ServerProxyTransport: () => (/* binding */ ServerProxyTransport)
/* harmony export */ });
/**
 * Fetch-based client for the SoterAI Local AI Broker.
 *
 * PLANNED / UNBUILT. Thin transport only: it maps 1:1 onto the broker HTTP
 * contract and performs NO detection, scoring, or redaction of its own. All of
 * that lives in the broker. The bearer token is never logged.
 *
 * Token/topology caveat (see docs/jupyterlab-extension-plan.md): a browser is
 * not a safe place to hold a long-lived broker token, and a remote Jupyter
 * server cannot reach a developer's `127.0.0.1` broker. The recommended real
 * build routes broker calls through a same-host Jupyter *server extension* that
 * reads `~/.soterai/broker/auth-token` and proxies to the loopback broker, so
 * the token never enters the browser. This client is written against that
 * proxy-or-local abstraction: you inject how the base URL and Authorization
 * header are resolved.
 */
class BrokerError extends Error {
    constructor(message) {
        super(message);
        this.name = 'BrokerError';
    }
}
const REQUEST_TIMEOUT_MS = 10000;
class BrokerClient {
    transport;
    constructor(transport) {
        this.transport = transport;
    }
    /** GET /health — the only unauthenticated endpoint. */
    async health() {
        try {
            const response = await this.raw('GET', '/health', undefined, false);
            return { healthy: response.ok };
        }
        catch {
            return { healthy: false };
        }
    }
    /** GET /v1/safe-mode/status */
    async safeModeStatus() {
        return this.json('GET', '/v1/safe-mode/status');
    }
    /** POST /v1/scan { content } */
    async scan(content) {
        return this.json('POST', '/v1/scan', { content });
    }
    /**
     * POST /v1/scan { messages } — for prompt-shaped payloads (safe prompt check).
     */
    async scanMessages(messages) {
        return this.json('POST', '/v1/scan', { messages });
    }
    /** POST /v1/redact { content } -> { redacted } */
    async redact(content) {
        return this.json('POST', '/v1/redact', { content });
    }
    async json(method, path, body) {
        const response = await this.raw(method, path, body, true);
        const text = await response.text();
        const parsed = text ? JSON.parse(text) : {};
        if (!response.ok) {
            const message = parsed.error?.message ??
                `Local broker request failed (${response.status})`;
            throw new BrokerError(message);
        }
        return parsed;
    }
    async raw(method, path, body, authenticated) {
        const headers = { Accept: 'application/json' };
        if (authenticated) {
            const auth = await this.transport.authorization();
            if (auth) {
                headers['Authorization'] = auth;
            }
            // When `auth` is null, a same-host server-extension proxy is expected to
            // attach the real broker token; the browser never sees it.
        }
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
            return await fetch(`${this.transport.baseUrl()}${path}`, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal
            });
        }
        catch (err) {
            throw new BrokerError(`Cannot reach the Local AI Broker at ${this.transport.baseUrl()} ` +
                `(is it running on this host?)`);
        }
        finally {
            clearTimeout(timer);
        }
    }
}
/**
 * Local-only transport. Suitable when JupyterLab runs on the same machine as
 * the broker (classic desktop `jupyter lab`). NOT suitable for remote/hosted
 * Jupyter — use the server-extension proxy transport there instead.
 *
 * The token getter is injected; in the scaffold it reads a settings value the
 * user pastes in, which the plan flags as the weaker option versus the proxy.
 */
class LocalLoopbackTransport {
    port;
    tokenGetter;
    constructor(port, tokenGetter) {
        this.port = port;
        this.tokenGetter = tokenGetter;
    }
    baseUrl() {
        return `http://127.0.0.1:${this.port()}`;
    }
    async authorization() {
        const token = await this.tokenGetter();
        return token ? `Bearer ${token}` : null;
    }
}
/**
 * Server-proxy transport (recommended). Points at a same-host Jupyter server
 * extension route which attaches the real broker token server-side. The browser
 * holds no long-lived secret.
 */
class ServerProxyTransport {
    baseRoute;
    constructor(baseRoute = '/soterai/broker') {
        this.baseRoute = baseRoute;
    }
    baseUrl() {
        return this.baseRoute;
    }
    async authorization() {
        return null; // server extension injects the broker token
    }
}


/***/ },

/***/ "./lib/index.js"
/*!**********************!*\
  !*** ./lib/index.js ***!
  \**********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @jupyterlab/apputils */ "webpack/sharing/consume/default/@jupyterlab/apputils");
/* harmony import */ var _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @jupyterlab/notebook */ "webpack/sharing/consume/default/@jupyterlab/notebook");
/* harmony import */ var _jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @jupyterlab/cells */ "webpack/sharing/consume/default/@jupyterlab/cells");
/* harmony import */ var _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_cells__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @jupyterlab/settingregistry */ "webpack/sharing/consume/default/@jupyterlab/settingregistry");
/* harmony import */ var _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(_jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _broker__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./broker */ "./lib/broker.js");
/* harmony import */ var _report__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./report */ "./lib/report.js");






/**
 * SoterAI IDE Guard for JupyterLab.
 *
 * PLANNED / UNBUILT scaffold. Thin adapter only: it routes explicitly selected
 * cells / notebooks / prompts to the authenticated loopback Local AI Broker and
 * shows redacted results. It reimplements no detector. See the docs in
 * `docs/` for the honest status and the manual build/install/canary procedure.
 *
 * NOTE: exact @jupyterlab 4.x API signatures (shared cell model getters,
 * output-area events) must be verified against the installed version when this
 * is actually built. They are used here per the 4.2 docs but are UNVERIFIED.
 */
const PLUGIN_ID = '@soterai/jupyterlab-guard:plugin';
var CommandIDs;
(function (CommandIDs) {
    CommandIDs.scanCell = 'soterai:scan-cell';
    CommandIDs.scanSelectedCells = 'soterai:scan-selected-cells';
    CommandIDs.redactCell = 'soterai:redact-cell';
    CommandIDs.scanNotebookForSecrets = 'soterai:scan-notebook-secrets';
    CommandIDs.safePrompt = 'soterai:safe-prompt';
    CommandIDs.toggleOutputMonitor = 'soterai:toggle-output-monitor';
    CommandIDs.openReport = 'soterai:open-report';
})(CommandIDs || (CommandIDs = {}));
const CATEGORY = 'SoterAI IDE Guard';
const plugin = {
    id: PLUGIN_ID,
    autoStart: true,
    requires: [_jupyterlab_notebook__WEBPACK_IMPORTED_MODULE_1__.INotebookTracker],
    optional: [_jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.ICommandPalette, _jupyterlab_settingregistry__WEBPACK_IMPORTED_MODULE_3__.ISettingRegistry],
    activate: (app, notebooks, palette, settings) => {
        const { commands, shell } = app;
        // Transport selection. Default to the same-host server-extension proxy so
        // the broker token never enters the browser; fall back to loopback only
        // when the user opts in (desktop, same machine).
        let useServerProxy = true;
        let brokerPort = 47321;
        const pastedToken = null;
        let outputMonitorEnabled = false;
        if (settings) {
            void settings
                .load(PLUGIN_ID)
                .then(s => {
                const read = () => {
                    useServerProxy = s.get('useServerProxy').composite;
                    brokerPort = s.get('brokerPort').composite || 47321;
                    outputMonitorEnabled = s.get('outputMonitor').composite;
                };
                read();
                s.changed.connect(read);
            })
                .catch(() => {
                /* settings schema absent in dev; defaults apply */
            });
        }
        const transport = new (class {
            local = new _broker__WEBPACK_IMPORTED_MODULE_4__.LocalLoopbackTransport(() => brokerPort, async () => pastedToken);
            proxy = new _broker__WEBPACK_IMPORTED_MODULE_4__.ServerProxyTransport();
            baseUrl() {
                return (useServerProxy ? this.proxy : this.local).baseUrl();
            }
            authorization() {
                return (useServerProxy ? this.proxy : this.local).authorization();
            }
        })();
        const broker = new _broker__WEBPACK_IMPORTED_MODULE_4__.BrokerClient(transport);
        // --- Report panel -------------------------------------------------------
        let report = null;
        const ensureReport = () => {
            if (!report || report.isDisposed) {
                report = new _report__WEBPACK_IMPORTED_MODULE_5__.ReportPanel();
                const widget = new _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.MainAreaWidget({ content: report });
                widget.id = 'soterai-guard-report-main';
                widget.title.label = 'SoterAI Guard';
                widget.title.closable = true;
                shell.add(widget, 'right', { rank: 900 });
                report.disposed.connect(() => {
                    report = null;
                });
            }
            shell.activateById('soterai-guard-report-main');
            return report;
        };
        // --- Helpers ------------------------------------------------------------
        const activeCell = () => notebooks.currentWidget?.content.activeCell ?? null;
        /** Cell source text via the shared model (JLab 4). */
        const cellSource = (cell) => cell.model.sharedModel.getSource();
        const runScan = async (title, content) => {
            if (!content.trim()) {
                ensureReport().reportNotice(title, 'Nothing to scan (empty content).');
                return;
            }
            try {
                const result = await broker.scan(content);
                ensureReport().reportScan(title, result);
                announce(result);
            }
            catch (err) {
                handleError(title, err);
            }
        };
        const announce = (result) => {
            if (result.decision === 'block') {
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.error(`SoterAI blocked content (risk ${result.riskScore}).`, {
                    autoClose: 6000
                });
            }
            else if (result.decision !== 'allow') {
                _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.warning(`SoterAI: ${result.decision} (risk ${result.riskScore}).`, { autoClose: 5000 });
            }
        };
        const handleError = (title, err) => {
            const message = err instanceof _broker__WEBPACK_IMPORTED_MODULE_4__.BrokerError
                ? err.message
                : 'SoterAI broker request failed.';
            ensureReport().reportNotice(`${title} — error`, message);
            _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.Notification.error(message, { autoClose: 6000 });
        };
        // --- Commands -----------------------------------------------------------
        commands.addCommand(CommandIDs.scanCell, {
            label: 'Scan Active Cell with SoterAI',
            isEnabled: () => activeCell() !== null,
            execute: async () => {
                const cell = activeCell();
                if (!cell) {
                    return;
                }
                await runScan('Scan active cell', cellSource(cell));
            }
        });
        commands.addCommand(CommandIDs.scanSelectedCells, {
            label: 'Scan Selected Cells with SoterAI',
            isEnabled: () => notebooks.currentWidget !== null,
            execute: async () => {
                const panel = notebooks.currentWidget;
                if (!panel) {
                    return;
                }
                const notebook = panel.content;
                const selected = notebook.widgets.filter(c => notebook.isSelectedOrActive(c));
                const combined = selected.map(cellSource).join('\n\n');
                await runScan(`Scan ${selected.length} selected cell(s)`, combined);
            }
        });
        commands.addCommand(CommandIDs.redactCell, {
            label: 'Redact Active Cell for AI (SoterAI)',
            isEnabled: () => activeCell() !== null,
            execute: async () => {
                const cell = activeCell();
                if (!cell) {
                    return;
                }
                const source = cellSource(cell);
                if (!source.trim()) {
                    return;
                }
                try {
                    const { redacted } = await broker.redact(source);
                    // Redaction is produced by the broker, not this adapter.
                    cell.model.sharedModel.setSource(redacted);
                    ensureReport().reportNotice('Redact active cell', 'Cell source replaced with a locally redacted version.');
                }
                catch (err) {
                    handleError('Redact active cell', err);
                }
            }
        });
        commands.addCommand(CommandIDs.scanNotebookForSecrets, {
            label: 'Scan Notebook for Secrets (SoterAI)',
            isEnabled: () => notebooks.currentWidget !== null,
            execute: async () => {
                const panel = notebooks.currentWidget;
                if (!panel) {
                    return;
                }
                const combined = panel.content.widgets.map(cellSource).join('\n\n');
                await runScan('Scan notebook for secrets', combined);
            }
        });
        commands.addCommand(CommandIDs.safePrompt, {
            label: 'Safe Prompt Check (SoterAI)',
            execute: async () => {
                const input = await _jupyterlab_apputils__WEBPACK_IMPORTED_MODULE_0__.InputDialog.getText({
                    title: 'SoterAI safe prompt check',
                    label: 'Prompt to check before sending to an AI assistant:'
                });
                if (!input.button.accept || !input.value) {
                    return;
                }
                try {
                    const result = await broker.scanMessages([
                        { role: 'user', content: input.value }
                    ]);
                    ensureReport().reportScan('Safe prompt check', result);
                    announce(result);
                }
                catch (err) {
                    handleError('Safe prompt check', err);
                }
            }
        });
        commands.addCommand(CommandIDs.toggleOutputMonitor, {
            label: 'Toggle SoterAI Output-Leak Monitor',
            isToggled: () => outputMonitorEnabled,
            execute: async () => {
                outputMonitorEnabled = !outputMonitorEnabled;
                if (settings) {
                    try {
                        const s = await settings.load(PLUGIN_ID);
                        await s.set('outputMonitor', outputMonitorEnabled);
                    }
                    catch {
                        /* schema absent; in-memory toggle only */
                    }
                }
                ensureReport().reportNotice('Output-leak monitor', outputMonitorEnabled
                    ? 'Enabled. New cell outputs will be scanned by the broker; only redacted findings appear here.'
                    : 'Disabled.');
            }
        });
        commands.addCommand(CommandIDs.openReport, {
            label: 'Open SoterAI Guard Report',
            execute: () => {
                ensureReport();
            }
        });
        // --- Output-leak monitor -----------------------------------------------
        // Watches code-cell output areas on the current notebook. When enabled, it
        // sends output TEXT to the broker's /v1/scan and reports ONLY the redacted
        // result. Raw output text is never placed in the report panel.
        const wireOutputMonitor = (panel) => {
            if (!panel) {
                return;
            }
            panel.content.widgets.forEach(cell => {
                if (!(cell instanceof _jupyterlab_cells__WEBPACK_IMPORTED_MODULE_2__.CodeCell)) {
                    return;
                }
                const outputs = cell.model.outputs;
                outputs.changed.connect(async () => {
                    if (!outputMonitorEnabled) {
                        return;
                    }
                    const text = extractOutputText(cell);
                    if (!text.trim()) {
                        return;
                    }
                    try {
                        const result = await broker.scan(text);
                        if (result.decision !== 'allow') {
                            ensureReport().reportScan('Output-leak monitor', result);
                            announce(result);
                        }
                    }
                    catch (err) {
                        handleError('Output-leak monitor', err);
                    }
                });
            });
        };
        notebooks.currentChanged.connect((_, panel) => wireOutputMonitor(panel));
        wireOutputMonitor(notebooks.currentWidget);
        // --- Palette ------------------------------------------------------------
        if (palette) {
            [
                CommandIDs.scanCell,
                CommandIDs.scanSelectedCells,
                CommandIDs.redactCell,
                CommandIDs.scanNotebookForSecrets,
                CommandIDs.safePrompt,
                CommandIDs.toggleOutputMonitor,
                CommandIDs.openReport
            ].forEach(command => palette.addItem({ command, category: CATEGORY }));
        }
        // Silence unused-var lints for optional flows kept for the real build.
        void _broker__WEBPACK_IMPORTED_MODULE_4__.ServerProxyTransport;
    }
};
/** Concatenate text/plain and stream text from a code cell's outputs. */
function extractOutputText(cell) {
    const outputs = cell.model.outputs;
    const parts = [];
    for (let i = 0; i < outputs.length; i++) {
        const output = outputs.get(i).toJSON();
        if (typeof output.text === 'string') {
            parts.push(output.text);
        }
        else if (Array.isArray(output.text)) {
            parts.push(output.text.join(''));
        }
        const plain = output.data?.['text/plain'];
        if (typeof plain === 'string') {
            parts.push(plain);
        }
        else if (Array.isArray(plain)) {
            parts.push(plain.join(''));
        }
    }
    return parts.join('\n');
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (plugin);


/***/ },

/***/ "./lib/report.js"
/*!***********************!*\
  !*** ./lib/report.js ***!
  \***********************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ReportPanel: () => (/* binding */ ReportPanel)
/* harmony export */ });
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @lumino/widgets */ "webpack/sharing/consume/default/@lumino/widgets");
/* harmony import */ var _lumino_widgets__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(_lumino_widgets__WEBPACK_IMPORTED_MODULE_0__);

/**
 * Read-only report panel for SoterAI IDE Guard.
 *
 * PLANNED / UNBUILT. It renders ONLY redacted, display-safe fields returned by
 * the broker: decision, risk score, categories, content hash, and the broker's
 * `evidencePreview`. Raw cell source, prompts, secrets, and notebook OUTPUTS are
 * never written into this panel — that is a blocking acceptance criterion in
 * docs/jupyterlab-test-report.md.
 */
class ReportPanel extends _lumino_widgets__WEBPACK_IMPORTED_MODULE_0__.Widget {
    list;
    constructor() {
        super();
        this.id = 'soterai-guard-report';
        this.title.label = 'SoterAI Guard';
        this.title.caption = 'SoterAI IDE Guard — redacted findings';
        this.title.closable = true;
        this.addClass('soterai-report');
        const header = document.createElement('div');
        header.className = 'soterai-report-header';
        header.textContent =
            'Local-first findings from the authenticated loopback broker. ' +
                'Only redacted evidence is shown; nothing is uploaded to SoterAI Cloud by default.';
        this.node.appendChild(header);
        this.list = document.createElement('div');
        this.list.className = 'soterai-report-list';
        this.node.appendChild(this.list);
        this.empty();
    }
    empty() {
        this.list.textContent = '';
        const placeholder = document.createElement('div');
        placeholder.className = 'soterai-report-empty';
        placeholder.textContent = 'No scans yet.';
        this.list.appendChild(placeholder);
    }
    /** Append a redacted scan result. Never pass raw content to this method. */
    reportScan(title, result) {
        const lines = [
            `Decision: ${result.decision || 'unknown'}`,
            `Risk: ${result.riskScore ?? 0}`,
            `Safe: ${result.safe}`
        ];
        if (result.categories && result.categories.length > 0) {
            lines.push(`Categories: ${result.categories.join(', ')}`);
        }
        if (result.contentHash) {
            lines.push(`Content hash: ${result.contentHash}`);
        }
        if (result.evidencePreview) {
            lines.push(`Redacted evidence: ${result.evidencePreview}`);
        }
        this.appendBlock(title, lines.join('\n'), decisionClass(result.decision));
    }
    /** Append a plain status/notice line (no raw content). */
    reportNotice(title, body) {
        this.appendBlock(title, body, 'soterai-notice');
    }
    appendBlock(title, body, variantClass) {
        const empty = this.list.querySelector('.soterai-report-empty');
        if (empty) {
            empty.remove();
        }
        const block = document.createElement('div');
        block.className = `soterai-report-item ${variantClass}`;
        const head = document.createElement('div');
        head.className = 'soterai-report-item-title';
        const time = new Date().toLocaleTimeString();
        head.textContent = `[${time}] ${title}`;
        const pre = document.createElement('pre');
        pre.className = 'soterai-report-item-body';
        pre.textContent = body;
        block.appendChild(head);
        block.appendChild(pre);
        this.list.insertBefore(block, this.list.firstChild);
    }
}
function decisionClass(decision) {
    switch (decision) {
        case 'block':
            return 'soterai-decision-block';
        case 'approval_required':
        case 'redact':
        case 'warn':
            return 'soterai-decision-warn';
        case 'allow':
            return 'soterai-decision-allow';
        default:
            return 'soterai-decision-unknown';
    }
}


/***/ }

}]);
//# sourceMappingURL=lib_index_js.d107bd81c1105268e528.js.map