# WordPress demo (CyberRakshak Guard)

How to install and use the CyberRakshak Guard WordPress plugin with a chatbot.

## 1. Install the plugin

```bash
# Copy the plugin into your WordPress install
cp -r integrations/wordpress-plugin/cyberrakshak-guard \
      /path/to/wordpress/wp-content/plugins/
```

Or zip it and upload via **Plugins → Add New → Upload Plugin**:

```bash
npm run package:wordpress   # produces dist/cyberrakshak-guard.zip from repo root
```

Activate **CyberRakshak Guard** in the Plugins screen.

## 2. Configure

Go to **Settings → CyberRakshak Guard** and set:

- **API Base URL** — e.g. `https://api.cyberrakshak.dev` (or your self-hosted URL)
- **API Key** — your `ck_live_…` key (stored server-side, never shown to visitors)
- **Project ID** — optional
- Enable **Input Guard** and **Output Guard**

Click **Test connection**. A green message confirms the key works.

## 3. Use the shortcode

Add to any page or post:

```
[cyberrakshak_chatbot_guard]
```

This renders the local proxy config (REST URLs + nonce) and an optional badge.
Show only the badge with:

```
[cyberrakshak_security_badge]
```

## 4. Integrate with your chatbot plugin

In your theme or a small plugin, guard messages server-side:

```php
// Before sending the user's message to your chatbot/LLM:
$in = cyberrakshak_guard_input( $user_message );
if ( $in['blocked'] ) {
    echo esc_html( $in['safe_text'] );
} else {
    $ai_reply = my_chatbot_generate( $in['safe_text'] );
    $out = cyberrakshak_guard_output( $ai_reply );
    echo esc_html( $out['safe_text'] );
}
```

Or, from chatbot front-end JavaScript, call the local proxy (never the Guard
API directly):

```js
const res = await fetch("/wp-json/cyberrakshak/v1/guard-input", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-WP-Nonce": crgNonce },
  body: JSON.stringify({ text: userMessage }),
});
const { blocked, safe_text } = await res.json();
```

## Security notes

- The API key never reaches the browser. Frontend calls the local WP REST route.
- The public REST routes require a `wp_rest` nonce and are per-IP rate limited.
- This reduces risk; it does not guarantee complete protection.
