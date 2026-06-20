import Link from "next/link";
import { CodeBlock, InlineCode } from "@/components/ui/CodeBlock";
import { DocViewTracker } from "@/components/docs/DocViewTracker";

const phpCode = `$in = cyberrakshak_guard_input( $user_message );
if ( $in['blocked'] ) {
    $reply = $in['safe_text'];
} else {
    $ai   = my_chatbot_generate( $in['safe_text'] );
    $out  = cyberrakshak_guard_output( $ai );
    $reply = $out['safe_text'] ?? $ai;
}`;
const shortcodeCode = `[cyberrakshak_chatbot_guard]    // local proxy + optional badge
[cyberrakshak_security_badge]   // badge only`;
const jsCode = `const res = await fetch("/wp-json/cyberrakshak/v1/guard-input", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-WP-Nonce": crgNonce,
  },
  body: JSON.stringify({ text: userMessage }),
});
const { blocked, safe_text, decision } = await res.json();`;

export default function WordpressDocsPage() {
  return (
    <main className="container-page py-16">
      <DocViewTracker />
      <div className="mx-auto max-w-3xl">
        <Link href="/docs" className="text-sm text-slate-500 hover:text-cyan transition-colors">← Back to docs</Link>
        <p className="eyebrow mt-6">Platform guide</p>
        <h1 className="mt-3 text-4xl font-bold">WordPress Integration</h1>
        <p className="mt-5 text-lg leading-8 text-slate-400">
          Protect your WordPress chatbot by guarding input and output server-side through the Soter API.
        </p>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Install the Plugin</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-400">
            <li>Copy <InlineCode>integrations/wordpress-plugin/cyberrakshak-guard</InlineCode> into <InlineCode>wp-content/plugins/</InlineCode>, or upload the packaged zip via <strong>Plugins → Add New → Upload Plugin</strong>.</li>
            <li>Activate <strong>CyberRakshak Guard</strong> (the plugin slug remains <InlineCode>cyberrakshak-guard</InlineCode> for compatibility).</li>
          </ol>
          <p className="mt-4 text-sm text-slate-400">Package a zip from the repo root:</p>
          <CodeBlock language="bash">{`npm run package:wordpress   # produces dist/cyberrakshak-guard.zip`}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Configure Settings</h2>
          <p className="mt-3 text-slate-400">
            Navigate to <strong>Settings → CyberRakshak Guard</strong>:
          </p>
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/50">
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Setting</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-300">Notes</th>
                </tr>
              </thead>
              <tbody className="text-slate-400">
                {[
                  ["API Base URL", "Your Soter host URL or self-hosted URL"],
                  ["API Key", "ck_live_… Stored server-side, shown only masked"],
                  ["Project ID", "Optional; forwarded as metadata"],
                  ["Enable Input Guard", "Guard incoming visitor messages"],
                  ["Enable Output Guard", "Guard chatbot responses"],
                  ["Enable Security Badge", 'Show "Protected by Soter" badge'],
                  ["Block message", "Shown when a request is blocked"],
                  ["Public rate limit", "Per-IP per-minute cap on REST proxy routes"],
                ].map(([setting, notes]) => (
                  <tr key={setting} className="border-b border-slate-800/50">
                    <td className="px-4 py-2.5 font-medium text-slate-300">{setting}</td>
                    <td className="px-4 py-2.5">{notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Shortcode Usage</h2>
          <CodeBlock language="html">{shortcodeCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Server-side PHP Integration</h2>
          <CodeBlock language="php">{phpCode}</CodeBlock>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Front-end via Local Proxy</h2>
          <p className="mt-3 text-slate-400">The frontend JavaScript calls the <strong>local</strong> WordPress REST route, never the Soter API directly:</p>
          <CodeBlock language="javascript">{jsCode}</CodeBlock>
          <div className="mt-4 rounded-lg border border-slate-800 p-4">
            <p className="text-sm font-semibold text-slate-300">REST Routes</p>
            <ul className="mt-2 space-y-2 text-sm text-slate-400">
              <li><InlineCode>POST /wp-json/cyberrakshak/v1/guard-input</InlineCode> — <InlineCode>{`{ "text": "…" }`}</InlineCode> → <InlineCode>{`{ blocked, decision, safe_text, risk_types }`}</InlineCode></li>
              <li><InlineCode>POST /wp-json/cyberrakshak/v1/guard-output</InlineCode> — same shape</li>
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold">Troubleshooting</h2>
          <ul className="mt-4 list-disc space-y-2 pl-5 leading-7 text-slate-400">
            <li><strong>Test connection fails with auth error</strong> — re-enter the API key (the masked value is a placeholder)</li>
            <li><strong>Base URL rejected on save</strong> — it must start with <InlineCode>https://</InlineCode></li>
            <li><strong>429 from the proxy</strong> — lower traffic or raise the per-IP rate limit setting</li>
            <li><strong>Guard unreachable</strong> — input guarding fails open (passes through) so the site keeps working</li>
          </ul>
        </section>

        <div className="mt-12 flex items-center justify-between border-t border-slate-800 pt-8">
          <Link href="/docs/zendesk" className="text-sm text-cyan hover:text-cyan/80 transition-colors">← Zendesk</Link>
          <Link href="/docs/generic-chatbot" className="text-sm text-cyan hover:text-cyan/80 transition-colors">Generic Chatbot →</Link>
        </div>
      </div>
    </main>
  );
}
