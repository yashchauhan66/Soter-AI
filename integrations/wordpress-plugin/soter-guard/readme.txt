=== SoterAI Guard ===
Contributors: soter
Tags: ai, security, chatbot, llm, owasp, prompt-injection, pii
Requires at least: 5.8
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 0.1.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

OWASP LLM Top 10 aligned AI security gateway for chatbots. Guards chatbot input and output server-side. Reduces risk; does not guarantee complete protection.

== Description ==

SoterAI Guard connects your WordPress chatbot to the SoterAI Guard API, an OWASP LLM Top 10 aligned AI security gateway. It inspects user input and AI output and can detect, block, redact, monitor, and report risky content such as prompt injection, jailbreaks, PII, and secrets.

Defense-in-depth: this plugin reduces risk. It does not guarantee complete protection and is not a substitute for secure development practices.

Features:

* Server-side proxy so your API key is never exposed to site visitors
* Input Guard and Output Guard toggles
* Test connection button in the admin
* Shortcode `[soter_chatbot_guard]`
* PHP helpers `soter_guard_input()` and `soter_guard_output()`
* REST endpoints `/wp-json/soter/v1/guard-input` and `/guard-output`
* Optional security badge
* Per-IP rate limiting on the public REST routes

== Installation ==

1. Upload the `soter-guard` folder to `/wp-content/plugins/`.
2. Activate the plugin through the Plugins screen.
3. Go to Settings > SoterAI Guard.
4. Enter your API Base URL and API Key, then click Test connection.

== Frequently Asked Questions ==

= Is my API key exposed to visitors? =

No. The key is stored server-side in WordPress options and sent only from the server to the Guard API. Frontend code calls the local WordPress REST routes, never the Guard API directly.

= Does this guarantee my chatbot is safe? =

No. It reduces risk through detection and policy enforcement. False positives and false negatives are possible.

== Changelog ==

= 0.1.0 =
* Initial release: admin settings, server-side proxy, REST routes, shortcode, security badge, test connection.

== Upgrade Notice ==

= 0.1.0 =
Initial release.
