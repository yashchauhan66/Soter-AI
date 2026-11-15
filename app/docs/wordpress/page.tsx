import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocsHeading } from "@/components/docs/DocsHeading";
import { DocsPageShell } from "@/components/docs/DocsPageShell";

export const metadata: Metadata = {
  title: "WordPress Plugin: AI Security for Chatbots",
  description:
    "Install the SoterAI WordPress plugin, configure settings, use shortcodes and protect your chatbot with PHP and REST API input/output guarding.",
  alternates: { canonical: "/docs/wordpress" },
};

const phpCode = `// Your chatbot supplies $user_message and my_chatbot_generate().
$hold = 'This reply is unavailable. Please contact support.';
$in = soter_guard_input( $user_message );
if ( ! empty( $in['error'] ) || ! empty( $in['blocked'] ) ) {
    $reply = $hold;
} else {
    $ai  = my_chatbot_generate( $in['safe_text'] );
    $out = soter_guard_output( $ai );
    if ( ! empty( $out['error'] ) || ! empty( $out['blocked'] ) ) {
        $reply = $hold;
    } else {
        $reply = $out['safe_text'];
    }
}`;
const shortcodeCode = `[soter_chatbot_guard]
[soter_chatbot_guard show_badge="false"]
[soter_security_badge]`;
const jsCode = `// The shortcode emits this JSON; it contains no SoterAI key.
const node = document.querySelector(".soter-guard-config");
if (!node) throw new Error("Add the soter_chatbot_guard shortcode first.");
const config = JSON.parse(node.textContent);

const res = await fetch(config.inputUrl, {
  method: "POST",
  credentials: "same-origin",
  headers: {
    "Content-Type": "application/json",
    "X-WP-Nonce": config.nonce,
  },
  body: JSON.stringify({ text: userMessage }),
});
if (!res.ok) throw new Error("The local guard check is unavailable.");
const { blocked, safe_text, decision } = await res.json();
if (blocked !== false || !["ALLOW", "REDACT"].includes(decision) ||
    typeof safe_text !== "string") {
  throw new Error("Withhold this message for review.");
}
// UI feedback only: enforce both guards again in your PHP chatbot handler.
// The public proxy omits the helper's error flag; ALLOW is not proof of a scan.`;

