# WordPress Integration

The CyberRakshak Guard WordPress plugin guards chatbot **input** and **output**
server-side through the CyberRakshak Guard API. It is OWASP LLM Top 10 aligned:
**detect, block, redact, monitor, and report**. It does not guarantee complete
protection.

## Install the plugin

1. Copy `integrations/wordpress-plugin/cyberrakshak-guard` into
   `wp-content/plugins/`, or upload the packaged zip via
   **Plugins → Add New → Upload Plugin**.
2. Activate **CyberRakshak Guard**.

Package a zip from the repo root:

```bash
npm run package:wordpress   # produces dist/cyberrakshak-guard.zip
```

## Configure settings

**Settings → CyberRakshak Guard**:

| Setting | Notes |
| --- | --- |
| API Base URL | `https://api.cyberrakshak.dev` or your self-hosted URL (https only). |
| API Key | `ck_live_…`. Stored server-side, shown only masked, never sent to the browser. |
| Project ID | Optional; forwarded as metadata. |
| Enable Input Guard | Guard incoming visitor messages. |
| Enable Output Guard | Guard chatbot responses. |
| Enable Security Badge | Show "Protected by CyberRakshak Guard". |
| Block message | Shown when a request is blocked. |
| Public rate limit | Per-IP per-minute cap on the REST proxy routes. |

To keep an existing key, leave the masked `************` value untouched on save.

## Test connection

Click **Test connection**. It performs an authenticated call and reports
success, an auth failure, or a connectivity error. Nonce-protected and
restricted to `manage_options`.

## Shortcode usage

```
[cyberrakshak_chatbot_guard]    // emits local proxy config (REST URLs + nonce) + optional badge
[cyberrakshak_security_badge]   // badge only
```

## Chatbot plugin integration

### Server-side (recommended)

```php
$in = cyberrakshak_guard_input( $user_message );
if ( $in['blocked'] ) {
    $reply = $in['safe_text'];
} else {
    $ai   = my_chatbot_generate( $in['safe_text'] );
    $out  = cyberrakshak_guard_output( $ai );
    $reply = $out['safe_text'];
}
```

### Front-end via the local proxy

Frontend JavaScript calls the **local** WordPress REST route, never the Guard
API directly (so the key stays server-side):

```js
const res = await fetch("/wp-json/cyberrakshak/v1/guard-input", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-WP-Nonce": crgNonce },
  body: JSON.stringify({ text: userMessage }),
});
const { blocked, safe_text, decision } = await res.json();
```

Routes:

| Route | Body | Response |
| --- | --- | --- |
| `POST /wp-json/cyberrakshak/v1/guard-input` | `{ "text": "…" }` | `{ blocked, decision, safe_text, risk_types }` |
| `POST /wp-json/cyberrakshak/v1/guard-output` | `{ "text": "…" }` | same shape |

Both require the `X-WP-Nonce` header (`wp_rest`) and are per-IP rate limited.

## Security notes

- API key stored server-side only; never printed in page source or sent to JS.
- `manage_options` + nonce on all admin actions.
- All inputs sanitized; all outputs escaped.
- Outbound calls use `wp_remote_post`.
- Per-IP transient rate limiting on public routes.
- Raw sensitive prompts are not logged.

## Troubleshooting

- **Test connection fails with auth error**: re-enter the API key (the masked
  value is a placeholder, not the real key).
- **Base URL rejected on save**: it must start with `https://`.
- **429 from the proxy**: lower traffic or raise the per-IP rate limit setting.
- **Guard unreachable**: input guarding fails open (passes through) so the site
  keeps working; consider withholding output on error for stricter posture.

## Disclaimer

This plugin reduces risk through pattern detection and policy enforcement. It
does not guarantee complete protection or represent OWASP certification. False
positives and false negatives are possible.
