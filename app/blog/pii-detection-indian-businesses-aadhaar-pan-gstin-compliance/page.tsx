import Link from "next/link";
import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo/metadata";
import { BlogArticle } from "@/components/marketing/BlogArticle";
import { getPost } from "@/lib/blog/posts";

const post = getPost("pii-detection-indian-businesses-aadhaar-pan-gstin-compliance")!;

export const metadata: Metadata = buildMetadata({
  title: post.title,
  description: post.description,
  path: `/blog/${post.slug}`,
  isArticle: true,
  datePublished: post.datePublished,
  keywords: ["pii detection india", "aadhaar data protection", "pan card detection", "gstin detection", "indian compliance ai", "dpdpa compliance", "india pii redaction"],
});

const faqs = [
  {
    q: "Is Aadhaar number detection mandatory for AI applications in India?",
    a: "Under the Aadhaar Act and DPDPA 2023, processing Aadhaar numbers requires explicit consent and strict access controls. If your AI application processes user inputs or documents that may contain Aadhaar numbers, detection and redaction is a practical necessity for compliance.",
  },
  {
    q: "Can global PII detectors handle Indian identifiers?",
    a: "Generally no. Most global PII detectors are trained on US/EU data and miss India-specific patterns like Aadhaar (12-digit with checksum), PAN (10-character alphanumeric), GSTIN (15-character), and UPI handles. India-specific detectors are necessary.",
  },
  {
    q: "Does SoterAI redact PII or just detect it?",
    a: "Both. SoterAI can detect and redact India-specific PII in real time. Redaction replaces sensitive values with masked alternatives (e.g., XXXX-XXXX-XXXX) before they reach the AI model or appear in responses. Detection mode is also available for audit-only workflows.",
  },
];

export default function Page() {
  return (
    <BlogArticle meta={post} faqs={faqs}>
      <p>
        Indian businesses processing personally identifiable information (PII) through AI applications face a unique challenge: global PII detectors do not recognize India-specific identifiers. An Aadhaar number, PAN card, or GSTIN passes through standard content filters unnoticed, creating compliance and data protection risks.
      </p>
      <p>
        This guide covers India-specific PII types, regulatory requirements, and how to implement detection and redaction for AI applications serving Indian users.
      </p>

      <h2>India-specific PII types your AI must handle</h2>

      <h3>Aadhaar (12-digit identifier)</h3>
      <p>
        Aadhaar numbers follow a 12-digit pattern with a Verhoeff checksum. They appear in customer support conversations, document uploads, and KYC verification flows. Under the Aadhaar Act, storing or processing Aadhaar numbers without proper safeguards can result in penalties.
      </p>

      <h3>PAN (Permanent Account Number)</h3>
      <p>
        PAN is a 10-character alphanumeric identifier (format: AAAAA9999A). It is widely shared in financial transactions, invoice processing, and employee records. PAN is sensitive financial data under income tax regulations.
      </p>

      <h3>GSTIN (Goods and Services Tax Identification Number)</h3>
      <p>
        GSTIN is a 15-character alphanumeric identifier based on PAN. It appears in B2B invoices, vendor management systems, and compliance workflows. Disclosure of GSTIN can reveal business relationships and transaction patterns.
      </p>

      <h3>UPI IDs and handles</h3>
      <p>
        UPI handles (e.g., user@bank) are widely used for payments in India. They appear in transaction histories, payment requests, and customer communications. UPI IDs can be linked to bank accounts and mobile numbers.
      </p>

      <h3>Indian mobile numbers</h3>
      <p>
        10-digit mobile numbers are a primary authentication factor for many Indian services. They frequently appear in AI training data, customer transcripts, and support tickets.
      </p>

      <h3>IFSC codes</h3>
      <p>
        Bank branch identifiers used in domestic wire transfers. Often included in invoice processing and payment workflows handled by AI.
      </p>

      <h2>Regulatory landscape</h2>

      <h3>Digital Personal Data Protection Act (DPDPA) 2023</h3>
      <p>
        India's comprehensive data protection law requires:
      </p>
      <ul>
        <li>Consent-based processing of personal data</li>
        <li>Purpose limitation — data used only for stated purpose</li>
        <li>Data minimization — collect only what is necessary</li>
        <li>Breach notification within 72 hours</li>
        <li>Cross-border data transfer restrictions</li>
      </ul>

      <h3>Sectoral regulations</h3>
      <ul>
        <li><strong>RBI:</strong> guidelines for financial data processing and outsourcing</li>
        <li><strong>IRDAI:</strong> data protection requirements for insurance</li>
        <li><strong>SEBI:</strong> cybersecurity framework for market participants</li>
        <li><strong>MeitY:</strong> AI governance guidelines and advisory</li>
      </ul>

      <h2>Implementing India PII detection for AI</h2>

      <h3>Detection at input</h3>
      <p>
        Scan every user input before it reaches your AI model. If Aadhaar, PAN, or other India PII is detected, redact it before sending to the model. This prevents sensitive data from being processed or stored by third-party AI providers.
      </p>

      <h3>Detection at output</h3>
      <p>
        AI models can inadvertently generate or reproduce PII in their responses. An output guard checks the model's response before delivering it to the user, redacting any India-specific identifiers that appear.
      </p>

      <h3>Detection in documents</h3>
      <p>
        For RAG applications, scan uploaded documents for India PII before indexing. Flag or redact sensitive content so it is not surfaced in retrieval results.
      </p>

      <p>
        See how <Link href="/ai-data-leakage-prevention">SoterAI detects and redacts India PII</Link> across inputs, outputs, and documents with real-time performance.
      </p>
    </BlogArticle>
  );
}
