/**
 * Builds a self-contained HTML preview of the SoterAI node's editor panel from the
 * REAL panel model (scripts/extract-panel-model.cjs). n8n renders its node panel
 * deterministically from the node description, so this reconstructs, per action,
 * exactly the fields / labels / placeholders / descriptions / notices / subtitle /
 * output branches a user sees — for reviewing the UX without booting n8n.
 *
 *   node scripts/extract-panel-model.cjs > panel-model.json
 *   node scripts/build-panel-preview.cjs   # writes soterai-panel-preview.html
 */
const fs = require("fs");
const path = require("path");

const model = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "panel-model.json"), "utf8"));
let markSvg = "";
try {
  markSvg = fs.readFileSync(path.join(__dirname, "..", "dist", "nodes", "SoterGuard", "soterai-mark.svg"), "utf8");
} catch {
  markSvg = "";
}

const html = `<title>SoterAI Node Panel</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --ground: #eef0f5;
    --panel: #ffffff;
    --panel-2: #f7f8fb;
    --ink: #2b2d3a;
    --muted: #6c6f80;
    --faint: #9a9db0;
    --border: #dcdee7;
    --border-strong: #c6c9d6;
    --accent: #ea4b71;
    --accent-weak: #fdecf1;
    --safe: #1f9d6b;
    --safe-weak: #e6f5ee;
    --flag: #d97a1e;
    --flag-weak: #fbf0e2;
    --info: #3b6fd6;
    --info-weak: #eaf1fc;
    --code-bg: #f4f5f8;
    --shadow: 0 1px 2px rgba(29,31,45,.06), 0 6px 20px rgba(29,31,45,.06);
    --req: #e0396a;
  }
  :root:not([data-theme="light"]) {
    @media (prefers-color-scheme: dark) {
      --ground: #14151c;
      --panel: #23252f;
      --panel-2: #1c1e27;
      --ink: #e8eaf2;
      --muted: #a2a5b8;
      --faint: #777b90;
      --border: #343747;
      --border-strong: #414458;
      --accent: #f2688a;
      --accent-weak: #34222a;
      --safe: #3fbe86;
      --safe-weak: #17281f;
      --flag: #e3a24f;
      --flag-weak: #2c2216;
      --info: #6f9bf0;
      --info-weak: #1a2130;
      --code-bg: #1a1c24;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35);
      --req: #f2688a;
    }
  }
  :root[data-theme="dark"] {
    --ground: #14151c;
    --panel: #23252f;
    --panel-2: #1c1e27;
    --ink: #e8eaf2;
    --muted: #a2a5b8;
    --faint: #777b90;
    --border: #343747;
    --border-strong: #414458;
    --accent: #f2688a;
    --accent-weak: #34222a;
    --safe: #3fbe86;
    --safe-weak: #17281f;
    --flag: #e3a24f;
    --flag-weak: #2c2216;
    --info: #6f9bf0;
    --info-weak: #1a2130;
    --code-bg: #1a1c24;
    --shadow: 0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.35);
    --req: #f2688a;
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: "Open Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding-block: 28px; padding-inline: 16px; }

  header.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
  .title-block h1 { font-size: 20px; font-weight: 700; margin: 0 0 4px; letter-spacing: -.01em; }
  .title-block p { margin: 0; color: var(--muted); font-size: 13px; max-width: 60ch; }
  .theme-btn {
    border: 1px solid var(--border-strong); background: var(--panel); color: var(--ink);
    font: inherit; font-size: 12px; padding: 7px 12px; border-radius: 8px; cursor: pointer; white-space: nowrap;
  }
  .theme-btn:hover { border-color: var(--accent); }

  .layout { display: grid; grid-template-columns: 300px 1fr; gap: 20px; align-items: start; }
  @media (max-width: 820px) { .layout { grid-template-columns: 1fr; } }

  /* Canvas node card */
  .canvas {
    background:
      radial-gradient(circle at 12px 12px, rgba(120,124,150,.16) 1.4px, transparent 1.6px) 0 0 / 22px 22px,
      var(--panel-2);
    border: 1px solid var(--border); border-radius: 14px; padding: 26px 20px; box-shadow: var(--shadow);
    position: sticky; top: env(safe-area-inset-top, 0px);
  }
  .canvas .cap { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--faint); margin-bottom: 14px; }
  .node-card {
    position: relative; background: var(--panel); border: 1px solid var(--border-strong);
    border-radius: 12px; padding: 14px; display: flex; gap: 12px; align-items: center; box-shadow: var(--shadow);
  }
  .node-icon { width: 42px; height: 42px; border-radius: 10px; background: var(--accent-weak); display: grid; place-items: center; flex: 0 0 auto; overflow: hidden; }
  .node-icon svg { width: 30px; height: 30px; }
  .node-name { font-weight: 700; font-size: 14px; }
  .node-sub { color: var(--muted); font-size: 11.5px; margin-top: 2px; font-family: "JetBrains Mono", monospace; }
  .ports { position: absolute; right: -7px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 14px; }
  .port { display: flex; align-items: center; gap: 6px; }
  .port .dot { width: 13px; height: 13px; border-radius: 50%; border: 2px solid var(--panel); }
  .port .lbl { position: absolute; right: 20px; font-size: 10px; font-weight: 600; white-space: nowrap; padding: 1px 6px; border-radius: 5px; }
  .port.safe .dot { background: var(--safe); } .port.safe .lbl { color: var(--safe); background: var(--safe-weak); }
  .port.flag .dot { background: var(--flag); } .port.flag .lbl { color: var(--flag); background: var(--flag-weak); }
  .port.single .dot { background: var(--muted); } .port.single .lbl { color: var(--muted); background: var(--code-bg); }
  .node-card.two-out { padding-right: 74px; }

  .review { margin-top: 18px; display: flex; flex-direction: column; gap: 8px; }
  .review .cap { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: var(--faint); }
  .metric { display: flex; align-items: baseline; justify-content: space-between; font-size: 12.5px; }
  .metric b { font-weight: 600; }
  .metric .n { font-family: "JetBrains Mono", monospace; font-weight: 500; }
  .flag-good { color: var(--safe); } .flag-warn { color: var(--flag); }

  /* Panel (NDV) */
  .ndv { background: var(--panel); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow); overflow: hidden; }
  .ndv-head { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; background: var(--panel-2); }
  .ndv-head .ic { width: 34px; height: 34px; border-radius: 8px; background: var(--accent-weak); display: grid; place-items: center; overflow: hidden; flex: 0 0 auto; }
  .ndv-head .ic svg { width: 24px; height: 24px; }
  .ndv-head .t { font-weight: 700; font-size: 15px; }
  .ndv-head .s { font-size: 11.5px; color: var(--muted); }
  .params { padding: 8px 20px 22px; }

  .field { padding: 14px 0; border-bottom: 1px solid var(--border); }
  .field:last-child { border-bottom: 0; }
  .flabel { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
  .flabel .req { color: var(--req); font-weight: 700; }
  .ftype { margin-left: auto; font-size: 10px; font-family: "JetBrains Mono", monospace; color: var(--faint); background: var(--code-bg); padding: 1px 6px; border-radius: 5px; }
  .fdesc { font-size: 12px; color: var(--muted); margin: 0 0 8px; max-width: 66ch; }
  .fdesc.miss { color: var(--flag); font-style: italic; }

  .control { width: 100%; font: inherit; font-size: 13px; color: var(--ink); background: var(--panel); border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px 10px; }
  .control::placeholder { color: var(--faint); }
  textarea.control { resize: vertical; min-height: 38px; font-family: "JetBrains Mono", monospace; font-size: 12px; }
  .select { position: relative; }
  .select select { appearance: none; width: 100%; font: inherit; font-size: 13px; color: var(--ink); background: var(--panel); border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px 34px 8px 10px; cursor: pointer; }
  .select::after { content: "▾"; position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; font-size: 12px; }
  .placeholderline { font-family: "JetBrains Mono", monospace; font-size: 11.5px; color: var(--faint); margin-top: 6px; }

  .toggle { display: inline-flex; align-items: center; gap: 8px; }
  .toggle .track { width: 34px; height: 19px; border-radius: 999px; background: var(--border-strong); position: relative; }
  .toggle .track.on { background: var(--accent); }
  .toggle .knob { position: absolute; top: 2px; left: 2px; width: 15px; height: 15px; border-radius: 50%; background: #fff; transition: left .15s; }
  .toggle .track.on .knob { left: 17px; }
  .toggle .state { font-size: 12px; color: var(--muted); }

  .collection { border: 1px dashed var(--border-strong); border-radius: 8px; padding: 10px 12px; background: var(--panel-2); }
  .collection .add { color: var(--accent); font-size: 12.5px; font-weight: 600; }
  .collection .members { font-size: 11.5px; color: var(--faint); margin-top: 4px; }

  .notice { border-radius: 8px; padding: 10px 12px; font-size: 12px; line-height: 1.45; border: 1px solid; }
  .notice.info { background: var(--info-weak); border-color: color-mix(in srgb, var(--info) 30%, transparent); color: var(--ink); }
  .notice code { font-family: "JetBrains Mono", monospace; background: var(--code-bg); padding: 1px 5px; border-radius: 4px; font-size: 11px; }
  .notice b { color: var(--ink); }

  .cred { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--panel-2); font-size: 12.5px; }
  .cred .k { width: 20px; height: 20px; border-radius: 5px; background: var(--accent-weak); display: grid; place-items: center; color: var(--accent); font-weight: 700; font-size: 11px; }
  .cred .opt { margin-left: auto; font-size: 11px; color: var(--faint); }

  .foot { margin-top: 22px; color: var(--faint); font-size: 11.5px; text-align: center; line-height: 1.6; }
  .foot code { font-family: "JetBrains Mono", monospace; }
</style>

<div class="wrap">
  <header class="top">
    <div class="title-block">
      <h1>SoterAI Node Panel</h1>
      <p>Exactly what the n8n editor renders for this community node — every action's fields, labels, placeholders, descriptions, notices, subtitle and output branches, generated from the built node. Pick an action to inspect it.</p>
    </div>
    <button class="theme-btn" id="themeBtn" type="button">Toggle theme</button>
  </header>

  <div class="layout">
    <aside class="canvas">
      <div class="cap">On the canvas</div>
      <div class="node-card two-out" id="nodeCard">
        <div class="node-icon" id="nodeIcon"></div>
        <div>
          <div class="node-name">SoterAI</div>
          <div class="node-sub" id="nodeSub">Guard Input (block)</div>
        </div>
        <div class="ports" id="ports"></div>
      </div>
      <div class="review">
        <div class="cap">Panel at a glance</div>
        <div class="metric"><b>Fields shown</b><span class="n" id="mFields">–</span></div>
        <div class="metric"><b>Required inputs</b><span class="n" id="mReq">–</span></div>
        <div class="metric"><b>Guidance notices</b><span class="n" id="mNotice">–</span></div>
        <div class="metric"><b>Fields with a description</b><span class="n" id="mDesc">–</span></div>
        <div class="metric"><b>Output branches</b><span class="n" id="mOut">–</span></div>
      </div>
    </aside>

    <main class="ndv">
      <div class="ndv-head">
        <div class="ic" id="ndvIcon"></div>
        <div>
          <div class="t">SoterAI</div>
          <div class="s" id="ndvSub">${model.node.description}</div>
        </div>
      </div>
      <div class="params" id="params"></div>
    </main>
  </div>

  <p class="foot">
    Reconstructed from the built node description via n8n's own <code>displayParameter</code> / <code>getNodeOutputs</code>.
    Node <code>${model.node.name}</code> · default v${model.node.defaultVersion} · credential <code>${model.node.credential ? model.node.credential.name : "none"}</code>${model.node.credential && !model.node.credential.required ? " (optional — Local engine needs none)" : ""}.
  </p>
</div>

<script>
  const MODEL = __MODEL__;
  const MARK = __MARK__;
  const byId = (id) => document.getElementById(id);

  // Inject the real node mark (or a fallback shield) into both icon slots.
  const iconHTML = MARK && MARK.trim().startsWith("<svg")
    ? MARK
    : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v6c0 4.4-3 8.3-7 9-4-0.7-7-4.6-7-9V5l7-3z" fill="#ea4b71"/><path d="M9 12l2 2 4-4" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  byId("nodeIcon").innerHTML = iconHTML;
  byId("ndvIcon").innerHTML = iconHTML;

  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function optionsBlock(f){
    const sel = f.options.map(o => {
      const on = o.value === f.default ? " selected" : "";
      return '<option'+on+'>'+esc(o.name)+'</option>';
    }).join("");
    return '<div class="select"><select>'+sel+'</select></div>';
  }

  function control(f){
    if (f.type === "options") return optionsBlock(f);
    if (f.type === "boolean") {
      const on = f.default === true;
      return '<div class="toggle"><span class="track'+(on?' on':'')+'"><span class="knob"></span></span><span class="state">'+(on?'Enabled':'Disabled')+'</span></div>';
    }
    if (f.type === "json" || (f.typeOptions && (f.typeOptions.rows||f.typeOptions.multiline))) {
      const rows = (f.typeOptions && f.typeOptions.rows) ? f.typeOptions.rows : (f.type==="json"?4:2);
      return '<textarea class="control" rows="'+rows+'" placeholder="'+esc(f.placeholder||'')+'"></textarea>';
    }
    if (f.type === "collection" || f.type === "fixedCollection") {
      const members = (f.options||[]).map(o=>o.displayName||o.name).filter(Boolean).join(", ");
      return '<div class="collection"><span class="add">+ '+esc(f.displayName)+'</span>'+(members?'<div class="members">options: '+esc(members)+'</div>':'')+'</div>';
    }
    if (f.type === "number") return '<input class="control" type="number" placeholder="'+esc(f.placeholder||String(f.default??''))+'">';
    // string
    return '<input class="control" type="'+((f.typeOptions&&f.typeOptions.password)?'password':'text')+'" placeholder="'+esc(f.placeholder||'')+'">';
  }

  function fieldHTML(f){
    if (f.type === "notice") {
      return '<div class="field"><div class="notice info">'+f.displayName+'</div></div>';
    }
    const req = f.required ? '<span class="req" title="required">*</span>' : '';
    const desc = f.description
      ? '<p class="fdesc">'+esc(f.description)+'</p>'
      : (f.type!=="collection" && f.type!=="fixedCollection" && f.type!=="boolean" ? '<p class="fdesc miss">no field description</p>' : '');
    const hint = f.hint ? '<p class="placeholderline">hint: '+esc(f.hint)+'</p>' : '';
    return '<div class="field"><div class="flabel">'+esc(f.displayName)+req+'<span class="ftype">'+f.type+'</span></div>'+desc+control(f)+hint+'</div>';
  }

  function credHTML(a){
    // Cloud-only actions genuinely require a credential; the guard actions accept one but can run Local.
    const cloudOnly = ["enrollIdentity","issuePassport","validatePassport","revokePassport"].includes(a.value);
    const req = cloudOnly ? "required for this action" : "optional (Local engine needs none)";
    return '<div class="field"><div class="flabel">Credential to connect with<span class="ftype">soterApi</span></div>'
      + '<div class="cred"><span class="k">K</span><span>SoterAI API</span><span class="opt">'+req+'</span></div></div>';
  }

  function actionSelectHTML(current){
    const opts = MODEL.actions.map(a => '<option value="'+a.value+'"'+(a.value===current?' selected':'')+'>'+esc(a.name)+'</option>').join("");
    return '<div class="field"><div class="flabel">Action<span class="ftype">options</span></div>'
      + '<p class="fdesc">'+esc(currentAction(current).action || "")+'</p>'
      + '<div class="select"><select id="actionSel">'+opts+'</select></div>'
      + '<p class="fdesc" style="margin-top:8px">'+esc(currentAction(current).description||"")+'</p></div>';
  }

  function currentAction(v){ return MODEL.actions.find(a => a.value === v) || MODEL.actions[0]; }

  function render(v){
    const a = currentAction(v);
    // Panel
    let html = actionSelectHTML(v) + credHTML(a);
    for (const f of a.fields) html += fieldHTML(f);
    byId("params").innerHTML = html;
    byId("actionSel").addEventListener("change", e => render(e.target.value));

    // Canvas
    byId("nodeSub").textContent = a.subtitle;
    const two = a.outputs.length === 2;
    const card = byId("nodeCard");
    card.classList.toggle("two-out", two);
    if (two) {
      byId("ports").innerHTML =
        '<div class="port safe"><span class="lbl">'+esc(a.outputs[0])+'</span><span class="dot"></span></div>'+
        '<div class="port flag"><span class="lbl">'+esc(a.outputs[1])+'</span><span class="dot"></span></div>';
    } else {
      byId("ports").innerHTML = '<div class="port single"><span class="lbl">'+esc(a.outputs[0]||'main')+'</span><span class="dot"></span></div>';
    }

    // Review metrics
    const inputs = a.fields.filter(f => f.type !== "notice");
    const withDesc = inputs.filter(f => f.description && f.description.length > 0).length;
    const notices = a.fields.filter(f => f.type === "notice").length;
    const req = inputs.filter(f => f.required).length;
    byId("mFields").textContent = inputs.length;
    byId("mReq").textContent = req;
    const nn = byId("mNotice"); nn.textContent = notices; nn.className = "n " + (notices>0?"flag-good":"");
    const dd = byId("mDesc"); dd.textContent = withDesc + " / " + inputs.length; dd.className = "n " + (withDesc===inputs.length?"flag-good":"flag-warn");
    byId("mOut").textContent = a.outputs.length + " (" + a.outputs.join(" · ") + ")";
  }

  // Theme toggle (per-viewer convenience)
  const root = document.documentElement;
  try { const t = localStorage.getItem("soter-theme"); if (t) root.setAttribute("data-theme", t); } catch(e){}
  byId("themeBtn").addEventListener("click", () => {
    const cur = root.getAttribute("data-theme");
    const isDark = cur ? cur === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("soter-theme", next); } catch(e){}
  });

  render("inputGuard");
</script>`;

const out = html
  .replace("__MODEL__", JSON.stringify(model))
  .replace("__MARK__", JSON.stringify(markSvg));

fs.writeFileSync(path.join(__dirname, "..", "soterai-panel-preview.html"), out);
console.log("wrote soterai-panel-preview.html (" + out.length + " bytes)");
