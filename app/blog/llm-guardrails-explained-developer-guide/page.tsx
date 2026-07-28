import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { getPost } from "@/lib/blog/posts";

const post = getPost("llm-guardrails-explained-developer-guide")!;

export const metadata: Metadata = buildMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
  isArticle: true,
  datePublished: post.datePublished,
  keywords: ["llm guardrails", "ai guardrails", "what are llm guardrails", "ai safety controls", "guardrails ai", "llm safety", "input guard output guard"],
});

const faqs = [
  {
    q: "Do I need guardrails if I use Azure AI Content Safety or AWS Bedrock?",
    a: "Cloud-provider safety features cover basic content filtering but miss India-specific PII (Aadhaar, PAN, GSTIN), indirect prompt injection through RAG, agent tool abuse, and structured-data extraction. A dedicated guardrails layer fills these gaps and works across any model provider.",
  },
  {
    q: "Can guardrails stop 100% of harmful outputs?",
    a: "No. Guardrails reduce risk but cannot guarantee complete safety. Novel attacks, heavily obfuscated inputs, and zero-day exploitation techniques can bypass even the best guardrails. This is a defense-in-depth layer, not a silver bullet.",
  },
  {
    q: "What's the performance impact of adding guardrails?",
    a: "With a local-first design like SoterAI, guard checks complete in under 15ms (p95) for typical inputs. Performance should always be benchmarked against your specific traffic patterns, but modern guardrails are designed for real-time production use.",
  },
];

export default function Page() {
  return (
    <BlogArticle meta={post} faqs={faqs}>
      <p>
        LLM guardrails are the safety and security layer between your AI application and its users. They inspect every interaction — inputs to the model and outputs from the model — and enforce policies that prevent harmful, unsafe, or non-compliant content from flowing through.
      </p>
      <p>
        This guide explains what guardrails are, the different types, how to deploy them in production, and what they cannot do.
      </p>

      <h2>What are LLM guardrails?</h2>
      <p>
        An LLM guardrail is a software component that sits between users and AI models (and between models and tools) to inspect, filter, and enforce policies on AI interactions. Unlike model-level safety training (RLHF, constitutional AI), guardrails are:
      </p>
      <ul>
        <li><strong>Model-agnostic</strong> — they work with any LLM provider</li>
        <li><strong>Deterministic</strong> — policy violations produce consistent results</li>
        <li><strong>Observable</strong> — every decision is logged and auditable</li>
        <li><strong>Configurable</strong> — policies adapt to your use case, not a one-size-fits-all model</li>
      </ul>

      <h2>Types of guardrails</h2>

      <h3>Input guardrails</h3>
      <p>
        Inspection happens before the input reaches the model:
      </p>
      <ul>
        <li><strong>Prompt injection detection</strong> — identify instruction override attempts and jailbreaks</li>
        <li><strong>PII redaction</strong> — detect and redact sensitive data (Aadhaar, PAN, API keys, etc.)</li>
        <li><strong>Topic fencing</strong> — block off-topic or policy-violating inputs</li>
        <li><strong>Content moderation</strong> — filter hate speech, harassment, and unsafe content</li>
        <li><strong>Size limits</strong> — enforce context window boundaries</li>
      </ul>

      <h3>Output guardrails</h3>
      <p>
        Inspection happens before the model's response reaches the user:
      </p>
      <ul>
        <li><strong>Leakage detection</strong> — catch leaked system prompts, internal data, or secrets</li>
        <li><strong>Unsafe content</strong> — block harmful, misleading, or inappropriate responses</li>
        <li><strong>Hallucination detection</strong> — flag factually unsupported claims</li>
        <li><strong>Link and code safety</strong> — inspect URLs and code blocks for malicious content</li>
      </ul>

      <h3>RAG guardrails</h3>
      <p>
        For retrieval-augmented generation applications:
      </p>
      <ul>
        <li><strong>Document trust scoring</strong> — evaluate retrieved documents for injection risk</li>
        <li><strong>Sensitive data filtering</strong> — prevent sensitive documents from being retrieved</li>
        <li><strong>Context injection detection</strong> — identify poison attempts in retrieved text</li>
      </ul>

      <h3>Agent guardrails</h3>
      <p>
        For autonomous AI agents:
      </p>
      <ul>
        <li><strong>Tool permission enforcement</strong> — restrict which tools an agent can call</li>
        <li><strong>Action approval queues</strong> — require human approval for high-risk actions</li>
        <li><strong>Runtime monitoring</strong> — detect anomalous agent behavior in real time</li>
      </ul>

      <h2>Deploying guardrails in production</h2>
      <p>
        A typical production deployment places guardrails at key checkpoints:
      </p>
      <pre><code>{`User Input → [Input Guard] → LLM → [Output Guard] → User Response
                                      ↓
                                [RAG Guard] → Vector DB
                                      ↓
                              [Agent Guard] → Tools/APIs`}</code></pre>

      <h2>Guardrails are risk reduction, not elimination</h2>
      <p>
        Any vendor claiming 100% protection is misleading you. Guardrails:
      </p>
      <ul>
        <li>Raise the cost of attacks</li>
        <li>Catch known attack patterns reliably</li>
        <li>Provide audit trails for security review</li>
        <li>Reduce the blast radius when an attack succeeds</li>
      </ul>
      <p>
        But novel attacks, zero-day jailbreaks, and sophisticated obfuscation can bypass guardrails. Always combine guardrails with secure design, access controls, monitoring, and human review.
      </p>
      <p>
        For a practical implementation, see <Link href="/docs">SoterAI's integration docs</Link> or try the <Link href="/playground">interactive playground</Link>.
      </p>
    </BlogArticle>
  );
}
