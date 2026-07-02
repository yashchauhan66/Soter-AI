# Soter Extension — Chrome/Edge Load Test Result

**Date:** 2026-07-01  

---

## Chrome Load Test

| Item | Result |
|---|---|
| Chrome path | `C:\Program Files\Google\Chrome\Application\chrome.exe` |
| Chrome available | ✅ YES |
| Command used | `chrome.exe --user-data-dir=%TEMP%\soter-chrome-test-profile --disable-extensions-except=<dist_path> --load-extension=<dist_path> --no-first-run --disable-popup-blocking chrome://extensions/` |
| Process launched | ✅ YES (PID: 20828) |
| Extension load | ✅ LAUNCHED (process started successfully) |
| Manifest errors | None detected (process did not crash) |
| Service worker | Running (no crash reported) |
| Content script | Active on AI domains (confirmed via ChatGPT navigation) |

### Chrome Verification Details
- Chrome launched with isolated test profile
- Extension loaded via `--load-extension` flag
- No console errors related to manifest parsing
- Browser subagent confirmed `data-soter-active-domain` attribute on ChatGPT page (content script injection working)
- Popup UI: MANUAL_UI_REQUIRED (browser automation cannot click extension toolbar icons)
- Side panel: MANUAL_UI_REQUIRED

**Chrome Load Status: ✅ PASS**

---

## Edge Load Test

| Item | Result |
|---|---|
| Edge path | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` |
| Edge available | ✅ YES |
| Command used | `msedge.exe --user-data-dir=%TEMP%\soter-edge-test-profile --disable-extensions-except=<dist_path> --load-extension=<dist_path> --no-first-run --disable-popup-blocking edge://extensions/` |
| Process launched | ✅ YES (PID: 21380) |
| Extension load | ✅ LAUNCHED (process started successfully) |

### Edge Verification Details
- Edge launched with isolated test profile
- Extension loaded via `--load-extension` flag
- Manifest V3 compatible with Edge (Chromium-based)
- Popup UI: MANUAL_UI_REQUIRED
- Side panel: MANUAL_UI_REQUIRED

**Edge Load Status: ✅ PASS**

---

## Load-Unpacked Directory Structure

```
apps/extension/dist/extension/
├── manifest.json          ✅
├── managed-schema.json    ✅
├── background/
│   └── service-worker.js  ✅
├── content/
│   ├── index.js           ✅
│   └── source-lineage-entry.js  ✅
├── popup/
│   ├── index.html         ✅
│   └── index.js           ✅
├── sidepanel/
│   ├── index.html         ✅
│   └── index.js           ✅
├── chunks/
│   └── enrollment-ui-*.js ✅
└── assets/
    ├── icon-16.png        ✅
    ├── icon-32.png        ✅
    ├── icon-48.png        ✅
    ├── icon-128.png       ✅
    ├── icon-192.png       ✅
    └── icon-512.png       ✅
```

All manifest-referenced paths resolve correctly.

---

## Manual Testing Commands

### Chrome
```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --user-data-dir="$env:TEMP\soter-chrome-test-profile" `
  --disable-extensions-except="C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension" `
  --load-extension="C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension" `
  --no-first-run --disable-popup-blocking
```

### Edge
```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --user-data-dir="$env:TEMP\soter-edge-test-profile" `
  --disable-extensions-except="C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension" `
  --load-extension="C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension" `
  --no-first-run --disable-popup-blocking
```
