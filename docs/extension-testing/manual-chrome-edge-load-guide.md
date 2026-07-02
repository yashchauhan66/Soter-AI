# Manual Chrome And Edge Load Guide

Date: 2026-07-01

Load-unpacked folder:

```text
C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension
```

Do not use the ZIP for this manual local load test. Use the generated folder above.

## Chrome

1. Open Chrome.
2. Go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select:

```text
C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension
```

6. Verify the extension card appears.
7. Verify no red manifest error appears on the extension card.
8. Pin the extension if needed.
9. Click the Soter extension icon.
10. Verify the popup opens.
11. Open the side panel:
    * Click the extension icon and use any side panel/open action if present, or
    * Open Chrome side panel and choose Soter if listed.
12. Verify no red error appears in the popup or side panel.

## Edge

1. Open Edge.
2. Go to `edge://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select:

```text
C:\Users\USER\OneDrive\Desktop\Ai-Agent-Security-Guard\apps\extension\dist\extension
```

6. Verify the extension card appears.
7. Verify no red manifest error appears on the extension card.
8. Click the Soter extension icon.
9. Verify the popup opens.
10. Open the side panel and verify it renders.

## Result Table

| Check | Result | Notes |
| --- | --- | --- |
| Chrome load unpacked | PASS/FAIL | |
| Chrome manifest errors | PASS/FAIL | PASS means no manifest errors. |
| Chrome popup opens | PASS/FAIL | |
| Chrome side panel opens | PASS/FAIL | |
| Edge load unpacked | PASS/FAIL | |
| Edge manifest errors | PASS/FAIL | PASS means no manifest errors. |
| Edge popup opens | PASS/FAIL | |
| Edge side panel opens | PASS/FAIL | |

## Screenshots To Capture

Save screenshots under:

```text
docs/extension-testing/evidence/manual-load-2026-07-01/
```

Capture:

* Chrome extension card after load.
* Chrome popup open.
* Chrome side panel open.
* Edge extension card after load.
* Edge popup open.
* Edge side panel open.
* Any red extension error details.

## Where To Paste Errors

Paste browser errors into:

```text
docs/extension-testing/final-manual-publish-readiness-report.md
```

Use the Notes column for the affected check.

## Open Extension Service Worker Console

Chrome:

1. Go to `chrome://extensions/`.
2. Find Soter.
3. Click **service worker** under **Inspect views**.
4. Keep DevTools open while testing.
5. Look for red console errors.

Edge:

1. Go to `edge://extensions/`.
2. Find Soter.
3. Click **service worker** under **Inspect views**.
4. Look for red console errors.

## Open Content Script Console

1. Open a monitored page such as `https://chatgpt.com/` or the local mock page.
2. Press `F12`.
3. Open the **Console** tab.
4. Filter for `Soter` if needed.
5. Paste any red errors into the final readiness report.

Local mock page, after starting the backend:

```text
http://localhost:3000/test-ai-page
```
