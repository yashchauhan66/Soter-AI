"use client";

import { useMemo, useState } from "react";
import { Check, Clipboard, Download, Github, Loader2, Play, ShieldAlert, Sparkles } from "lucide-react";
import type { CodeReviewResult } from "@/lib/code-security/types";
import { GITHUB_CODE_REVIEW_WORKFLOW } from "@/lib/code-security/githubWorkflow";

type Tab = "review" | "github" | "compliance";

const SAMPLE = `// AI-generated login handler — replace this sample with your code or PR diff
export async function POST(req) {
  const body = await req.json();
  const apiKey = "sk-proj-exampleSuperSecretToken123";
  const user = await db.query(\`SELECT * FROM users WHERE email = '\${body.email}'\`);
  if (user.password === body.password) {
    console.log("auth token", body.token);
    return Response.json(user);
  }
}`;

export function CodeSecurityReviewClient({ projectId }: { projectId: string }) {
  const [tab, setTab] = useState<Tab>("review");
  const [code, setCode] = useState(SAMPLE);
  const [filename, setFilename] = useState("app/api/login/route.ts");
  const [environment, setEnvironment] = useState<"development" | "staging" | "production">("production");
  const [internetExposed, setInternetExposed] = useState(true);
  const [handlesSensitiveData, setHandlesSensitiveData] = useState(true);
  const [containsAuthCode, setContainsAuthCode] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(true);
  const [result, setResult] = useState<CodeReviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const reportMarkdown = useMemo(() => result ? buildReport(result) : "", [result]);

  async function runReview() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/code-security/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          code,
          filename,
          context: { environment, internetExposed, handlesSensitiveData, containsAuthCode, aiGenerated },
        }),
      });
      const payload = await response.json() as CodeReviewResult & { message?: string };
      if (!response.ok) throw new Error(payload.message || "Review failed.");
      setResult(payload);
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : "Review failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyWorkflow() {
    await navigator.clipboard.writeText(GITHUB_CODE_REVIEW_WORKFLOW);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReport() {
    if (!result) return;
    const blob = new Blob([reportMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `soterai-code-review-${result.reviewId}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Code security tools">
        <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={<ShieldAlert size={16} />} label="Security review" />
        <TabButton active={tab === "github"} onClick={() => setTab("github")} icon={<Github size={16} />} label="GitHub workflow" />
        <TabButton active={tab === "compliance"} onClick={() => setTab("compliance")} icon={<Download size={16} />} label="Compliance report" />
      </div>

      {tab === "review" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-5 py-4">
              <div><h2 className="font-semibold">Code or unified diff</h2><p className="mt-1 text-xs text-slate-500">Max 24 KB · raw code is not stored</p></div>
              <input className="input max-w-xs py-2 font-mono text-xs" value={filename} onChange={(event) => setFilename(event.target.value)} aria-label="Filename" />
            </div>
            <textarea
              className="min-h-[430px] w-full resize-y bg-slate-950/70 p-5 font-mono text-xs leading-6 text-slate-200 outline-none"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              spellCheck={false}
              aria-label="Code to review"
            />
            <div className="grid gap-3 border-t border-slate-800 p-5 sm:grid-cols-2">
              <label className="text-xs text-slate-400">Environment<select className="input mt-1 py-2 text-sm" value={environment} onChange={(event) => setEnvironment(event.target.value as typeof environment)}><option value="development">Development</option><option value="staging">Staging</option><option value="production">Production</option></select></label>
              <div className="grid grid-cols-2 gap-2">
                <ContextToggle checked={internetExposed} onChange={setInternetExposed} label="Internet exposed" />
                <ContextToggle checked={handlesSensitiveData} onChange={setHandlesSensitiveData} label="Sensitive data" />
                <ContextToggle checked={containsAuthCode} onChange={setContainsAuthCode} label="Auth code" />
                <ContextToggle checked={aiGenerated} onChange={setAiGenerated} label="AI generated" />
              </div>
              <button className="button-primary gap-2 sm:col-span-2" onClick={runReview} disabled={loading || !code.trim()}>
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Play size={17} />} {loading ? "Reviewing…" : "Run security review"}
              </button>
              {error && <p className="text-sm text-rose-300 sm:col-span-2" role="alert">{error}</p>}
            </div>
          </section>

          <ReviewResults result={result} />
        </div>
      )}

      {tab === "github" && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 p-5">
            <div><h2 className="flex items-center gap-2 text-lg font-semibold"><Github size={20} /> Pull-request security gate</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">Save as <code>.github/workflows/soterai-code-security.yml</code>. Add <code>SOTERAI_API_KEY</code> as a repository secret and <code>SOTERAI_API_URL</code> as a repository variable.</p></div>
            <button className="button-secondary gap-2 py-2 text-sm" onClick={copyWorkflow}>{copied ? <Check size={16} /> : <Clipboard size={16} />}{copied ? "Copied" : "Copy workflow"}</button>
          </div>
          <pre className="max-h-[620px] overflow-auto bg-slate-950/80 p-5 text-xs leading-6 text-slate-300"><code>{GITHUB_CODE_REVIEW_WORKFLOW}</code></pre>
          <div className="border-t border-slate-800 p-5 text-sm text-slate-400">The check reviews added/modified lines, annotates findings in the job log, and fails when critical findings or multiple high-severity findings are detected.</div>
        </section>
      )}

      {tab === "compliance" && (
        <section className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-lg font-semibold">Secure development evidence report</h2><p className="mt-2 text-sm text-slate-400">A portable Markdown report mapping review evidence to OWASP, SOC 2, ISO 27001, and NIST SSDF controls.</p></div>
            <button className="button-primary gap-2 py-2 text-sm" onClick={downloadReport} disabled={!result}><Download size={16} /> Download report</button>
          </div>
          {!result ? <div className="mt-5 rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">Run a security review first to generate control evidence.</div> : (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {result.compliance.map((item) => <article className="rounded-xl border border-slate-800 bg-slate-950/40 p-4" key={item.framework}><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{item.framework}</h3><span className={item.status === "PASS" ? "text-emerald-300" : "text-amber-300"}>{item.status}</span></div><p className="mt-2 text-sm text-slate-400">{item.note}</p><p className="mt-3 text-xs text-slate-500">{item.controls.join(" · ")}</p></article>)}
              <p className="text-xs text-slate-500 lg:col-span-2">{result.disclaimer}</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function ReviewResults({ result }: { result: CodeReviewResult | null }) {
  if (!result) return <section className="card flex min-h-[540px] items-center justify-center p-8 text-center"><div><Sparkles className="mx-auto text-cyan" size={28} /><h2 className="mt-4 font-semibold">Security findings will appear here</h2><p className="mt-2 max-w-sm text-sm text-slate-500">The review combines source patterns with deployment, data, auth, and AI-generation context.</p></div></section>;
  const tone = result.decision === "PASS" ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200" : result.decision === "FAIL" ? "border-rose-500/30 bg-rose-500/5 text-rose-200" : "border-amber-500/30 bg-amber-500/5 text-amber-200";
  return <section className="space-y-4">
    <div className={`rounded-xl border p-5 ${tone}`}><div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider">{result.decision}</p><p className="mt-2 text-2xl font-bold">Risk score {result.riskScore}/100</p></div><p className="text-right text-xs opacity-70">{result.metadata.linesReviewed} lines<br />{result.metadata.language}</p></div><p className="mt-3 text-sm opacity-85">{result.summary}</p></div>
    <div className="grid grid-cols-4 gap-2">{(["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const).map((severity) => <div className="card p-3 text-center" key={severity}><p className="text-xl font-bold">{result.counts[severity]}</p><p className="mt-1 text-[10px] text-slate-500">{severity}</p></div>)}</div>
    <div className="space-y-3">{result.findings.map((finding) => <article className="card p-4" key={finding.id}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-cyan">{finding.ruleId} · {finding.category}</p><h3 className="mt-1 font-semibold">{finding.title}</h3></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${severityClass(finding.severity)}`}>{finding.severity}</span></div><p className="mt-2 text-sm text-slate-400">{finding.description}</p><pre className="mt-3 overflow-auto rounded-lg bg-slate-950/70 p-3 text-xs text-slate-300">Line {finding.line}: {finding.evidence}</pre><div className="mt-3 rounded-lg border border-cyan/10 bg-cyan/5 p-3 text-sm text-slate-300"><strong className="text-cyan">Fix:</strong> {finding.remediation}</div><p className="mt-3 text-[11px] text-slate-500">{finding.standards.join(" · ")}</p></article>)}{result.findings.length === 0 && <div className="card p-6 text-center text-sm text-emerald-300">No high-confidence findings detected. Continue with dependency scanning, tests, and human review.</div>}</div>
  </section>;
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) { return <button role="tab" aria-selected={active} onClick={onClick} className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${active ? "border-cyan/40 bg-cyan/10 text-cyan" : "border-slate-800 bg-slate-900/50 text-slate-400 hover:text-white"}`}>{icon}{label}</button>; }
function ContextToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) { return <label className={`flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-xs ${checked ? "border-cyan/30 bg-cyan/5 text-cyan" : "border-slate-800 text-slate-500"}`}><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="accent-cyan-400" />{label}</label>; }
function severityClass(severity: string) { return severity === "CRITICAL" ? "bg-rose-500/20 text-rose-300" : severity === "HIGH" ? "bg-orange-500/20 text-orange-300" : severity === "MEDIUM" ? "bg-amber-500/20 text-amber-300" : "bg-slate-700 text-slate-300"; }

function buildReport(result: CodeReviewResult) {
  const findings = result.findings.length ? result.findings.map((finding) => `## ${finding.severity}: ${finding.title}\n\n- Rule: ${finding.ruleId}\n- Category: ${finding.category}\n- Line: ${finding.line}\n- Evidence: \`${finding.evidence.replaceAll("`", "'")}\`\n- Standards: ${finding.standards.join(", ")}\n\n${finding.description}\n\n**Remediation:** ${finding.remediation}`).join("\n\n") : "## Findings\n\nNo high-confidence findings were detected.";
  const controls = result.compliance.map((item) => `- **${item.framework} — ${item.status}:** ${item.controls.join(", ")}. ${item.note}`).join("\n");
  return `# SoterAI AI Code Security Review\n\n- Review: ${result.reviewId}\n- Generated: ${result.generatedAt}\n- File: ${result.metadata.filename}\n- Decision: **${result.decision}**\n- Risk score: **${result.riskScore}/100**\n- Lines reviewed: ${result.metadata.linesReviewed}\n- Raw content stored: No\n\n${result.summary}\n\n# Control mapping\n\n${controls}\n\n# Findings\n\n${findings}\n\n---\n\n${result.disclaimer}\n`;
}
