import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { getPost } from "@/lib/blog/posts";

const post = getPost("ai-security-best-practices-indian-enterprises-2026")!;

export const metadata: Metadata = buildMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
  isArticle: true,
  datePublished: post.datePublished,
  keywords: ["ai security india", "enterprise ai security", "aadhaar pii compliance", "indian ai regulation", "llm security india", "ai agent security india"],
});

const faqs = [
  {
    q: "What AI security regulations apply to Indian enterprises?",
    a: "Indian enterprises must comply with the Digital Personal Data Protection Act (DPDPA) 2023, sectoral regulations from RBI, IRDAI, and SEBI, and guidelines from MeitY on AI governance. SoterAI helps with PII detection for Aadhaar, PAN, GSTIN, and other India-specific identifiers.",
  },
  {
    q: "Do I need a separate security layer if I use GPT-4 or Claude?",
    a: "Yes. API-level protections like OpenAI's content filter or Azure AI Content Safety are useful but not sufficient. They do not catch India-specific PII, indirect prompt injection through RAG documents, agent tool abuse, or data exfiltration. A dedicated guard layer fills these gaps.",
  },
  {
    q: "Can SoterAI detect Aadhaar and PAN numbers?",
    a: "Yes. SoterAI has India-specific PII detectors for Aadhaar-like patterns, PAN, GSTIN, UPI IDs, IFSC codes, and Indian mobile numbers. Detection runs in real time on both input and output. See our PII detection guide for details.",
  },
];

export default function Page() {
  return (
    <BlogArticle meta={post} faqs={faqs}>
      <p>
        Indian enterprises are adopting AI at an accelerating pace — chatbots for customer service, RAG pipelines for internal knowledge bases, and autonomous agents for workflow automation. But with this adoption comes a new attack surface that traditional security tools were not built to handle.
      </p>
      <p>
        This guide covers the AI security practices every Indian enterprise should implement in 2026, with specific attention to India's regulatory landscape and data protection requirements.
      </p>

      <h2>1. Map your AI attack surface</h2>
      <p>
        Before you can secure your AI systems, you need to know where the risks live. For most Indian enterprises, the AI attack surface includes:
      </p>
      <ul>
        <li><strong>Customer-facing chatbots</strong> — vulnerable to prompt injection, jailbreaks, and data leakage</li>
        <li><strong>Internal RAG applications</strong> — risk of document poisoning and sensitive data exposure through retrieval</li>
        <li><strong>AI coding assistants</strong> — secrets and PII in IDE context being sent to cloud models</li>
        <li><strong>Autonomous agents</strong> — tool abuse, MCP permission exploits, and unintended actions</li>
        <li><strong>API integrations</strong> — LLM API keys, vector database access, and webhook security</li>
      </ul>

      <h2>2. Implement India-specific PII detection</h2>
      <p>
        Indian enterprises process unique identifiers that global PII detectors often miss. The Digital Personal Data Protection Act 2023 requires stringent handling of personal data, and sectoral regulators have their own requirements:
      </p>
      <ul>
        <li><strong>Aadhaar-like patterns</strong> — 12-digit numbers that require special handling under Aadhaar Act</li>
        <li><strong>PAN</strong> — Permanent Account Number, essential for financial compliance</li>
        <li><strong>GSTIN</strong> — Goods and Services Tax Identification Number</li>
        <li><strong>UPI IDs and IFSC codes</strong> — financial identifiers common in Indian transactions</li>
        <li><strong>Indian mobile numbers</strong> — 10-digit numbers often used as authentication factors</li>
      </ul>
      <p>
        Deploy an AI guard that can detect and redact these identifiers before they reach an AI model or appear in model outputs.
      </p>

      <h2>3. Protect against prompt injection</h2>
      <p>
        Prompt injection is the OWASP LLM Top 10's number one risk. In an Indian enterprise context, the consequences are severe: a customer service chatbot tricked into revealing internal policies, a financial advisor agent manipulated into authorizing transactions, or an internal knowledge base leaking confidential data.
      </p>
      <p>
        Use an <Link href="/prompt-injection-protection">input guard</Link> that detects:
      </p>
      <ul>
        <li>Direct instruction overrides ("ignore previous instructions")</li>
        <li>Jailbreak personas (DAN, character-playing attacks)</li>
        <li>Encoding and obfuscation (Base64, Unicode, ROT13)</li>
        <li>Multilingual injection attempts (Hindi/English mixing)</li>
        <li>Indirect injection through retrieved documents or tool outputs</li>
      </ul>

      <h2>4. Secure your RAG pipelines</h2>
      <p>
        Retrieval-Augmented Generation (RAG) is popular among Indian enterprises for building internal knowledge assistants. But RAG introduces unique security risks:
      </p>
      <ul>
        <li><strong>Document poisoning</strong> — an attacker uploads documents containing hidden instructions</li>
        <li><strong>Data leakage</strong> — retrieved documents may contain sensitive information not intended for the user</li>
        <li><strong>Inconsistent access control</strong> — the retriever may surface documents the user should not see</li>
      </ul>

      <h2>5. Deploy an agent firewall</h2>
      <p>
        As Indian enterprises move from chatbots to autonomous agents, the security model must evolve. An <Link href="/mcp-security">agent firewall</Link> provides:
      </p>
      <ul>
        <li>Tool-level permission enforcement</li>
        <li>MCP config scanning for over-broad permissions</li>
        <li>Runtime behavior monitoring for anomalous actions</li>
        <li>Session-level audit trails for compliance</li>
      </ul>

      <h2>6. Monitor and audit AI interactions</h2>
      <p>
        Indian regulators increasingly expect audit trails for AI decision-making. Implement logging and monitoring that captures:
      </p>
      <ul>
        <li>Every input sent to an AI model and every output returned</li>
        <li>Guard decisions (blocked, flagged, allowed) with reasons</li>
        <li>PII detection and redaction events</li>
        <li>Agent tool calls and their outcomes</li>
      </ul>
      <p>
        For details, explore our <Link href="/docs">integration documentation</Link>.
      </p>
    </BlogArticle>
  );
}
