import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { getPost } from "@/lib/blog/posts";

const post = getPost("how-ai-coding-tools-leak-secrets")!;

export const metadata: Metadata = buildMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
  isArticle: true,
  datePublished: post.datePublished,
  keywords: ["ai secret leakage", "copilot secrets", "secret scanning", "ai data loss prevention"],
});

const faqs = [
  {
    q: "Do AI coding assistants store my secrets?",
    a: "It depends on the provider and your settings. Even when a provider does not train on your data, a secret you paste into a prompt has still left your machine and traveled to a third party. The safest assumption is that anything sent in a prompt is out of your control, so the goal is to avoid sending secrets in the first place.",
  },
  {
    q: "Isn't .gitignore enough to protect secrets?",
    a: "No. .gitignore stops files from being committed to Git. It does nothing to stop an AI assistant from reading an ignored .env file that is open in your editor or included in workspace context. The two problems are unrelated.",
  },
  {
    q: "How can I tell if a secret already leaked into a prompt?",
    a: "Use a local access ledger that records what context was shared with the assistant, and plant fake canary secrets to test whether your redaction actually works. SoterAI's AI Memory Inspector and canary workflow are built for exactly this.",
  },
];

export default function Page() {
  return (
    <BlogArticle meta={post} faqs={faqs}>
      <p>
        AI coding assistants are useful precisely because they read a lot of
        context: the file you have open, your selection, nearby files, your
        terminal output, and sometimes your whole workspace. That same reach is
        why they leak secrets. The assistant does not know that line 14 of your
        config is a live database password — it just sees text, and it forwards
        that text to a model running on someone else's servers.
      </p>
      <p>
        This post walks through the concrete ways credentials end up in AI
        prompts, why the usual protections do not help, and a practical,
        local-first checklist you can apply today. Every example here uses{" "}
        <strong>fake canary values</strong> — never paste a real secret to test
        anything.
      </p>

      <h2>Where the leaks actually happen</h2>
      <p>
        Secret leakage to AI tools rarely looks like a dramatic breach. It looks
        like an ordinary Tuesday. Here are the common paths.
      </p>

      <h3>1. The open .env file</h3>
      <p>
        You ask the assistant to &ldquo;explain why my app can&rsquo;t connect to
        the database.&rdquo; To help, it reads the files in scope — including the{" "}
        <code>.env</code> that happens to be open in another tab:
      </p>
      <pre><code>{`# .env  (example — fake values only)
DATABASE_URL=postgres://app:CANARY_db_pw_EXAMPLE@db.internal:5432/prod
STRIPE_SECRET_KEY=sk_live_CANARY0000EXAMPLE0000
JWT_SIGNING_SECRET=CANARY-jwt-signing-secret-EXAMPLE`}</code></pre>
      <p>
        Now those values are in the prompt. The file was in <code>.gitignore</code>,
        so it never hit your repo — but <code>.gitignore</code> has nothing to do
        with what an assistant reads from your working tree.
      </p>

      <h3>2. Pasting a stack trace or log</h3>
      <p>
        Debugging output is a classic leak vector. Connection strings, bearer
        tokens, and signed URLs routinely appear in error messages and request
        logs. When you paste that log into a chat to ask &ldquo;what does this
        error mean?&rdquo;, the embedded token goes with it.
      </p>

      <h3>3. Autocomplete on a secrets file</h3>
      <p>
        Inline completion tools send surrounding context to generate a
        suggestion. If your cursor is inside a credentials file, that context can
        include neighboring secret values — even if you never explicitly asked a
        question.
      </p>

      <h3>4. &ldquo;Fix my whole repo&rdquo; agent runs</h3>
      <p>
        Agentic modes that scan or refactor across many files widen the blast
        radius. A single &ldquo;update all API calls&rdquo; task can pull dozens
        of files — configs, seed data, test fixtures with hardcoded tokens — into
        the model&rsquo;s context in one shot.
      </p>

      <h2>Why the usual defenses miss this</h2>
      <ul>
        <li>
          <strong>Git secret scanners</strong> run at commit or push time. The AI
          read the file long before any commit.
        </li>
        <li>
          <strong>.gitignore and .dockerignore</strong> govern packaging, not
          editor context. An ignored file open in your IDE is fully visible to an
          assistant.
        </li>
        <li>
          <strong>Provider &ldquo;no-training&rdquo; settings</strong> reduce one
          risk (your data becoming training data) but do not change the fact that
          the secret left your machine and reached a third party.
        </li>
        <li>
          <strong>Vaults and secret managers</strong> help only if the secret is
          never materialized into a file the assistant can read. In practice,
          local <code>.env</code> files still exist during development.
        </li>
      </ul>
      <p>
        The gap is consistent: existing tools protect the <em>repository</em> and
        the <em>deployment</em>, but the leak happens at the <em>editor</em>, in
        the moment context is assembled for the model.
      </p>

      <h2>A local-first checklist to reduce the risk</h2>
      <p>
        You cannot make this risk zero, but you can make it much smaller by
        moving the check to where the leak happens — your machine, before the
        prompt is sent.
      </p>
      <ol>
        <li>
          <strong>Scan context before you send it.</strong> Run a local secret
          and PII scan on the file, selection, or workspace you are about to
          share. Catching a token before the request is the whole game.
        </li>
        <li>
          <strong>Redact, don&rsquo;t delete.</strong> Replace detected secrets
          with placeholders in a copy of the context so the assistant still gets
          useful structure without the live value. Your real files stay
          untouched.
        </li>
        <li>
          <strong>Route prompts through a local broker.</strong> A loopback proxy
          that speaks the OpenAI/Anthropic format can redact requests in transit,
          covering tools that call the provider directly. See{" "}
          <Link href="/local-ai-broker">the Local AI Broker</Link>.
        </li>
        <li>
          <strong>Keep an access ledger.</strong> Record what context was shared
          per session so you can review exposure after a heavy AI-assisted change.
          This is what the{" "}
          <Link href="/ai-memory-inspector">AI Memory Inspector</Link> does.
        </li>
        <li>
          <strong>Test with canaries.</strong> Plant an obviously fake secret,
          then verify it never appears in prompts, logs, or model output. If your
          canary leaks, your real secrets would too.
        </li>
        <li>
          <strong>Prefer <code>.env.example</code> in context.</strong> Generate a
          safe example file with keys but no values, and keep the real{" "}
          <code>.env</code> out of scope.
        </li>
      </ol>

      <h2>What &ldquo;good&rdquo; looks like</h2>
      <p>
        A healthy setup treats the boundary between your editor and the model as
        a checkpoint. Before context crosses it, secrets and PII are scanned and
        redacted locally; risky terminal commands are flagged; and every crossing
        is recorded so you can audit it later. This is the idea behind an{" "}
        <Link href="/blog/what-is-ai-context-firewall">AI context firewall</Link>,
        which the next post explains in depth.
      </p>

      <h2>Honest limitations</h2>
      <p>
        Local scanning is heuristic. It catches common key and token formats and
        many PII patterns, but it cannot guarantee that every secret in every
        custom format is detected, and it only protects context that is actually
        routed through it. Treat it as a strong reduction in risk and one layer
        of defense-in-depth — not a guarantee. We do not claim any tool can make
        secret leakage impossible. For the full boundary list, see{" "}
        <Link href="/limitations">our limitations page</Link>.
      </p>

      <p>
        The practical takeaway: the cheapest place to stop a secret from reaching
        an AI model is on your own machine, one moment before the prompt is sent.
        That is exactly where{" "}
        <Link href="/ai-data-leakage-prevention">
          AI data leakage prevention
        </Link>{" "}
        belongs.
      </p>
    </BlogArticle>
  );
}
