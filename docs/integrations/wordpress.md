# WordPress Integration

Soter protects your WordPress chatbot by guarding input and output server-side through the Soter API.

## Install the Plugin

1. Copy `integrations/wordpress-plugin/cyberrakshak-guard` into `wp-content/plugins/`, or upload the packaged zip via **Plugins → Add New → Upload Plugin**.
2. Activate **CyberRakshak Guard** (the plugin slug remains `cyberrakshak-guard` for compatibility).

Package a zip from the repo root:

```bash
npm run package:wordpress   # produces dist/cyberrakshak-guard.zip
```

## Configure Settings

**Settings → CyberRakshak Guard** (plugin name, backward compatible):

| Setting | Notes |
|---------|-------|
| API Base URL | `https://your-soter-host.example` or your self-hosted URL. |
| API Key | `ck_live_…`. Stored server-side, shown only masked. |
| Project ID | Optional; forwarded as metadata. |
| Enable Input Guard | Guard incoming visitor messages. |
| Enable Output Guard | Guard chatbot responses. |
| Enable Security Badge | Show "Protected by Soter" badge. |
| Block message | Shown when a request is blocked. |
| Public rate limit | Per-IP per-minute cap on the REST proxy routes. |

> **Environment variables:** The plugin also supports `SOTER_API_KEY`, `SOTER_BASE_URL`, and `SOTER_PROJECT_ID` for configuration.

## Shortcode Usage

```
[cyberrakshak_chatbot_guard]    // local proxy config (REST URLs + nonce) + optional badge
[cyberrakshak_security_badge]   // badge only
```

## Server-side PHP Integration

```php
$in = cyberrakshak_guard_input( $user_message );
if ( $in['blocked'] ) {
    $reply = $in['safe_text'];
} else {
    $ai   = my_chatbot_generate( $in['safe_text'] );
    $out  = cyberrakshak_guard_output( $ai );
    $reply = $out['safe_text'] ?? $ai;
}
```

## Front-end via the Local Proxy

The frontend JavaScript calls the **local** WordPress REST route, never the Soter API directly (so the key stays server-side):

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
|-------|------|----------|
| `POST /wp-json/cyberrakshak/v1/guard-input` | `{ "text": "…" }` | `{ blocked, decision, safe_text, risk_types }` |
| `POST /wp-json/cyberrakshak/v1/guard-output` | `{ "text": "…" }` | same shape |

Both require the `X-WP-Nonce` header (`wp_rest`) and are per-IP rate limited.

## Test Connection

Click **Test Connection** in settings. It performs an authenticated call and reports success, auth failure, or connectivity error.

## Security Notes

- API key stored server-side only; never printed in page source or sent to JS
- `manage_options` + nonce on all admin actions
- All inputs sanitized; all outputs escaped
- Per-IP transient rate limiting on public routes
- Raw sensitive prompts are not logged
- This reduces risk; it does not guarantee complete protection

## Troubleshooting

- **Test connection fails with auth error** — re-enter the API key (the masked value is a placeholder)
- **Base URL rejected on save** — it must start with `https://`
- **429 from the proxy** — lower traffic or raise the per-IP rate limit setting
- **Guard unreachable** — input guarding fails open (passes through) so the site keeps working
