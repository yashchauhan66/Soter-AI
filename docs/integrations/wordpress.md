# WordPress Integration

Plugin path: `integrations/wordpress-plugin`.

Admin settings:

- CyberRakshak Base URL
- API key
- Project ID
- Enable input guard
- Enable output guard
- Enable document/RAG scan where supported
- Test connection

The API key is stored in WordPress options and used only by server-side PHP via `wp_remote_post`. It is never printed into frontend JavaScript.

Shortcode:

```text
[cyberrakshak_chatbot_guard]
```

PHP helpers:

```php
$input = cyberrakshak_guard_input($message);
$output = cyberrakshak_guard_output($ai_response);
```

For popular chatbot plugins, call `cyberrakshak_guard_input()` before sending the user message to the chatbot provider and `cyberrakshak_guard_output()` before rendering the provider response.
