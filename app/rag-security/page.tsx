import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { FeatureLanding, type FeatureLandingData } from "@/components/marketing/FeatureLanding";

export const metadata: Metadata = buildMetadata({
  title: "RAG Security — Protect Retrieval-Augmented Generation Pipelines",
  description:
    "Secure RAG applications against document poisoning, data leakage, and unauthorized retrieval. SoterAI Guard scans, quarantines, and enforces access controls on vector database content.",
  path: "/rag-security",
  keywords: [
    "rag security",
    "rag security platform",
    "retrieval augmented generation security",
    "vector database security",
    "rag poisoning prevention",
    "rag document scanning",
    "rag access control",
    "secure rag pipeline",
  ],
});

const data: FeatureLandingData = {
  path: "/rag-security",
  eyebrow: "RAG Security",
  h1: "Secure your RAG pipeline from document to response",
  productName: "SoterAI RAG Security",
  intro:
    "Retrieval-Augmented Generation (RAG) pipelines are vulnerable to document poisoning, data leakage through retrieval, and unauthorized access to sensitive content. SoterAI Guard secures every stage: scanning documents before they enter the vector database, quarantining suspicious content, enforcing access controls on retrieval, and inspecting generated responses for leaked information.",
  features: [
    {
      title: "Document scanning",
      body: "Scan documents for prompt injection, PII, and malicious content before they are indexed in your vector database.",
    },
    {
      title: "Quarantine and review",
      body: "Automatically quarantine suspicious documents for human review. Prevent poisoned content from being retrieved.",
    },
    {
      title: "Retrieval access control",
      body: "Enforce document-level access permissions. Ensure users only retrieve content they are authorized to see.",
    },
    {
      title: "Output inspection",
      body: "Inspect RAG-generated responses for leaked sensitive data, hallucinated content, and unsafe information.",
    },
    {
      title: "Audit trail",
      body: "Log every document scan, retrieval, and generation for compliance and forensic analysis.",
    },
  ],
  how: [
    {
      step: "Connect your vector database",
      body: "Integrate SoterAI Guard with Pinecone, Weaviate, Chroma, Qdrant, or any vector store via our SDK.",
    },
    {
      step: "Scan documents on ingest",
      body: "Every document is scanned for threats before indexing. Suspicious documents are quarantined.",
    },
    {
      step: "Enforce retrieval policies",
      body: "Access control policies ensure users only retrieve content they are permitted to see.",
    },
    {
      step: "Monitor and audit",
      body: "Review security events, tune policies, and export audit logs for compliance reporting.",
    },
  ],
  limitations: [
    "Document scanning is heuristic and may miss novel obfuscation techniques. Review quarantined documents manually.",
    "Access control requires documents to be tagged with permission metadata. Untagged documents may be over- or under-restricted.",
    "Output inspection cannot catch every instance of hallucinated or leaked information. Human review of sensitive outputs is recommended.",
  ],
  faqs: [
    {
      q: "What vector databases do you support?",
      a: "SoterAI Guard works with Pinecone, Weaviate, Chroma, Qdrant, Milvus, and any vector store accessible via API.",
    },
    {
      q: "Can SoterAI prevent RAG poisoning?",
      a: "Yes. Documents are scanned for prompt injection and malicious content before indexing. Suspicious documents are quarantined and never retrieved.",
    },
    {
      q: "Does it add latency to RAG queries?",
      a: "Document scanning adds latency only at ingest time. Retrieval-time access control adds under 10ms per query.",
    },
  ],
  related: [
    { label: "Prompt Injection Protection", href: "/prompt-injection-protection" },
    { label: "AI Data Leakage Prevention", href: "/ai-data-leakage-prevention" },
    { label: "LLM Security", href: "/llm-security" },
    { label: "Enterprise AI Security", href: "/enterprise-ai-security" },
    { label: "Docs: RAG", href: "/docs/rag" },
  ],
};

export default function Page() {
  return <FeatureLanding data={data} />;
}
