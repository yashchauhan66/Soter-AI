/** Theme-aware sidebar styles; no remote fonts, images or resources. */
export const controlPanelStyles = `
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --sg-accent: #f96403;
    --sg-border: var(--vscode-panel-border, #454545);
    --sg-muted: var(--vscode-descriptionForeground, #b4b4b4);
    --sg-surface: var(--vscode-sideBarSectionHeader-background, #252526);
    --sg-good: var(--vscode-testing-iconPassed, #89d185);
    --sg-warn: var(--vscode-editorWarning-foreground, #cca700);
    --sg-error: var(--vscode-errorForeground, #f48771);
  }
  body { margin: 0; color: var(--vscode-foreground, #ddd); background: var(--vscode-sideBar-background, #1e1e1e); font: 12px/1.55 var(--vscode-font-family, 'Segoe UI', sans-serif); }
  button, a, summary { -webkit-tap-highlight-color: transparent; }
  button { font: inherit; cursor: pointer; }
  button, a, summary { touch-action: manipulation; }
  button:disabled { cursor: default; }
  h1, h2, p, dl, dd { margin: 0; }
  main { max-width: 760px; margin: auto; padding-bottom: 24px; }
  .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
  .skip-link { position: fixed; top: -100px; left: 8px; z-index: 20; padding: 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .skip-link:focus { top: 8px; }
  .brand-header { display: flex; align-items: center; gap: 10px; padding: 17px 16px 12px; }
  .brand-logo { width: 34px; height: 34px; object-fit: contain; flex: none; }
  .brand-text { min-width: 0; flex: 1; }
  .brand-name { font-size: 16px; font-weight: 650; letter-spacing: -.3px; line-height: 1.35; }
  .brand-tagline { display: block; margin-top: 3px; color: var(--sg-muted); font-size: 9px; letter-spacing: 1.25px; font-weight: 600; }
  .brand-version { color: var(--sg-muted); font-size: 10px; font-variant-numeric: tabular-nums; }
  .icon-button { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: var(--vscode-icon-foreground, currentColor); flex: none; }
  .icon-button:hover { background: var(--vscode-toolbar-hoverBackground, var(--sg-surface)); border-color: var(--sg-border); }
  .section-nav { display: flex; gap: 18px; margin: 0 16px; padding: 0 0 9px; border-bottom: 1px solid var(--sg-border); }
  .section-nav a { color: var(--sg-muted); text-decoration: none; font-size: 11px; min-height: 26px; display: inline-flex; align-items: center; }
  .section-nav a[aria-current="location"] { color: var(--vscode-foreground); box-shadow: 0 2px var(--sg-accent); }
  .section-nav a:hover { color: var(--vscode-textLink-foreground); }
  .status-card { margin: 16px 14px 0; border: 1px solid var(--sg-border); border-radius: 10px; background: var(--sg-surface); overflow: hidden; }
  .status-top { display: flex; gap: 10px; align-items: flex-start; padding: 16px 14px 14px; }
  .status-icon { display: grid; place-items: center; width: 30px; height: 30px; border: 1px solid currentColor; border-radius: 8px; flex: none; font-size: 15px; margin-top: 3px; }
  .status-icon.success { color: var(--sg-good); }
  .status-icon.warning { color: var(--sg-warn); }
  .status-icon.error { color: var(--sg-error); }
  .status-icon.idle { color: var(--sg-muted); }
  .status-info { flex: 1; min-width: 0; }
  .eyebrow { font-size: 9px; font-weight: 650; letter-spacing: 1px; color: var(--sg-muted); line-height: 1.5; }
  .status-title { font-size: 19px; line-height: 1.3; font-weight: 650; letter-spacing: -.4px; margin-top: 5px; overflow-wrap: anywhere; }
  .status-sub { margin-top: 6px; font-size: 12px; line-height: 1.55; color: var(--sg-muted); overflow-wrap: anywhere; }
  .status-meta { display: inline-flex; margin-top: 9px; font-size: 10px; padding: 2px 7px; border: 1px solid var(--sg-border); border-radius: 4px; font-variant-numeric: tabular-nums; }
  .outcome-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); border-block: 1px solid var(--sg-border); }
  .outcome { padding: 10px 7px; min-width: 0; border-right: 1px solid var(--sg-border); }
  .outcome:last-child { border-right: 0; }
  .outcome-label { font-size: 10px; color: var(--sg-muted); }
  .outcome-value { font-size: 11px; font-weight: 600; margin-top: 3px; line-height: 1.5; }
  .outcome-value.on { color: var(--sg-good); }
  .outcome-value.attention { color: var(--sg-warn); }
  .cta-wrap { padding: 13px 14px 14px; }
  .cta { display: block; width: 100%; min-height: 38px; padding: 9px 12px; margin-top: 7px; border: 1px solid transparent; border-radius: 6px; background: var(--sg-accent); color: #161616; text-align: left; font-weight: 650; font-size: 12px; }
  .cta > span { float: right; margin-left: 5px; }
  .cta:hover { background: #ff7a24; }
  .cta.calm { background: var(--vscode-button-secondaryBackground, #343434); color: var(--vscode-button-secondaryForeground, #fff); border-color: var(--sg-border); }
  .cta.calm:hover { background: var(--vscode-button-secondaryHoverBackground, #434343); }
  .cta-hint { color: var(--sg-muted); font-size: 11px; line-height: 1.55; margin-top: 7px; overflow-wrap: anywhere; }
  .scope-notice { margin: 12px 16px 0; padding: 0 0 0 10px; border-left: 2px solid var(--sg-warn); }
  .scope-label { font-size: 11px; font-weight: 650; }
  .scope-notice p { color: var(--sg-muted); font-size: 11px; margin-top: 3px; }
  .text-button { border: 0; background: transparent; color: var(--vscode-textLink-foreground, #4daafc); padding: 3px 0; min-height: 26px; text-align: left; font-size: 11px; }
  .text-button:hover { text-decoration: underline; }
  .privacy-receipt { margin: 14px 14px 0; padding: 10px 12px; border: 1px solid var(--sg-border); border-radius: 7px; }
  .privacy-title { font-size: 11px; font-weight: 650; }
  .privacy-detail { color: var(--sg-muted); font-size: 11px; margin-top: 4px; line-height: 1.55; }
  .privacy-receipt.connected { border-left: 2px solid var(--vscode-textLink-foreground); }
  .privacy-receipt.attention { border-left: 2px solid var(--sg-warn); }
  .auto-setup { margin: 14px 14px 0; padding: 12px; border: 1px solid var(--sg-border); border-top: 2px solid var(--sg-accent); border-radius: 8px; background: var(--sg-surface); }
  .auto-setup h2 { font-size: 13px; line-height: 1.4; margin-top: 4px; }
  .auto-setup > p { color: var(--sg-muted); font-size: 11px; margin-top: 6px; }
  .setup-steps { list-style: none; padding: 0; margin: 11px 0; display: grid; gap: 6px; }
  .setup-steps li { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; font-size: 11px; }
  .setup-state { color: var(--sg-muted); font-size: 10px; flex: none; }
  [data-setup-stage][data-status="complete"] .setup-state { color: var(--sg-good); }
  [data-setup-stage][data-status="running"] .setup-state { color: var(--vscode-textLink-foreground); }
  [data-setup-stage][data-status="attention"] .setup-state { color: var(--sg-warn); }
  [data-setup-stage][data-status="failed"] .setup-state { color: var(--sg-error); }
  .broker-row { margin: 9px 14px 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { display: inline-flex; align-items: center; gap: 5px; padding: 3px 6px; font-size: 10px; border: 1px solid var(--sg-border); border-radius: 4px; color: var(--sg-muted); }
  .pill-on { color: var(--sg-good); }
  .pill-restricted { color: var(--sg-warn); }
  .status-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
  .section-label { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 21px 16px 9px; font-size: 12px; font-weight: 650; letter-spacing: -.1px; scroll-margin-top: 12px; }
  .section-count { color: var(--sg-muted); font-size: 10px; font-weight: 400; font-variant-numeric: tabular-nums; }
  .protect-card { margin: 0 14px; padding: 12px; background: var(--sg-surface); border: 1px solid var(--sg-border); border-radius: 8px; }
  .protect-card > p { color: var(--sg-muted); font-size: 11px; margin-bottom: 10px; }
  .protect-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 7px; }
  .btn-secondary { min-width: 0; min-height: 36px; padding: 7px 9px; border: 1px solid var(--sg-border); border-radius: 5px; background: transparent; color: var(--vscode-foreground); font-size: 11px; font-weight: 500; }
  .btn-secondary:hover { background: var(--vscode-list-hoverBackground, #333); }
  .field-hint { display: block; margin-top: 9px; font-size: 10px; color: var(--sg-muted); }
  .task-grid { display: grid; gap: 6px; padding: 0 14px; }
  .task-card { display: flex; align-items: center; gap: 10px; width: 100%; min-width: 0; min-height: 58px; padding: 11px 12px; border: 1px solid var(--sg-border); border-radius: 7px; background: transparent; color: var(--vscode-foreground); text-align: left; }
  .task-card:hover { border-color: var(--vscode-focusBorder, #f96403); background: var(--vscode-list-hoverBackground, #333); }
  .task-icon { width: 28px; height: 28px; display: grid; place-items: center; flex: none; border: 1px solid var(--sg-border); border-radius: 6px; color: var(--vscode-icon-foreground, currentColor); }
  .task-icon svg { width: 16px; height: 16px; }
  .task-content { flex: 1; min-width: 0; }
  .task-label { display: block; font-size: 12px; font-weight: 600; line-height: 1.4; }
  .task-desc { display: block; color: var(--sg-muted); font-size: 11px; margin-top: 3px; line-height: 1.5; }
  .task-arrow { color: var(--sg-muted); }
  .controls-list { padding: 0 16px; }
  .control-row { display: flex; gap: 10px; align-items: flex-start; padding: 13px 0; border-bottom: 1px solid var(--sg-border); }
  .control-row:last-child { border-bottom: 0; }
  .control-body { flex: 1; min-width: 0; order: 1; }
  .control-left { order: 2; padding-top: 2px; flex: none; }
  .control-header { display: flex; flex-wrap: wrap; gap: 5px 7px; align-items: center; }
  .control-label { font-size: 12px; font-weight: 600; }
  .control-note, .control-managed { font-size: 11px; color: var(--sg-muted); margin-top: 5px; line-height: 1.55; }
  .control-managed { border-left: 2px solid var(--vscode-textLink-foreground); padding-left: 7px; }
  .badge { display: inline-flex; border: 1px solid currentColor; padding: 1px 5px; border-radius: 4px; font-size: 9px; line-height: 1.6; font-weight: 600; max-width: 100%; overflow-wrap: anywhere; }
  .badge-ENFORCED, .badge-VERIFIED { color: var(--sg-good); }
  .badge-REDACTED, .badge-managed { color: var(--vscode-textLink-foreground); }
  .badge-MONITORED { color: var(--sg-warn); }
  .badge-EXPOSED { color: var(--sg-error); }
  .badge-off, .badge-UNKNOWN { color: var(--sg-muted); }
  .toggle { position: relative; width: 42px; height: 26px; padding: 0; border: 1px solid var(--sg-border); border-radius: 14px; }
  .toggle-on { background: var(--vscode-button-background, #f96403); border-color: var(--vscode-button-background, #f96403); }
  .toggle-off { background: var(--vscode-input-background, #353535); }
  .toggle-thumb { position: absolute; top: 3px; width: 18px; height: 18px; border-radius: 50%; transition: left .12s; }
  .toggle-on .toggle-thumb { left: 19px; background: var(--vscode-button-foreground, #fff); }
  .toggle-off .toggle-thumb { left: 3px; background: var(--sg-muted); }
  .toggle-managed { cursor: not-allowed; }
  summary { cursor: pointer; color: var(--vscode-textLink-foreground); min-height: 26px; font-size: 11px; padding-block: 4px; }
  summary:hover { text-decoration: underline; }
  .control-detail { margin-top: 5px; }
  .control-detail p { padding: 7px 0 0 9px; border-left: 1px solid var(--sg-border); font-size: 11px; color: var(--sg-muted); line-height: 1.6; }
  .more-tools { margin: 7px 16px 0; }
  .more-tools .task-grid { padding: 7px 0 0; }
  .more-tools .controls-list { padding: 0; }
  .guide-card { margin: 14px 14px 0; padding: 9px 12px; border: 1px solid var(--sg-border); border-radius: 7px; }
  .guide-title { font-size: 12px; font-weight: 600; margin-top: 8px; }
  .guide-copy, .guide-steps { color: var(--sg-muted); font-size: 11px; }
  .guide-copy { margin-top: 4px; }
  .guide-steps { padding-left: 18px; margin-block: 8px 10px; line-height: 1.9; }
  .guide-button { width: 100%; }
  .actions-row { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; padding: 0 14px; }
  .btn-danger { padding: 8px; min-width: 0; min-height: 36px; border: 1px solid var(--sg-error); color: var(--sg-error); background: transparent; border-radius: 5px; font-size: 11px; }
  .btn-danger:hover { background: var(--vscode-list-hoverBackground); }
  .utility-note { color: var(--sg-muted); font-size: 10px; margin: 8px 16px 0; }
  .surface-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 6px; margin: 0 14px; }
  .surface-button { border: 1px solid var(--sg-border); border-radius: 5px; background: transparent; color: var(--vscode-foreground); min-height: 44px; font-size: 11px; padding: 7px; }
  .surface-button:hover { background: var(--vscode-list-hoverBackground); }
  .feedback { margin: 12px 14px 0; padding: 9px 11px; border: 1px solid var(--sg-border); border-left: 3px solid var(--vscode-textLink-foreground); border-radius: 5px; color: var(--vscode-foreground); font-size: 11px; }
  .feedback.success { border-left-color: var(--sg-good); }
  .feedback.error { border-left-color: var(--sg-error); }
  .operation-banner { display: none; position: sticky; top: 0; z-index: 10; padding: 9px 14px; border-bottom: 1px solid var(--sg-border); background: var(--vscode-editor-background, #1e1e1e); color: var(--vscode-foreground); font-size: 11px; }
  body[data-pending="true"] .operation-banner { display: block; }
  .footer { margin: 22px 16px 0; padding-top: 12px; border-top: 1px solid var(--sg-border); }
  .footer-links { display: flex; flex-wrap: wrap; gap: 2px 6px; align-items: center; }
  .footer-link { padding: 4px 0; min-height: 26px; border: 0; background: transparent; font-size: 10px; color: var(--vscode-textLink-foreground); }
  .footer-link:hover { text-decoration: underline; }
  .footer-sep, .footer-meta { color: var(--sg-muted); font-size: 10px; }
  .footer-meta { margin-top: 8px; line-height: 1.7; }
  .label-help { margin-top: 6px; }
  .label-help p { color: var(--sg-muted); font-size: 11px; line-height: 1.6; margin-top: 5px; }
  :focus-visible { outline: 2px solid var(--vscode-focusBorder, #f96403); outline-offset: 3px; }
  button[aria-busy="true"] { cursor: progress; }
  button:disabled:not(.toggle-managed) { opacity: .6; }
  @media (max-width: 300px) {
    .brand-header { padding-inline: 12px; gap: 8px; }
    .brand-version { display: none; }
    .status-top { padding: 12px 10px; gap: 8px; }
    .status-icon { width: 24px; height: 24px; font-size: 12px; }
    .status-title { font-size: 17px; }
    .outcome { padding-inline: 5px; }
    .outcome-label { font-size: 9px; }
    .protect-grid { grid-template-columns: 1fr; }
  }
  @media (max-width: 260px) {
    .brand-name { font-size: 14px; }
    .brand-logo { width: 28px; height: 28px; }
    .status-card, .privacy-receipt, .broker-row, .guide-card, .protect-card, .feedback, .surface-grid { margin-inline: 9px; }
    .section-label { padding-inline: 11px; }
    .outcome-grid { grid-template-columns: 1fr; }
    .outcome { display: flex; gap: 8px; align-items: center; justify-content: space-between; border-right: 0; border-bottom: 1px solid var(--sg-border); padding: 6px 10px; }
    .outcome:last-child { border-bottom: 0; }
    .outcome-value { margin-top: 0; }
    .actions-row { grid-template-columns: 1fr; }
    .control-note, .control-detail, .privacy-detail, .task-desc, .cta-hint, .scope-notice, .utility-note { overflow-wrap: anywhere; }
  }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; animation: none !important; } }
  @media (forced-colors: active) {
    .status-card, .privacy-receipt, .protect-card, .task-card, .guide-card, .toggle, .cta, .btn-secondary, .surface-button { border-color: CanvasText; }
    .toggle-on { background: Highlight; }
    .toggle-on .toggle-thumb { background: HighlightText; }
    .scope-notice { border-left-color: CanvasText; }
    .cta { background: ButtonFace; color: ButtonText; }
    :focus-visible { outline-color: Highlight; }
  }
`;
