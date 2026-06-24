# SoterAI Guard — WordPress Plugin

OWASP LLM Top 10 aligned AI security gateway for WordPress chatbots. Guards
chatbot **input** and **output** server-side through the SoterAI Guard API.

> Defense-in-depth. Reduces risk through **detect, block, redact, monitor, and
> report**. Does **not** guarantee complete protection.

## Install

1. Copy the `soter-guard` folder into `wp-content/plugins/`.
2. Activate **SoterAI Guard** in the Plugins screen.
3. Open **Settings → SoterAI Guard**.
4. Set the API Base URL and API Key, then click **Test connection**.

## Architecture

```
Visitor message
   → WordPress REST route (/wp-json/soter/v1/guard-input)   [server-side]
      → SoterAI Input Guard (x-api-key sent here, never to the browser)
   → if allowed, your chatbot generates a reply
   → WordPress REST route (/wp-json/soter/v1/guard-output)  [server-side]
      → SoterAI Output Guard
   → safe reply returned to the visitor
```

The API key lives only in the WordPress options table and is sent from PHP to
the Guard API. It is never printed in page source or exposed to JavaScript.

## Usage

### Shortcode

```
[soter_chatbot_guard]
[soter_security_badge]
```

The chatbot guard shortcode emits the local REST URLs and a `wp_rest` nonce so
your chatbot front-end can guard messages via the WordPress proxy.

### PHP helpers (server-side)

```php
$result = soter_guard_input( $user_message );
if ( $result['blocked'] ) {
    $reply = $result['safe_text']; // safe block message
} else {
    $ai = my_chatbot_generate( $result['safe_text'] );
    $out = soter_guard_output( $ai );
    $reply = $out['safe_text'];
}
```

### REST endpoints

| Route | Method | Body |
| --- | --- | --- |
| `/wp-json/soter/v1/guard-input` | POST | `{ "text": "…" }` |
| `/wp-json/soter/v1/guard-output` | POST | `{ "text": "…" }` |

Both require an `X-WP-Nonce` header (`wp_rest` action) and are per-IP rate
limited. Responses contain `blocked`, `decision`, `safe_text`, `risk_types` —
never the API key or internal details.

## Security

- API key stored server-side; never sent to the browser.
- `manage_options` capability + nonce on all admin actions.
- All inputs sanitized; all outputs escaped.
- `wp_remote_post` used for outbound calls.
- Per-IP transient rate limit on public routes.
- Raw sensitive prompts are not logged.

## Packaging

```bash
npm run package:wordpress   # from repo root, produces a distributable zip
```

## Disclaimer

SoterAI Guard reduces risk through pattern detection and policy
enforcement. It does not guarantee complete protection or represent OWASP
certification. False positives and false negatives are possible.
