# Load Soter Extension in Chrome

## Prerequisites
- Google Chrome 116+ (or Chromium equivalent)
- Extension built at `dist/extension/` (run `npm run build:extension`)

## Steps

1. **Build the extension** (if not already built):
   ```bash
   cd soter-repo
   npm run build:extension
   ```

2. **Open Chrome Extensions page**:
   - Navigate to `chrome://extensions`
   - Or: Menu → Extensions → Manage Extensions

3. **Enable Developer mode** (top-right toggle).

4. **Load unpacked extension**:
   - Click **"Load unpacked"**
   - Select the folder: `dist/extension/`
   - Ensure `manifest.json` is at the root of the selected folder

5. **Verify installation**:
   - Extension card appears with name "Soter Enterprise AI Control Plane"
   - No "Errors" badge on the card
   - Extension is enabled (toggle is on)

6. **Pin the extension** (optional):
   - Click the puzzle piece (Extensions) icon in the toolbar
   - Find "Soter Enterprise AI Control Plane"
   - Click the pin icon

## Expected Structure

The loaded folder must contain at root:
```
manifest.json
background/
content/
popup/
sidepanel/
assets/
```

## Verification Checklist

| Check | How |
|-------|-----|
| Extension loads | Card appears on `chrome://extensions` |
| No errors | No red "Errors" button on card |
| Popup opens | Click extension icon → popup appears |
| Side panel opens | Right-click → "Open side panel" (or shortcut) |
| Content script works | Visit chatgpt.com → `data-soter-active-domain` attribute on `<html>` |
| Policy sync | Popup shows "Enrolled" or enrollment form |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| "Manifest is not valid JSON" | Run `node -e "console.log(JSON.parse(require('fs').readFileSync('dist/extension/manifest.json','utf8')))"` to validate |
| "Service worker registration failed" | Verify `background/service-worker.js` exists in `dist/extension/` |
| Missing content script | Verify `content/index.js` exists in `dist/extension/` |
| Popup blank | Open DevTools on popup (right-click → Inspect) to see console errors |
| Side panel blank | Open `chrome://extensions` → service worker link → check console |
| "This extension may have been corrupted" | Rebuild and reload |
