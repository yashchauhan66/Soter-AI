# Load Soter Extension in Microsoft Edge

## Prerequisites
- Microsoft Edge 116+ (Chromium-based)
- Extension built at `dist/extension/` (run `npm run build:extension`)

## Steps

1. **Build the extension** (if not already built):
   ```bash
   cd soter-repo
   npm run build:extension
   ```

2. **Open Edge Extensions page**:
   - Navigate to `edge://extensions`
   - Or: Menu → Extensions → Manage Extensions

3. **Enable Developer mode** (toggle in the bottom-left sidebar).

4. **Allow extensions from other stores** (optional, for Chrome-signed builds):
   - Click "Allow extensions from other stores" if prompted
   - This is needed for side-loading unpacked extensions

5. **Load unpacked extension**:
   - Click **"Load unpacked"**
   - Select the folder: `dist/extension/`
   - Ensure `manifest.json` is at the root of the selected folder

6. **Verify installation**:
   - Extension card appears with name "Soter Enterprise AI Control Plane"
   - No errors on the card
   - Extension is enabled

7. **Pin the extension** (optional):
   - Click the puzzle piece icon in the toolbar
   - Find "Soter Enterprise AI Control Plane"
   - Toggle the visibility icon to pin

## Key Differences from Chrome

| Aspect | Chrome | Edge |
|--------|--------|------|
| Extensions URL | `chrome://extensions` | `edge://extensions` |
| Developer mode | Top-right toggle | Bottom-left toggle |
| Extension store | Chrome Web Store | Edge Add-ons |
| Managed storage | Chrome GPO/Admin policy | Edge MDM policy |

## Managed Enterprise Deployment

For managed enterprise mode in Edge:
- Use **Microsoft Intune** or **Group Policy** to deploy the `managed-schema.json` policy
- Policy key: `HKEY_LOCAL_MACHINE\Software\Policies\Microsoft\Edge\3rdparty\extensions\<extension-id>\policy`
- See `apps/extension/public/managed-schema.json` for policy schema

## Verification Checklist

| Check | How |
|-------|-----|
| Extension loads | Card appears on `edge://extensions` |
| No errors | No red error indicator on card |
| Popup opens | Click extension icon |
| Side panel opens | Right-click → "Open side panel" |
| Content script works | Visit gemini.google.com → `data-soter-active-domain` attribute on `<html>` |
| Policy sync | Popup shows enrollment or enrollment form |

## Troubleshooting

See the Chrome loading guide for most issues — Edge is Chromium-based and behaves identically for unpacked extensions.
