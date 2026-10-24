import * as vscode from "vscode";
import { escapeHtml, getNonce } from "../firewall/util";
import { BoundarySnapshot, onDidChangeBoundaryRules, storedRules } from "../ai-boundary/BoundarySnapshot";
import { loadPrivacyVerification, evaluatePrivacyVerification, type PrivacyVerificationState } from "./VerificationEvidence";
import { privacyActionOutcome, type PrivacyActionOutcome } from "./PrivacyActionOutcome";

export interface ProjectPrivacyFacts {
    enabled: boolean; trusted: boolean; projects: string[];
    restrictions: { project: string; label: string; sensitive: boolean }[];
    unavailable: boolean; presentationEnabled?: boolean; completedAction?: string; outcome?: PrivacyActionOutcome;
    publicationEnabled?: boolean; syntheticRuntimeEnabled?: boolean; verification?: PrivacyVerificationState;
    cline?: { declaredVersion?: string; active: boolean };
}
export const PROJECT_PRIVACY_ACTIONS: Readonly<Record<string, string>> = Object.freeze({
    restrictFile: "soterai.restrictProjectFile", restrictSensitive: "soterai.restrictSensitiveFile",
    reviewRead: "soterai.reviewSafeFileAccess", readTerminal: "soterai.openProjectReadTerminal",
    revoke: "soterai.revokeProjectReads", manage: "soterai.manageAIRules", checkBeforeAI: "soterai.checkBeforeSendingToAI",
    prepareWorkspace: "soterai.preparePublicWorkspace", previewPublication: "soterai.previewDevelopmentContract",
    startPreview: "soterai.startSyntheticPreview", stopPreview: "soterai.stopSyntheticPreview",
});

export function projectPrivacyHtml(facts: ProjectPrivacyFacts, nonce: string): string {
    const e = escapeHtml;
    if (facts.presentationEnabled === false) return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}';"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Project privacy</title><style nonce="${nonce}">body{padding:24px;background:var(--vscode-editor-background);color:var(--vscode-foreground);font:13px/1.6 var(--vscode-font-family,system-ui)}main{max-width:800px;margin:auto}</style></head><body><main><h1>Project privacy dashboard disabled</h1><h2>Covers</h2><p>Backend managed restrictions are retained. Turning off this presentation does not remove policy or release originals.</p><h2>Does not cover</h2><p>Claude Code and other agents' direct reads, ordinary terminals, independent network traffic and OS isolation remain outside this dashboard's authority.</p><p>Full claim: BLOCKED. Live coverage is NOT_TESTED. Re-enable the professional UI setting to review local evidence and managed actions.</p></main></body></html>`;
    const unavailable = !facts.enabled || !facts.trusted || facts.unavailable || facts.projects.length === 0;
    const verification = facts.verification ?? evaluatePrivacyVerification(undefined, undefined, undefined);
    const button = (action: string, label: string, primary = false) => {
        const disabled = (unavailable && !["revoke", "stopPreview"].includes(action))
            || (["prepareWorkspace", "previewPublication"].includes(action) && !facts.publicationEnabled)
            || (action === "startPreview" && !facts.syntheticRuntimeEnabled);
        return `<button type="button" data-action="${action}" class="${primary ? "primary" : "secondary"}" ${disabled ? 'disabled aria-disabled="true"' : ""}>${label}</button>`;
    };
    const rows = facts.restrictions.map((rule, index) => `<tr data-restriction data-treatment="${rule.sensitive ? "sensitive" : "review"}"${index >= 25 ? " hidden" : ""}><td>${e(rule.project)}</td><td><code>${e(rule.label)}</code></td><td>${rule.sensitive ? "Always masked" : "Approval + redaction"}</td></tr>`).join("");
    const outcome = facts.outcome ?? (facts.completedAction ? privacyActionOutcome(undefined) : undefined);
    const evidenceDescription = ({ MATCHED: "Report matches the loaded bundle snapshot and current installation.",
        MISMATCH: "Bundle hashes differ. Reported checks do not establish coverage for this running installation.",
        MISSING: "No packaged verification report was found. Live coverage is not established.",
        INVALID: "The packaged report is invalid or unreadable. No passing coverage is accepted.",
        DISABLED: "Runtime evidence reporting is disabled. Live coverage is not established.",
        UNAVAILABLE: "Loaded production bundle identity is unavailable. No passing live coverage is accepted." })[verification.state];
    const hash = (value?: string) => value ? `<code class="hash">${e(value)}</code>` : '<span class="muted">Unavailable</span>';
    const suites = verification.suites.map(suite => `<tr><td>${e(suite.id)}<br><span class="muted">${e(suite.kind)}</span></td><td>${e(suite.scope)}</td><td>${suite.passed}</td><td>${suite.failed}</td><td>${suite.skipped}</td></tr>`).join("");
    const surfaces = verification.surfaces.map(surface => `<tr><td>${e(surface.id)}</td><td><span class="tag">${surface.status === "PASS" ? "Reported PASS" : e(surface.status)}</span></td><td>${e(surface.scope)}</td></tr>`).join("");
    return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Project privacy</title>
