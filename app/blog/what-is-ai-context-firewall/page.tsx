import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { getPost } from "@/lib/blog/posts";

const post = getPost("what-is-ai-context-firewall")!;

export const metadata: Metadata = buildMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
  isArticle: true,
  datePublished: post.datePublished,
  keywords: ["ai context firewall", "ai firewall", "prompt injection", "llm security architecture"],
});

const faqs = [
  {
    q: "Is an AI context firewall the same as a WAF?",
    a: "No. A web application firewall inspects HTTP traffic to a web server. An AI context firewall inspects the context assembled for a language model — files, selections, tool results, and prompts — and the model's output. The threat model is different: instruction injection and data exfiltration through natural language, not SQL injection or path traversal.",
  },
  {
    q: "Does it run in the cloud or locally?",
    a: "It can be either. For AI coding tools, a local-first design is strongest because the sensitive context lives on the developer's machine. SoterAI IDE Guard runs its scanning locally by default and only escalates to the cloud if you explicitly opt in.",
  },
  {
    q: "Can a context firewall stop all prompt injection?",
    a: "No, and any tool that claims otherwise is overselling. Detection is heuristic and pattern-based. A context firewall raises the cost of an attack and catches known techniques, but novel or heavily obfuscated injections can still get through, which is why it is one layer among several.",
  },
];

export default function Page() {
  return (
    <BlogArticle meta={post} faqs={faqs}>
      <p>
        Every security model starts with a boundary. Firewalls draw one around a
        network; web application firewalls draw one around an HTTP server. As AI
        assistants move into the center of how developers write code, a new
        boundary matters: the line between your data and the language model that
        reads it. An <strong>AI context firewall</strong> is the checkpoint on
        that line.
      </p>
      <p>
        This guide explains the pattern for developers: what it inspects, where
        it sits, how it differs from traditional firewalls and DLP, and — just as
        importantly — what it cannot do.
      </p>

      <h2>The context is the attack surface</h2>
      <p>
        A language model has no memory of your intentions and no concept of
        trust boundaries. It receives a blob of text — the &ldquo;context&rdquo;
        — and produces a continuation. That context is assembled from many
        sources: your prompt, open files, selections, retrieved documents,
        previous messages, and tool results. Two distinct risks live there:
      </p>
      <ul>
        <li>
          <strong>Outbound:</strong> sensitive data (secrets, PII, proprietary
          code) leaves your machine because it was swept into the context. See{" "}
          <Link href="/blog/how-ai-coding-tools-leak-secrets">
            how AI coding tools leak secrets
          </Link>
          .
        </li>
        <li>
          <strong>Inbound:</strong> malicious instructions hidden inside that
          context hijack the model — the family of attacks known as{" "}
          <Link href="/prompt-injection-protection">prompt injection</Link>.
        </li>
      </ul>
      <p>
        A context firewall is the component that inspects this flow in both
        directions before the model acts on it and before its output is trusted.
      </p>

      <h2>What an AI context firewall inspects</h2>
      <h3>Inbound context (before the model reads it)</h3>
      <ul>
        <li>
          <strong>Secrets and PII</strong> — API keys, tokens, connection
          strings, and personal data that should be redacted, not shared.
        </li>
        <li>
          <strong>Injected instructions</strong> — text like &ldquo;ignore
          previous instructions&rdquo;, hidden directives in a README or
          dependency, and zero-width or combining-character smuggling designed to
          slip past a human reviewer.
        </li>
        <li>
          <strong>Poisoned repository content</strong> — instructions planted in
          project files that an assistant might treat as authoritative.
        </li>
      </ul>
      <h3>Outbound output (before you or a tool acts on it)</h3>
      <ul>
        <li>
          <strong>Leaked instructions</strong> — signs the model echoed system
          prompts or protected context.
        </li>
        <li>
          <strong>Suspicious links and actions</strong> — output steering you
          toward exfiltration endpoints or dangerous commands.
        </li>
        <li>
          <strong>Data echo</strong> — comparing output against the protected
          context it was given to catch unexpected reproduction of sensitive
          values.
        </li>
      </ul>

      <h2>Where it sits</h2>
      <p>
        The firewall has to sit <em>between</em> your data and the model. For AI
        coding tools there are two practical placements, and a strong design uses
        both:
      </p>
      <ol>
        <li>
          <strong>In the editor.</strong> An extension inspects the file,
          selection, or workspace context you are about to share and lets you
          redact, approve, or block it. This is where intent is clearest — you
          know what you are trying to do. See{" "}
          <Link href="/vscode-ai-security">VS Code AI security</Link>.
        </li>
        <li>
          <strong>At the wire.</strong> A local proxy that speaks the model
          provider&rsquo;s API format redacts requests in transit, covering tools
          that call the provider directly and bypass the editor UI. See{" "}
          <Link href="/local-ai-broker">the Local AI Broker</Link>.
        </li>
      </ol>
      <p>
        Placing the firewall locally is what makes it credible for developers:
        the sensitive context never has to leave the machine to be inspected.
      </p>

      <h2>How it differs from a traditional firewall or DLP</h2>
      <p>
        The name is an analogy, not an equivalence. The differences matter:
      </p>
      <ul>
        <li>
          <strong>Unit of inspection.</strong> A network firewall reasons about
          packets and ports; a context firewall reasons about natural-language
          content and its meaning.
        </li>
        <li>
          <strong>Threat model.</strong> The dangerous input is not a malformed
          request — it is a perfectly well-formed sentence that happens to be an
          instruction to the model.
        </li>
        <li>
          <strong>Bidirectionality.</strong> Classic DLP focuses on outbound data
          loss. A context firewall must also inspect inbound instructions, since
          prompt injection is an input-side attack.
        </li>
        <li>
          <strong>Statefulness.</strong> Useful implementations keep a local
          record — an access ledger — of what context the model saw, so exposure
          can be audited after the fact. See{" "}
          <Link href="/ai-memory-inspector">the AI Memory Inspector</Link>.
        </li>
      </ul>

      <h2>A minimal mental model</h2>
      <pre><code>{`         you / your files
                |
                v
     [ AI context firewall ]
       - scan secrets & PII      (outbound)
       - redact before sending   (outbound)
       - detect injected text    (inbound)
       - record what was shared  (audit)
                |
                v
        AI model / provider
                |
                v
     [ AI context firewall ]
       - inspect output for leaks & steering
                |
                v
          you act on it`}</code></pre>

      <h2>What it does not do</h2>
      <p>
        Being precise about limits is part of trusting a security control:
      </p>
      <ul>
        <li>
          It does not make the model itself &ldquo;safe.&rdquo; It governs what
          reaches the model and what you trust back, not the model&rsquo;s
          internal behavior.
        </li>
        <li>
          It only inspects context that is actually routed through it. Channels
          it cannot see are out of scope.
        </li>
        <li>
          Detection is heuristic. It reduces the probability of leakage and
          injection; it does not eliminate them. No honest tool claims 100%
          coverage — see <Link href="/limitations">our limitations</Link>.
        </li>
      </ul>

      <p>
        Used with that clarity, an AI context firewall is a practical, layered
        control for the newest attack surface in software development: the text
        we hand to models. If you want to see one running locally in your editor,{" "}
        <Link href="/vscode-ai-security">start with the VS Code extension</Link>.
      </p>
    </BlogArticle>
  );
}
