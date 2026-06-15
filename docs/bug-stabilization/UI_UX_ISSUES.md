# UI/UX Issues — CyberRakshak Guard

Date: 2026-06-16 · Branch: `final-project-audit`

Audited dashboard components and flows for form reset, loading/empty/error states, navigation, toasts, and one-time-secret display.

## Observations (LOW severity — not fixed this session; documented for follow-up)

These came from the guard/logs/UI audit. None are functional blockers; each is a robustness/polish item. They were left unchanged to keep this stabilization pass focused on the verified HIGH/MEDIUM correctness and security bugs (per the "do not add features / do not rewrite" constraint), but they are tracked here.

1. **`WebhookManager` toggle/remove swallow errors** (`components/dashboard/WebhookManager.tsx:112-138`). `toggle`/`remove` call `fetch` then `router.refresh()` without checking `response.ok`; a 403/500 looks like success in the UI. `createEndpoint`/`rotate` in the same file do it correctly. Recommend mirroring their `if (!response.ok) throw` + `setError` pattern.
2. **`NewProjectForm` loading state on success** (`components/dashboard/NewProjectForm.tsx:33-38`). `setLoading(false)` is only in `catch`; on success the code calls `window.location.assign` and never clears loading. If navigation stalls (bfcache/slow nav) the button stays "Creating…". Recommend a `finally`. (Note: this navigation approach itself was the CRG-RT-004 fix and works; this is only the stuck-button edge case.)
3. **`LogsFilterBar` uncontrolled selects** (`components/dashboard/LogsFilterBar.tsx:37,48`). `<select defaultValue>` is uncontrolled; on client re-render without remount the selects can show stale filter state vs the URL. Recommend `key={...}` on the form or controlled values. The page is `force-dynamic` so a full navigation refreshes correctly; the risk is only soft client transitions.

## Verified-correct UX

- API key raw value shown once, prefix/preview retained after refresh (covered by API tests).
- Webhook secret one-time display + rotation (covered by webhook tests).
- Logs: filter bar (shareable GET params) + First/Next pagination wired (CRG-RT-006).
- Signup: when verification is required, shows a check-your-email notice rather than a doomed auto sign-in (CRG-RT-005); resend hint on send failure.
- Empty states render on dashboard surfaces; local production navigation 294–548 ms.