<style nonce="${nonce}">
:root{color-scheme:light dark}*{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;padding:24px;background:var(--vscode-editor-background);color:var(--vscode-foreground);font:13px/1.6 var(--vscode-font-family,system-ui)}main{max-width:1100px;margin:auto}a,button,input,select{font:inherit}button{cursor:pointer;border-radius:5px;padding:9px 14px;min-height:38px;border:1px solid var(--vscode-button-border,var(--vscode-panel-border));color:var(--vscode-button-secondaryForeground);background:var(--vscode-button-secondaryBackground)}button:hover{background:var(--vscode-button-secondaryHoverBackground)}button.primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}button.primary:hover{background:var(--vscode-button-hoverBackground)}button:focus-visible,summary:focus-visible,a:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid var(--vscode-focusBorder);outline-offset:3px}button:disabled{cursor:default;opacity:.6}h1{font-size:26px;line-height:1.25;margin:6px 0 8px}h2{font-size:16px;margin:0 0 10px}p{margin:0 0 12px}.muted{color:var(--vscode-descriptionForeground)}.eyebrow{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--vscode-descriptionForeground)}.tag{display:inline-block;border:1px solid var(--vscode-panel-border);padding:2px 8px;border-radius:4px;font-size:11px;margin:5px 6px 0 0}.notice{margin:20px 0;padding:14px 16px;border-left:3px solid var(--vscode-editorWarning-foreground);background:var(--vscode-textBlockQuote-background);border-radius:4px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.card{padding:18px;border:1px solid var(--vscode-panel-border);border-radius:7px;min-width:0}.card p{min-height:60px}.actions{display:flex;flex-wrap:wrap;gap:9px}.section{margin-top:24px}pre{padding:12px;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--vscode-textCodeBlock-background);border-radius:4px}code{font-family:var(--vscode-editor-font-family,monospace)}.hash{display:block;overflow-wrap:anywhere;font-size:11px}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:12px}th,td{padding:10px;text-align:left;border-bottom:1px solid var(--vscode-panel-border);overflow-wrap:anywhere}th{color:var(--vscode-descriptionForeground)}caption{text-align:left;margin-bottom:8px}.coverage{display:grid;grid-template-columns:1fr 1fr;gap:16px}.coverage ul{padding-left:18px;margin:0}.skip{position:absolute;left:-10000px}.skip:focus{position:static;color:var(--vscode-textLink-foreground)}#feedback{min-height:24px;margin:12px 0}#feedback[data-outcome="failed"],#feedback[data-outcome="withheld"]{color:var(--vscode-editorWarning-foreground)}details{margin:20px 0}summary{cursor:pointer}.toolbar{display:flex;align-items:end;flex-wrap:wrap;gap:12px;margin-bottom:12px}.field{display:flex;flex-direction:column;gap:4px;flex:1;min-width:160px}input,select{width:100%;min-height:36px;border:1px solid var(--vscode-input-border,var(--vscode-panel-border));background:var(--vscode-input-background);color:var(--vscode-input-foreground);border-radius:4px;padding:6px 9px}.pagination{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px}.state-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.state-grid .card p{min-height:0}dl{margin:12px 0}dt{color:var(--vscode-descriptionForeground);margin-top:8px}dd{margin:0}.status-line{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}@media(max-width:700px){body{padding:16px}.grid,.coverage,.state-grid{grid-template-columns:1fr}.card p{min-height:0}.table-wrap{max-width:100%}}@media(forced-colors:active){.card,.notice,button,.tag,input,select{border:1px solid CanvasText}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid Highlight}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}
.grid{grid-template-columns:repeat(2,minmax(0,1fr))}@media(max-width:700px){.grid{grid-template-columns:1fr}}
</style></head><body data-completed-action="${e(facts.completedAction ?? "")}"><a class="skip" href="#privacy-actions">Skip to privacy actions</a><main>
<header><div class="eyebrow">SoterAI / Project privacy</div><h1>Private secrets. Productive coding.</h1><p class="muted">Manage safe project views and review the evidence behind each coverage claim.</p><p class="muted">${e(facts.projects.join(" · ") || "Open a local project to begin.")}</p></header>
<section class="section coverage" aria-label="Coverage disclosure"><article class="card"><h2>Covers</h2><ul><li>SoterAI-managed file selection and context restrictions.</li><li>One-time approved reads through this reader.</li><li>Every environment value masked; only eligible schema names released.</li><li>Recognized-value redaction and protected regions on approved ordinary files.</li><li>Policy/content changes, expiry and pending-read revocation.</li></ul></article><article class="card"><h2>Does not cover</h2><ul><li>Direct reads by Claude Code, Cline, other extensions or native terminal agents.</li><li>Other extensions' buffers, clipboard or independent network traffic.</li><li>Old Git objects, copies, caches and logs outside managed paths.</li><li>Recognition of every unknown secret or private document.</li><li>Independent user presence, OS isolation or a deployed trusted runtime.</li></ul></article></section>
<aside class="notice" aria-label="Protection scope"><strong>Managed readers only.</strong> Other AI extensions and ordinary terminals can still read originals and send their own requests. A registered command or editor approval does not establish isolation. Full-protection claim: <strong>BLOCKED</strong>.${unavailable ? " Safe reads remain withheld until project privacy, workspace trust and valid policy are available." : ""}</aside>
<section class="section state-grid" aria-label="Current configuration"><article class="card"><h2>Managed reader</h2><span class="tag">${unavailable ? "Safe reader unavailable" : "Managed safe reader configured"}</span><p class="muted">Configuration describes this reader, not protection against independent tools.</p></article><article class="card"><h2>External AI agents</h2><p class="muted">Claude Code, Codex and Gemini checks below describe only their stated scope. CLI compatibility does not establish native tool interception or isolation.</p><dl><dt>Optional Cline declared version</dt><dd>${e(facts.cline?.declaredVersion ?? "Not available")}</dd><dt>Extension registry state</dt><dd>${facts.cline?.active ? "Active; interception is not established" : "Not active or not available"}</dd><dt>Loaded Cline bundle receipt</dt><dd>NOT_TESTED — no authenticated loaded-version receipt</dd></dl></article></section>
<section id="privacy-actions" aria-label="Project privacy actions" class="section grid">
<article class="card"><h2>1. Restrict project files</h2><p class="muted">Exclude project files from managed context. Sensitive files stay masked even in approved safe views.</p><div class="actions">${button("restrictFile", "Restrict a file", true)}${button("restrictSensitive", "Restrict as sensitive")}</div></article>
<article class="card"><h2>2. Review safe access</h2><p class="muted">This saved-file reader reviews each release. Already published public code can be used freely; original secrets stay private.</p><div class="actions">${button("reviewRead", "Review a safe view", true)}${button("readTerminal", "Open read terminal")}</div></article>
<article class="card"><h2>3. Prepare public work</h2><p class="muted">Review selected public files and synthetic development contracts. A public snapshot does not isolate a native agent.</p><div class="actions">${button("prepareWorkspace", "Prepare public workspace", true)}${button("previewPublication", "Preview development contract")}</div><p class="muted">${facts.publicationEnabled ? "Publication feature enabled; explicit manifest review still applies." : "Publication feature is off. No source workspace is mounted or isolated."}</p></article>
<article class="card"><h2>4. Try synthetic services</h2><p class="muted">Use a fixed loopback sample API for public development. It runs generated fixtures, not your application or a real database.</p><div class="actions">${button("startPreview", "Start synthetic preview", true)}${button("stopPreview", "Stop synthetic preview")}</div><p class="muted">${facts.syntheticRuntimeEnabled ? "Optional synthetic service enabled; no secret injection or production parity." : "Synthetic runtime feature is off. No real-credential fallback."}</p></article>
</section><div class="actions section">${button("checkBeforeAI", "Check selected text")}${button("revoke", "Revoke pending reads")}</div><p id="feedback" data-outcome="${outcome?.state ?? ""}" role="status" aria-live="polite" aria-atomic="true">${e(outcome?.message ?? "")}</p>
<section class="section" aria-labelledby="env-title"><h2 id="env-title">Safe environment context</h2><pre aria-label="Synthetic masked environment example">DATABASE_URL=[MASKED]\nAPI_KEY=[MASKED]\nPORT=[MASKED]</pre><p class="muted">Synthetic example. Values, URLs and comments remain withheld. Ambiguous or protected schema text is withheld conservatively. This view does not provide a working database connection. Ordinary restricted files may still contain unknown private text after recognized-secret redaction.</p></section>
<section class="section" aria-labelledby="restriction-title"><h2 id="restriction-title">Saved restrictions <span class="muted">(${facts.unavailable ? "unavailable" : facts.restrictions.length})</span></h2><div class="toolbar"><label class="field" for="restriction-search">Search file, pattern or project<input id="restriction-search" type="search" maxlength="256" autocomplete="off" placeholder="Filter saved restrictions" ${facts.unavailable ? "disabled" : ""}></label><label class="field" for="restriction-treatment">Safe-view treatment<select id="restriction-treatment" ${facts.unavailable ? "disabled" : ""}><option value="all">All restrictions</option><option value="sensitive">Always masked</option><option value="review">Approval + redaction</option></select></label></div><div class="table-wrap"><table><caption class="muted">All saved manual restrictions are searchable; known default exclusions are additional.</caption><thead><tr><th scope="col">Project</th><th scope="col">File, folder or pattern</th><th scope="col">Safe view</th></tr></thead><tbody>${facts.unavailable ? '<tr><td colspan="3">Restriction metadata is unavailable. Safe reads are withheld.</td></tr>' : rows}<tr id="no-restrictions"${facts.restrictions.length || facts.unavailable ? " hidden" : ""}><td colspan="3">No matching manual restrictions. Known credential-bearing paths remain excluded from managed context.</td></tr></tbody></table></div><div class="pagination"><span id="restriction-count" role="status" aria-live="polite">${Math.min(25, facts.restrictions.length)} of ${facts.restrictions.length} restrictions</span><div class="actions"><button type="button" id="previous-page" disabled aria-label="Previous page of restrictions">Previous</button><button type="button" id="next-page" ${facts.restrictions.length <= 25 ? "disabled" : ""} aria-label="Next page of restrictions">Next</button></div></div><div class="actions section">${button("manage", "Review saved rules")}</div><p class="muted">Relaxing a deny requires separate native review. Sensitive marks stay conservative. Same-user code can access editor settings and storage; this is not independent policy custody.</p></section>
<section class="section" aria-labelledby="verification-title"><div class="status-line"><h2 id="verification-title">Verification and coverage</h2><button type="button" data-refresh>Refresh state</button></div><span class="tag">Evidence: ${e(verification.state)}</span><span class="tag">Full claim: BLOCKED</span><p>${e(evidenceDescription)}</p><p class="muted">Packaged reports are local, editable evidence, not independent attestation. Unit/template results are not live external-agent protection tests. Loaded-bundle identity is sampled once during initialization; current disk identity is checked separately.</p><dl><dt>Loaded SoterAI bundle snapshot SHA-256</dt><dd>${hash(verification.loadedSha256)}</dd><dt>Current installed bundle SHA-256</dt><dd>${hash(verification.installedSha256)}</dd><dt>Report artifact SHA-256</dt><dd>${hash(verification.evidenceSha256)}</dd><dt>Report generated (UTC)</dt><dd>${e(verification.generatedAt ?? "Unavailable")}</dd></dl>
<div class="table-wrap"><table><caption>Reported test results ${verification.state === "MATCHED" ? "for matching artifact" : "— not accepted as active coverage"}</caption><thead><tr><th scope="col">Suite / execution kind</th><th scope="col">Tested scope</th><th scope="col">Passed</th><th scope="col">Failed</th><th scope="col">Skipped</th></tr></thead><tbody>${suites || '<tr><td colspan="5">No accepted packaged test results. Live checks remain NOT_TESTED.</td></tr>'}</tbody></table></div><div class="table-wrap section"><table><caption>Surface coverage; PASS means only the explicitly reported checks</caption><thead><tr><th scope="col">Surface</th><th scope="col">Status</th><th scope="col">Scope / limit</th></tr></thead><tbody>${surfaces}</tbody></table></div></section>
<details><summary>Approval and revocation details</summary><p>Approval applies to one saved-file snapshot for at most 60 seconds. Changed content, policy, disabled settings or cancellation withhold the result. The editor modal is not agent-proof and does not authenticate the requesting process. Already displayed, copied or transmitted output cannot be recalled. This page contains metadata and a synthetic example only.</p></details>
</main><script nonce="${nonce}">
const vscode=acquireVsCodeApi();const buttons=Array.from(document.querySelectorAll('button[data-action]'));const feedback=document.getElementById('feedback');const completed=buttons.find(button=>button.dataset.action===document.body.dataset.completedAction);if(completed&&!completed.disabled)completed.focus();let pending=false;
for(const button of buttons){button.addEventListener('click',()=>{if(pending||button.disabled)return;pending=true;feedback.dataset.outcome='';feedback.textContent='Request pending. Review the native decision; no success is confirmed.';buttons.forEach(b=>b.disabled=true);vscode.postMessage({type:button.dataset.action});});}
document.querySelector('[data-refresh]').addEventListener('click',()=>{if(!pending)vscode.postMessage({type:'refresh'});});
const search=document.getElementById('restriction-search');const treatment=document.getElementById('restriction-treatment');const rows=Array.from(document.querySelectorAll('tr[data-restriction]'));const previous=document.getElementById('previous-page');const next=document.getElementById('next-page');const count=document.getElementById('restriction-count');const empty=document.getElementById('no-restrictions');let page=0;const pageSize=25;
const saved=typeof vscode.getState==='function'?vscode.getState():undefined;if(saved&&typeof saved==='object'){if(typeof saved.query==='string')search.value=saved.query.slice(0,256);if(['all','sensitive','review'].includes(saved.treatment))treatment.value=saved.treatment;if(Number.isSafeInteger(saved.page)&&saved.page>=0)page=saved.page;}
function renderRestrictions(){const query=search.value.trim().toLocaleLowerCase();const matches=rows.filter(row=>(treatment.value==='all'||row.dataset.treatment===treatment.value)&&row.textContent.toLocaleLowerCase().includes(query));const pages=Math.max(1,Math.ceil(matches.length/pageSize));page=Math.min(page,pages-1);rows.forEach(row=>row.hidden=true);matches.slice(page*pageSize,(page+1)*pageSize).forEach(row=>row.hidden=false);previous.disabled=page===0;next.disabled=page>=pages-1;empty.hidden=matches.length>0;count.textContent=matches.length?'Showing '+(page*pageSize+1)+'–'+Math.min((page+1)*pageSize,matches.length)+' of '+matches.length+' matching restrictions ('+rows.length+' total)':'No matching restrictions ('+rows.length+' total)';if(typeof vscode.setState==='function')vscode.setState({query:search.value.slice(0,256),treatment:treatment.value,page});}
search.addEventListener('input',()=>{page=0;renderRestrictions();});treatment.addEventListener('change',()=>{page=0;renderRestrictions();});previous.addEventListener('click',()=>{if(page>0){page--;renderRestrictions();}});next.addEventListener('click',()=>{page++;renderRestrictions();});renderRestrictions();
</script></body></html>`;
}

let current: vscode.WebviewPanel | undefined;
export function openProjectPrivacyPanel(context: vscode.ExtensionContext): void {
    if (current) { current.reveal(); return; }
    const panel = vscode.window.createWebviewPanel("soteraiProjectPrivacy", "SoterAI: Project Privacy", vscode.ViewColumn.One,
        { enableScripts: true, localResourceRoots: [] });
    current = panel;
    let pending = false;
    let renderGeneration = 0;
    let lastAction: string | undefined;
    let lastOutcome: PrivacyActionOutcome | undefined;
    const resources: vscode.Disposable[] = [];
    const render = async () => {
        if (current !== panel) return;
        const generation = ++renderGeneration;
        const config = vscode.workspace.getConfiguration("soterai");
        const facts: ProjectPrivacyFacts = { enabled: config.get("projectPrivacy.enabled", true)
                && config.get("projectPrivacy.atomicSensitivePolicy", true) && config.get("projectPrivacy.safeViewComposition", true)
                && config.get("hardening.addOnlyPolicy", true),
            presentationEnabled: config.get("projectPrivacy.professionalUi", true),
            trusted: vscode.workspace.isTrusted, projects: [], restrictions: [], unavailable: false,
            completedAction: lastAction, outcome: lastOutcome, publicationEnabled: config.get("projectPrivacy.safePublication", false),
            syntheticRuntimeEnabled: config.get("projectPrivacy.syntheticRuntime", false),
            verification: loadPrivacyVerification(context.extensionPath, config.get("hardening.runtimeEvidence", true)) };
        try {
            const boundary = await BoundarySnapshot.load();
            const cline = vscode.extensions.getExtension("saoudrizwan.claude-dev");
            const version: unknown = cline?.packageJSON?.version;
            facts.cline = { declaredVersion: typeof version === "string" && /^[0-9A-Za-z.+-]{1,64}$/.test(version) ? version : undefined,
                active: cline?.isActive === true };
            for (const folder of vscode.workspace.workspaceFolders ?? []) {
                if (folder.uri.scheme !== "file") continue;
                facts.projects.push(folder.name);
                if (!boundary.availableForRoot(folder.uri)) facts.unavailable = true;
                const rules = storedRules(folder.uri.toString());
                for (const rule of rules.paths) facts.restrictions.push({ project: folder.name, label: `${rule.kind}: ${rule.pattern}`, sensitive: rule.sensitive === true });
                for (const region of rules.regions) facts.restrictions.push({ project: folder.name, label: `Protected text: ${region.path}`, sensitive: true });
            }
        } catch { facts.unavailable = true; facts.restrictions = []; }
        if (generation === renderGeneration && current === panel) panel.webview.html = projectPrivacyHtml(facts, getNonce());
    };
    const refresh = () => { if (!pending) void render(); }; // Completion always renders the latest state, including changes during review.
    resources.push(panel.webview.onDidReceiveMessage(async (message: unknown) => {
        if (!message || typeof message !== "object" || Array.isArray(message)) return;
        const item = message as Record<string, unknown>;
        if (Object.keys(item).length !== 1 || typeof item.type !== "string" || pending) return;
        if (!vscode.workspace.getConfiguration("soterai").get("projectPrivacy.professionalUi", true)) return;
        if (item.type === "refresh") { await render(); return; }
        if (!Object.prototype.hasOwnProperty.call(PROJECT_PRIVACY_ACTIONS, item.type)) return;
        if (item.type === "startPreview" && !vscode.workspace.getConfiguration("soterai").get("projectPrivacy.syntheticRuntime", false)) {
            lastAction = item.type; lastOutcome = privacyActionOutcome({ status: "UNAVAILABLE" }); await render(); return;
        }
        if (["prepareWorkspace", "previewPublication"].includes(item.type)
            && !vscode.workspace.getConfiguration("soterai").get("projectPrivacy.safePublication", false)) {
            lastAction = item.type; lastOutcome = privacyActionOutcome({ status: "UNAVAILABLE" }); await render(); return;
        }
        pending = true; lastAction = item.type;
        try { lastOutcome = privacyActionOutcome(await vscode.commands.executeCommand(PROJECT_PRIVACY_ACTIONS[item.type])); }
        catch { lastOutcome = privacyActionOutcome(undefined, true); }
        finally { pending = false; await render(); }
    }), vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration("soterai")) refresh(); }),
        vscode.workspace.onDidChangeWorkspaceFolders(refresh), vscode.workspace.onDidGrantWorkspaceTrust(refresh),
        vscode.extensions.onDidChange(refresh), onDidChangeBoundaryRules(refresh));
    for (const pattern of ["**/.aiignore", "**/.soterai/policy.json", "**/.soterai-policy.json"]) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        resources.push(watcher, watcher.onDidCreate(refresh), watcher.onDidChange(refresh), watcher.onDidDelete(refresh));
    }
    resources.push(panel.onDidDispose(() => {
        if (current === panel) current = undefined;
        renderGeneration++;
        for (const resource of resources) resource.dispose();
    }));
    context.subscriptions.push(panel);
    panel.webview.html = projectPrivacyHtml({ enabled: false, trusted: vscode.workspace.isTrusted,
        projects: [], restrictions: [], unavailable: true }, getNonce());
    void render();
}
