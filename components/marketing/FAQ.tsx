const faqs = [
  ["What is SoterAI?", "SoterAI is an AI security command layer that protects chatbots, RAG apps, and autonomous agents from prompt injection, jailbreaks, data leakage, unsafe outputs, and agent abuse. It sits between users, models, and tools to inspect every AI interaction in real time."],
  ["Does SoterAI guarantee complete security?", "No. SoterAI is a defense-in-depth risk reduction layer. It should be combined with secure application design, identity controls, monitoring, and human review."],
  ["What does SoterAI protect?", "SoterAI inspects AI inputs and outputs for prompt injection, jailbreaks, sensitive data, unsafe responses, and risky agent behavior across chatbots, RAG pipelines, and autonomous agents."],
  ["How does SoterAI detect prompt injection and jailbreak attacks?", "SoterAI uses a multi-layer detection engine that analyzes user inputs for instruction overrides, jailbreak personas (like DAN), prompt extraction attempts, encoding obfuscation, multilingual attacks, and indirect injection through retrieved documents."],
  ["Is SoterAI free to use?", "Yes. SoterAI offers a Free plan at INR 0/month to validate a small AI workflow. Paid plans start at INR 999/month for production chatbot traffic with team controls, deeper reporting, and priority support."],
  ["Can I self-host SoterAI?", "Yes. The production stack runs with Docker, Postgres, Redis, and optional vector storage, so teams can keep full control of deployment and data boundaries on their own infrastructure."],
  ["Are raw secrets stored in SoterAI?", "No. Secret-bearing and sensitive payloads are persisted only in redacted or hashed form where practical. SoterAI is designed to minimize data retention of sensitive content."],
  ["Can SoterAI detect Indian PII like Aadhaar and PAN?", "Yes. SoterAI is built with India-specific PII detection including Aadhaar-like patterns, PAN, GSTIN, UPI ID, IFSC codes, Indian mobile numbers, and contextual student, patient, and bank identifiers."],
  ["How fast is SoterAI's security check?", "SoterAI performs input and output guard checks in under 50 milliseconds, making it suitable for real-time chatbot and agent interactions without noticeable latency."],
  ["How do I integrate SoterAI with my chatbot?", "Create a project, keep your API key on the server, call the input guard before your LLM, and call the output guard before returning the response to the user. SDKs are available for JavaScript, Python, Next.js, Express, and more."],
  ["What programming languages does SoterAI support?", "SoterAI provides native SDKs for JavaScript/TypeScript and Python, plus a REST API that works with any language including Java, Go, PHP, C#, Ruby, Rust, and more."],
  ["Can I use SoterAI with LangChain or RAG pipelines?", "Yes. SoterAI integrates with LangChain chains, LlamaIndex query engines, and custom RAG pipelines. It inspects retrieved context, applies document trust scoring, and prevents sensitive data from leaking into model responses."],
];

export function FAQ() {
  return (
    <section className="border-t border-slate-800 bg-slate-950/35 py-20">
      <div className="container-page">
        <p className="eyebrow">Questions</p>
        <h2 className="mt-3 text-3xl font-bold">Built for serious AI security work</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {faqs.map(([q, a]) => (
            <article className="card p-6" key={q}>
              <h3 className="font-semibold">{q}</h3>
              <p className="mt-3 leading-7 text-slate-400">{a}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}