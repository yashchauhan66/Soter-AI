import Link from "next/link";

const capabilities = ["Tenant isolation and RBAC", "SSO, SCIM, and audit trails", "RAG and agent security reviews", "Webhooks, SIEM export, and evidence reports"];

export default function EnterpriseMarketingPage() {
  return (
    <main>
      <section className="container-page py-16">
        <p className="eyebrow">Enterprise</p>
        <h1 className="mt-2 text-4xl font-bold">Operational controls for high-stakes AI applications</h1>
        <p className="mt-5 max-w-3xl text-slate-300">Run a scoped SoterAI pilot for chatbots, RAG applications, and agents that need defense-in-depth controls, tenant isolation, and reviewable evidence.</p>
        <div className="mt-8 flex flex-wrap gap-3"><Link className="button-primary" href="/enterprise/pilot">Request pilot</Link><Link className="button-secondary" href="/trust">Review trust center</Link></div>
        <div className="mt-12 grid gap-4 md:grid-cols-2">{capabilities.map((item) => <div className="border-b border-slate-800 py-4 font-medium" key={item}>{item}</div>)}</div>
      </section>
      <section className="border-y border-slate-800 py-12">
        <div className="container-page"><h2 className="text-2xl font-bold">Honest scope</h2><p className="mt-3 max-w-3xl text-slate-400">SoterAI supports OWASP LLM Top 10 aligned risk reduction. It does not replace secure application design, access controls, human review, model governance, or incident response.</p></div>
      </section>
    </main>
  );
}