export default function WordpressDocsPage() {
  return (
    <DocsPageShell path="/docs/wordpress">

        <section className="docs-section">
          <DocsHeading>Step 1: Install the plugin</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The repository ships SoterAI Guard 0.1.0 in <InlineCode>integrations/wordpress-plugin/soter-guard</InlineCode>.
            It declares WordPress 5.8+ and PHP 7.4+. It provides PHP helpers and local REST proxies;
            it does not install a chatbot or automatically intercept another plugin&apos;s model calls.
          </p>
          <ol className="mt-4 list-decimal space-y-2 pl-5 leading-7 text-slate-200">
            <li>Copy that <InlineCode>soter-guard</InlineCode> folder into <InlineCode>wp-content/plugins/</InlineCode>, or upload the packaged zip via <strong>Plugins → Add New → Upload Plugin</strong>.</li>
            <li>Activate <strong>SoterAI Guard</strong> from the Plugins page.</li>
          </ol>
          <p className="mt-4 text-sm text-slate-200">Package a zip from the repo root:</p>
          <CodeBlock language="bash" title="terminal">{`npm run package:wordpress   # produces dist/soter-guard.zip`}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 2: Configure settings</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Navigate to <strong>Settings → SoterAI Guard</strong> to configure:
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Setting</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Notes</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {[
                  ["API Base URL", "HTTPS origin; defaults to https://api.soterai.in. The client appends /api/guard/input or /api/guard/output."],
                  ["API Key", "Stored in WordPress options and masked in the admin form. Protect database access and backups; masking is not encryption."],
                  ["Project ID", "Optional metadata only. The API key determines the authorized project."],
                  ["Enable Input Guard", "Enables the input REST proxy check; off passes text through. PHP helpers call the API independently of this toggle."],
                  ["Enable Output Guard", "Enables the output REST proxy check; off passes text through. PHP helpers call the API independently of this toggle."],
                  ["Enable Security Badge", "Stored preference; this package's shortcode rendering uses its show_badge attribute instead."],
                  ["Block message", "Shown when a request is blocked"],
                  ["Public rate limit", "Transient-based limit shared by both proxies, keyed by REMOTE_ADDR. Default 30; configurable from 1 to 240."],
                ].map(([setting, notes]) => (
                  <tr key={setting} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-medium text-slate-300">{setting}</td>
                    <td className="px-4 py-2.5">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 leading-7 text-slate-200">
            Save settings before using <strong>Test connection</strong>. It sends a fixed test message to the
            authenticated input endpoint; it does not verify your chatbot&apos;s routing. Settings and the test
            action require the WordPress <InlineCode>manage_options</InlineCode> capability and a nonce.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 3: Use shortcodes</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The first shortcode emits route URLs and a <InlineCode>wp_rest</InlineCode> nonce in{" "}
            <InlineCode>.soter-guard-config</InlineCode>, plus a badge by default. Use the second form to
            hide the badge. The badge-only shortcode performs no guarding.
          </p>
          <CodeBlock language="html" title="wordpress editor">{shortcodeCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 4: PHP integration (server-side)</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            Call both PHP helpers inside the server handler that owns generation and delivery. This example
            withholds both input and output on a reported error or denial, including HUMAN_REVIEW.{" "}
            <InlineCode>my_chatbot_generate</InlineCode> is your own model adapter, not a plugin function.
          </p>
          <CodeBlock language="php" title="functions.php" showLineNumbers>{phpCode}</CodeBlock>
          <p className="mt-3 leading-7 text-slate-200">
            The shipped client is not a strict response-schema validator: a malformed successful API response
            can normalize to ALLOW. If you require fail-closed validation of every upstream response, add that
            validation in your server integration rather than treating this helper as a complete enforcement boundary.
            Escape the chosen reply for its final HTML context, or return it through WordPress JSON helpers.
          </p>
        </section>

        <section className="docs-section">
          <DocsHeading>Step 5: Frontend via local proxy</DocsHeading>
          <p className="mt-3 leading-7 text-slate-200">
            The frontend JavaScript calls the <strong>local</strong> WordPress REST route, never the SoterAI API directly.
            Both <InlineCode>/wp-json/soter/v1/guard-input</InlineCode> and <InlineCode>/wp-json/soter/v1/guard-output</InlineCode>{" "}
            accept POST JSON with <InlineCode>text</InlineCode>. Use the shortcode URLs rather than hard-coding the
            site root, especially for WordPress installed in a subdirectory.
          </p>
          <p className="mt-3 leading-7 text-slate-200">
            The public routes check a nonce and a best-effort per-IP limit, not visitor authentication.
            Browser checks can be bypassed, and the public response omits the PHP error flag.
            Use this only for UI feedback; keep final input/output enforcement in PHP and handle rejected checks in your UI.
          </p>
          <CodeBlock language="javascript" title="frontend.js" showLineNumbers>{jsCode}</CodeBlock>
        </section>

        <section className="docs-section">
          <DocsHeading>Troubleshooting</DocsHeading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["Auth error on test", "Check the saved key and HTTPS base URL. Blank or all-asterisk key submissions preserve the existing key; enter a new value only when replacing it."],
              ["Base URL rejected", "Must start with https://"],
              ["403 from proxy", "Check the shortcode's current nonce. Cached or stale page markup may require a refreshed page; never expose the API key as a workaround."],
              ["429 from proxy", "The local transient limit is exhausted. Review traffic and proxy/IP behavior before raising the configured cap."],
              ["Guard unreachable or upstream error", "The client passes original text through for both directions on transport errors and non-429 HTTP errors, with error=true. Upstream 429 is normalized to BLOCK. Check error in PHP; the local proxy hides it and can still return HTTP 200."],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-slate-800 bg-slate-950/45 p-4">
                <p className="font-semibold text-sm">{title}</p>
                <p className="mt-1 text-sm text-slate-200">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="docs-section">
          <div className="rounded-lg border border-cyan/30 bg-gradient-to-r from-cyan/5 to-transparent p-6">
            <DocsHeading>What&apos;s next?</DocsHeading>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/docs/generic-chatbot" className="button-primary gap-2">
                Generic Chatbot Guide <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/rest-api" className="button-secondary gap-2">
                REST API Reference <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/docs/zendesk" className="button-secondary gap-2">
                Zendesk Guide
              </Link>
            </div>
          </div>
        </section>

    </DocsPageShell>
  );
}
