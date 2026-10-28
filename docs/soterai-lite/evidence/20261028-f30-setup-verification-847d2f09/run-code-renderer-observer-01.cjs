"use strict";
// ATTACH ONLY. Root owns the Code child, profile, listener and normal withdrawal.
const C = require("./accessibility-binding-01.cjs");
const {typePaletteQuery}=require("../20261028-f29-protection-center-6c93e15a/palette-keyboard-fixture-05.cjs");
const { fs, path, assert, pin, readJson, dDirectory, writeJson, endpoint, admit, until, inside, sha } = C;
const IDS = ["soterai-protected-items", "soterai-protection-activity", "soterai-protection-coverage"];
const {paletteQueries}=require("./palette-entrypoints-01.cjs");
const QUERIES=paletteQueries(require("./vsix-extracted-01/extension/package.json"));
const FOCUS=QUERIES.focus;
const at = (value, field) => field.split(".").reduce((v, k) => v?.[k], value);
const outputName = "f29-renderer-observations-01.json";
async function main() {
    assert.equal(process.argv.length, 3, "Usage: node run-code-renderer-observer-01.cjs <bound JSON>");
    const { b, bindingPin } = admit(process.argv[2], "CODE_RENDERER");
    const gate = dDirectory(b.gateDirectory), profile = dDirectory(b.profile), workspace = dDirectory(b.workspace);
    assert(inside(profile, gate)); assert(!inside(workspace, gate));
    assert(Number.isSafeInteger(b.actualCodePid) && b.actualCodePid > 0);
    const origin = endpoint(b.endpoint), owner = JSON.parse(pin(b.ownerReceipt).raw.toString("utf8").replace(/^\uFEFF/, ""));
    assert.equal(at(owner, b.ownerPidField), b.actualCodePid, "Actual child owner PID mismatch.");
    const custody = JSON.parse(pin(b.listenerCustody).raw.toString("utf8").replace(/^\uFEFF/, ""));
    const listenerPid = at(custody, b.listenerPidField);
    assert(listenerPid === b.actualCodePid || Array.isArray(custody.codeProcessTreePids) && custody.codeProcessTreePids.includes(listenerPid), "CDP listener must belong to the witnessed owned Code tree.");
    assert.equal(custody.localAddress, "127.0.0.1"); assert.equal(Number(custody.localPort), Number(new URL(origin).port));
    assert.equal(path.resolve(custody.profile).toLowerCase(), profile.toLowerCase());
    assert.equal(custody.rootCodePid, b.actualCodePid);
    assert.equal(b.expectedThemeClass, "hc-black"); assert.equal(b.expectReducedMotion, true);
    assert(typeof b.targetTitleContains === "string" && b.targetTitleContains.length >= 8 && b.targetTitleContains.length <= 120);
    const readyFile = path.join(gate, "f29-renderer-ready.json"), doneFile = path.join(gate, "f29-renderer-done.json");
    assert(!fs.existsSync(doneFile) && !fs.existsSync(path.join(gate, outputName)), "Refuse duplicate observer results.");
    const startedAt = new Date().toISOString();
    const ready = await until(() => fs.existsSync(readyFile) && readJson(readyFile, 65536), 90000, "N06 actual owner readiness not observed");
    const readyRaw = fs.readFileSync(readyFile), readySha256 = sha(readyRaw);
    assert.equal(ready.schemaVersion, 1); assert.equal(ready.feature, "F29"); assert.equal(ready.stage, "N06_ACTUAL_PROJECT_PRIVACY_CAPTURE");
    assert.equal(ready.syntheticOnly, true); assert.equal(ready.signals, 0);
    assert.equal(path.resolve(ready.profile).toLowerCase(), profile.toLowerCase());
    assert.equal(path.resolve(ready.workspace).toLowerCase(), workspace.toLowerCase());
    assert.equal(path.resolve(ready.runRoot).toLowerCase(), gate.toLowerCase());
    assert(b.runtimes.some(row => row.sha256 === ready.loadedBundleSha256));
    assert(inside(gate, ready.html.path)); const html = pin(ready.html).raw.toString("utf8");
    assert(html.includes("Private secrets. Productive coding.") && html.includes("Full-protection claim:"));
    const result = { schemaVersion: 1, feature: "F30", status: "INCOMPLETE", independence: "LOW_SAME_LINEAGE", startedAt, bindingPin,
        readySha256, actualCodePid: b.actualCodePid, listenerPid, origin, signals: 0, childLaunched: false,
        inputMethod: "REAL_OWNED_RENDERER_KEYBOARD_ONLY_NO_MOUSE_NO_DOM_FOCUS", commandQueries: QUERIES, observations: [],
        nativeTreeKeyboard: "NOT_RUN", highContrast: "NOT_RUN", reducedMotion: "NOT_RUN", chooserEscape: "NOT_RUN",
        scope: "Actual owned native Code renderer; exact owner HTML and actual host theme are separately captured for Edge. API-only native tests, Edge snapshot axe, human screen reader and usability are separate.",
        limitations: ["Synthetic isolated profile and same-lineage automation; no independent/human evidence.", "Initial isolated profile uses built-in high contrast and reduceMotion:on; no normal profile or OS setting was changed."] };
    let browser, page, failure;
    try {
        // connectOverCDP's installed browserProcess.close/kill both disconnect the
        // transport (coreBundle.js pin); no Playwright-owned process is created.
        const { chromium } = require("playwright");
        browser = await chromium.connectOverCDP(origin, { timeout: 15000, noDefaults: true, artifactsDir: gate });
        const pages = browser.contexts().flatMap(context => context.pages());
        const candidates = [];
        for (const candidate of pages) if (/^vscode-file:\/\/vscode-app\//.test(candidate.url()) && (await candidate.title()).includes(b.targetTitleContains)) candidates.push(candidate);
        assert.equal(candidates.length, 1, "One exact owned workbench renderer required; no arbitrary page fallback.");
        page = candidates[0]; page.setDefaultTimeout(8000); await page.bringToFront();
        result.renderer = { url: page.url(), title: await page.title() };
        const snapshot = async () => page.evaluate(ids => {
            const roots=[document], seen=new Set(roots);
            for(let i=0;i<roots.length&&roots.length<64;i++)for(const element of roots[i].querySelectorAll('*'))if(element.shadowRoot&&!seen.has(element.shadowRoot)){seen.add(element.shadowRoot);roots.push(element.shadowRoot);}
            const all=selector=>roots.flatMap(root=>[...root.querySelectorAll(selector)]), byId=id=>all('[id]').find(element=>element.id===id);
            let active=document.activeElement;for(let i=0;i<16&&active?.shadowRoot?.activeElement;i++)active=active.shadowRoot.activeElement;
            const contains=(container,node)=>{for(let i=0;node&&i<64;i++,node=node.parentElement||node.getRootNode()?.host)if(node===container)return true;return false;};
            const paneOf=node=>{for(let i=0;node&&i<64;i++,node=node.parentElement||node.getRootNode()?.host)if(node.classList?.contains('pane'))return node;return undefined;};
            const describe=element=>element?{tag:element.tagName,id:element.id,role:element.getAttribute('role'),ariaLabel:element.getAttribute('aria-label'),activeDescendant:element.getAttribute('aria-activedescendant'),text:(element.textContent||'').slice(0,900)}:null;
            const titles=['Protected items','Activity','Coverage'],trees=all('[role="tree"]');
            const inventory=trees.slice(0,30).map(tree=>({id:tree.id,ariaLabel:tree.getAttribute('aria-label'),paneId:paneOf(tree)?.id,paneLabel:paneOf(tree)?.querySelector('.title-label')?.textContent,rowCount:all('[role="treeitem"]').filter(row=>contains(tree,row)).length}));
            const views=ids.map((id,index)=>{
                const exact=byId(id),direct=exact&&(exact.getAttribute('role')==='tree'?exact:all('[role="tree"]').find(tree=>contains(exact,tree)));
                const semantic=trees.filter(tree=>{const label=(tree.getAttribute('aria-label')||'').trim(),paneTitle=(paneOf(tree)?.querySelector('.title-label')?.textContent||'').trim();return label.toLowerCase()===titles[index].toLowerCase()||paneTitle.toLowerCase()===titles[index].toLowerCase();});
                const tree=direct||(semantic.length===1?semantic[0]:undefined),container=exact||(tree&&(paneOf(tree)||tree));
                if(!tree||!container)return{view:id,found:false,semanticCandidates:semantic.length};
                const rect=tree.getBoundingClientRect(),style=getComputedStyle(tree),activeId=tree.getAttribute('aria-activedescendant')||active?.getAttribute('aria-activedescendant');
                const selected=activeId?byId(activeId):all('[role="treeitem"][aria-selected="true"]').find(row=>contains(tree,row));
                return{view:id,found:true,selectorEvidence:direct?'EXACT_NATIVE_VIEW_ID':'UNIQUE_ACTUAL_TREE_ACCESSIBLE_NAME_OR_PANE_TITLE',containerId:container.id,containerRole:container.getAttribute('role'),tree:describe(tree),visible:rect.width>0&&rect.height>0,rowCount:all('[role="treeitem"]').filter(row=>contains(tree,row)).length,selected:describe(selected),focusWithin:!!active&&contains(tree,active),style:{color:style.color,backgroundColor:style.backgroundColor,outline:style.outline,animationDuration:style.animationDuration,transitionDuration:style.transitionDuration,scrollBehavior:style.scrollBehavior}};
            });
            return{at:Date.now(),bodyClass:document.body.className,workbenchClass:all('.monaco-workbench')[0]?.className,highContrast:all('.hc-black').length>0,reducedMotion:all('.monaco-reduce-motion').length>0,mediaReducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,active:describe(active),views,treeInventory:inventory,openShadowRoots:roots.length-1};
        },IDS);
        const first = await snapshot(); result.observations.push({ phase: "initial-live-DOM-discovery", ...first });
        assert(first.highContrast && first.workbenchClass?.includes("hc-black"), "Actual high contrast workbench was not rendered.");
        assert(first.reducedMotion, "Actual native reduced-motion class was not rendered.");
        result.highContrast = "OBSERVED_ACTUAL_HC_BLACK_RENDERER"; result.reducedMotion = "OBSERVED_ACTUAL_MONACO_REDUCE_MOTION";
        // Capture only the real rendered privacy frame and actual host variables.
        const variableNames=[...new Set([...html.matchAll(/var\((--vscode-[a-zA-Z0-9_-]+)/g)].map(match=>match[1]))];assert(variableNames.length>10&&variableNames.length<512);
        const discoveredFrames=[];let frame;
        for(const target of browser.contexts().flatMap(context=>context.pages()))for(const candidate of target.frames()){
            try{const metadata=await candidate.evaluate(()=>({title:document.title,h1:document.querySelector('h1')?.textContent?.trim(),bodyClass:document.body.className}));discoveredFrames.push({url:candidate.url(),...metadata});if(metadata.title==='Project privacy'&&metadata.h1==='Private secrets. Productive coding.')frame=candidate;}catch(error){discoveredFrames.push({url:candidate.url(),errorName:error.name});}
        }
        result.frameDiscovery=discoveredFrames;
        const originalCsp=html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];assert(originalCsp);
        let styles;
        if(frame){
            styles=await frame.evaluate(names=>{const style=getComputedStyle(document.documentElement),variables={};for(const name of names)variables[name]=style.getPropertyValue(name).trim();return{documentTitle:document.title,heading:document.querySelector('h1')?.textContent,bodyClass:document.body.className,color:getComputedStyle(document.body).color,background:getComputedStyle(document.body).backgroundColor,variables,csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')};},variableNames);
            assert.equal(styles.csp,originalCsp);styles.status='ACTUAL_OWNED_CODE_WEBVIEW_THEME_CAPTURE';result.adjacentLiveFrame='OBSERVED_EXACT_OWNER_DOCUMENT';
        }else{
            const actualHost=await page.evaluate(names=>{const host=document.querySelector('.monaco-workbench');if(!host)throw Error('Actual host workbench absent');const computed=getComputedStyle(host),variables={};for(const name of names)variables[name]=computed.getPropertyValue(name).trim();return{variables,color:computed.color,background:computed.backgroundColor,bodyClass:host.className,renderedHostTitle:document.title};},variableNames);
            const documentTitle=html.match(/<title>([^<]+)<\/title>/)?.[1],heading=html.match(/<h1[^>]*>([^<]+)<\/h1>/)?.[1];assert.equal(documentTitle,'Project privacy');assert.equal(heading,'Private secrets. Productive coding.');
            styles={...actualHost,documentTitle,heading,csp:originalCsp,status:'ACTUAL_OWNED_CODE_WORKBENCH_THEME_CAPTURE',documentMetadataSource:'EXACT_CAPTURED_OWNER_HTML_NOT_LIVE_FRAME'};result.adjacentLiveFrame='NOT_OBSERVED_NO_LIVE_FRAME_PASS_CLAIM';
        }
        assert(styles.variables['--vscode-foreground']&&styles.variables['--vscode-editor-background'],'Actual host theme variables missing');
        result.adjacentCapture={html:ready.html,styles:writeJson(path.join(gate,'f29-project-privacy-theme-capture-01.json'),{schemaVersion:1,feature:'F29',readySha256,html:ready.html,loadedBundleSha256:ready.loadedBundleSha256,rendererUrl:page.url(),frameUrl:frame?.url(),...styles,hostingLayer:frame?'Actual webview-computed theme variables; exact HTML and CSP retained.':'Actual workbench-computed theme variables plus separately exact owner HTML/CSP. No live webview frame coverage claimed.',signals:0})};
        const palette = async query => {
            const paletteState = async () => page.evaluate(() => ({ focused: document.hasFocus(), active: { tag: document.activeElement?.tagName, role: document.activeElement?.getAttribute("role"), ariaLabel: document.activeElement?.getAttribute("aria-label") }, widgets: [...document.querySelectorAll(".quick-input-widget")].map(element => ({ visible: element.getBoundingClientRect().width > 0, text: element.innerText?.slice(0,1200), inputs: [...element.querySelectorAll("input")].map(input => ({ value: input.value, ariaLabel: input.getAttribute("aria-label"), placeholder: input.placeholder })) })) }));
            await page.keyboard.press("Escape"); await page.keyboard.press("Control+Shift+P");
            await typePaletteQuery(page,query,until); result.observations.push({ phase: "actual-palette-before-result-check", query, palette: await paletteState() });
            await until(async () => { const widget = page.locator(".quick-input-widget"); if (!await widget.isVisible()) return false; const labels = (await widget.innerText()).replace(/\s+/g, " ").toLowerCase(); return labels.includes(query.replace(/\s+/g, " ").toLowerCase()); }, 8000, "Actual command palette result not observed before Enter");
            await page.keyboard.press("Enter");
        };
        await palette(QUERIES.open);
        await until(async () => (await snapshot()).views[0].focusWithin, 8000, "Keyboard palette did not focus actual Protected items tree");
        for (let index = 0; index < IDS.length; index++) {
            if (index) await palette(FOCUS[index]);
            const focused = await until(async () => { const value = await snapshot(); return value.views[index].focusWithin && value; }, 8000, "Actual keyboard focus did not reach exact native view");
            assert(focused.views[index].tree?.role === "tree" && focused.views[index].rowCount > 0 && focused.views[index].visible);
            result.observations.push({ phase: "keyboard-focus", view: IDS[index], ...focused });
            for (const key of ["Home", "ArrowDown", "ArrowUp", "End", "Home"]) { await page.keyboard.press(key); const after = await snapshot(); assert(after.views[index].focusWithin); result.observations.push({ phase: "keyboard-navigation", view: IDS[index], key, ...after }); }
        }
        const selectByKeyboard = async (index, label) => {
            await palette(FOCUS[index]); await page.keyboard.press("Home");
            for (let n = 0; n < 40; n++) {
                const current = await snapshot();
                if (current.views[index].selected?.text.includes(label) || current.views[index].selected?.ariaLabel?.includes(label)) return current;
                await page.keyboard.press("ArrowDown");
            }
            throw new Error("Fixed safe action row not reached using actual arrow keys.");
        };
        result.observations.push({phase:"actual-verify-before-enter",...(await selectByKeyboard(2,"Verify my setup"))});
        await page.keyboard.press("Enter");
        await until(async()=>{const value=await snapshot();return value.views[2].tree?.text?.includes("Synthetic checks: CURRENT");},15000,"Actual Verify action did not publish current synthetic results");
        for(const label of ["secret-matching: PASS (3/3)","output-redactor: PASS (10/10)","gateway-loopback: PASS (6/6)"]){result.observations.push({phase:"actual-verify-component-row",label,...(await selectByKeyboard(2,label))});}
        result.verifySetup="OBSERVED_REAL_TREE_ENTER_CURRENT_THREE_CANARY_COMPONENTS";
        result.observations.push({ phase: "safe-revoke-before-enter", ...(await selectByKeyboard(0, "Revoke managed reads and clear previews")) });
        await page.keyboard.press("Enter"); result.observations.push({ phase: "safe-revoke-after-enter", ...(await snapshot()) });
        result.observations.push({ phase: "workflow-before-enter", ...(await selectByKeyboard(2, "Review optional setup and restore")) });
        await page.keyboard.press("Enter");
        await until(async () => await page.locator(".quick-input-widget").isVisible() && (await page.locator(".quick-input-widget").innerText()).includes("Protection Center: optional setup and restore"), 8000, "Real optional workflow picker did not appear");
        const beforeEscape = await page.locator(".quick-input-widget").innerText(); await page.keyboard.press("Escape");
        await until(async () => !(await page.locator(".quick-input-widget").isVisible()), 8000, "Real Escape did not dismiss optional workflow picker");
        result.observations.push({ phase: "actual-picker-escape", pickerTitleObserved: beforeEscape.slice(0, 160), ...(await snapshot()) });
        result.chooserEscape = "OBSERVED_ACTUAL_QUICK_PICK_ENTER_AND_ESCAPE";
        await palette(QUERIES.open);
        await until(async () => (await snapshot()).views[0].focusWithin, 8000, "Keyboard return focus missing");
        const final = await snapshot(); assert(final.highContrast && final.reducedMotion);
        result.observations.push({ phase: "final-live-renderer", ...final });
        const screenshot = path.join(gate, "f29-code-native-high-contrast-motion-01.png"); await page.screenshot({ path: screenshot });
        const screenshotRaw = fs.readFileSync(screenshot); result.screenshot = { path: screenshot, bytes: screenshotRaw.length, sha256: sha(screenshotRaw) };
        result.nativeTreeKeyboard = "OBSERVED_ACTUAL_PALETTE_ARROWS_ENTER_ESCAPE_NO_MOUSE";
        result.status = "PASS_SCOPED_ACTUAL_RENDERER_KEYS_HC_MOTION_ROOT_REVIEW_PENDING";
    } catch (error) {
        failure = error; if(page)try{result.failureUi=await page.evaluate(()=>({focused:document.hasFocus(),activeTag:document.activeElement?.tagName,activeRole:document.activeElement?.getAttribute("role"),quickInput:[...document.querySelectorAll(".quick-input-widget")].map(element=>({text:element.innerText?.slice(0,1500),visible:element.getBoundingClientRect().width>0,input:element.querySelector("input")?.value}))}));const diagnostic=path.join(gate,"f29-renderer-failure-04.png");await page.screenshot({path:diagnostic});const raw=fs.readFileSync(diagnostic);result.failureScreenshot={path:diagnostic,bytes:raw.length,sha256:sha(raw)};}catch{} result.status = "FAIL_OR_INCOMPLETE_ACTUAL_RENDERER_OBSERVER"; result.error = String(error?.stack ?? error).slice(0, 3500);
    } finally {
        // Installed connectOverCDP has browserProcess.close=transport.closeAndWait.
        // No Browser.close protocol is sent to Code and root retains child custody.
        if (browser) try { await browser.close(); result.transport = "ATTACHED_CDP_TRANSPORT_DISCONNECTED_CODE_OWNER_RETAINED"; } catch (error) { result.disconnectError = String(error.message).slice(0, 400); failure ||= error; }
        result.finishedAt = new Date().toISOString();
        const observationsPin = writeJson(path.join(gate, outputName), result);
        writeJson(doneFile, { schemaVersion: 1, status: "OBSERVER_COMPLETED", readySha256, observationsPin, signals: 0 });
        console.log(JSON.stringify({ status: result.status, observationsPin, nativeChildClosure: "ROOT_NATIVE_OWNER_REQUIRED", signals: 0 }));
    }
    if (failure) process.exitCode = 1;
}
main().catch(error => { console.error(String(error?.stack ?? error).slice(0, 3500)); process.exitCode = 1; });
