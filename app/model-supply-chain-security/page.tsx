import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  FileSearch,
  Boxes,
  Fingerprint,
  GitBranch,
  Ban,
  CheckCircle2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Model Supply-Chain Security | SoterAI",
  description:
    "Scan model artifacts for malicious serialization (pickle code execution), verify integrity & SLSA/in-toto provenance, and generate a CycloneDX AI-BOM. Best-in-class model supply-chain security — pure static analysis, nothing executed.",
  alternates: { canonical: "/model-supply-chain-security" },
  openGraph: {
    title: "Model Supply-Chain Security | SoterAI",
    description:
      "Catch malicious models before load(): pickle RCE detection, integrity & provenance verification, and AI-BOM generation.",
  },
};

const capabilities = [
  {
    Icon: FileSearch,
    title: "Malicious model detection",
    desc: "Walks the pickle opcode stream behind PyTorch .pt/.bin, joblib, and numpy object arrays — flagging os.system, eval/exec, subprocess, and other code-execution imports via GLOBAL/STACK_GLOBAL + REDUCE.",
  },
  {
    Icon: Boxes,
    title: "Format-aware scanning",
    desc: "Unwraps PyTorch zip archives (stored + deflate), validates safetensors headers, and recognizes GGUF, ONNX, HDF5/Keras, and numpy — with the right risk model for each.",
  },
  {
    Icon: Fingerprint,
    title: "Integrity verification",
    desc: "SHA-256 every artifact, compare against an expected digest, and match against a known-good allowlist. A mismatch is treated as tampering.",
  },
  {
    Icon: GitBranch,
    title: "Provenance & attestation",
    desc: "Verifies SLSA / in-toto (DSSE) and Sigstore-style attestations — including the most-skipped check: does the attestation's subject digest actually bind THIS artifact?",
  },
  {
    Icon: Boxes,
    title: "CycloneDX AI-BOM",
    desc: "Generate a signed CycloneDX 1.6 AI Bill of Materials covering models, providers, prompts, and tools — exportable for compliance and SIEM.",
  },
  {
    Icon: ShieldCheck,
    title: "Nothing executed",
    desc: "100% static analysis in TypeScript. No Python, no model load, no sandbox escape surface. Runs inline, in CI, or offline.",
  },
];

const pipeline = [
  ["Detect format", "Magic bytes + extension → pickle, torch-zip, safetensors, gguf, onnx, h5, npy."],
  ["Extract", "Unwrap zip entries (inflate data.pkl) or locate embedded pickle regions."],
  ["Analyze", "Opcode-walk the pickle; capture every imported global; classify severity."],
  ["Verify", "SHA-256 integrity, known-good allowlist, and provenance subject-digest binding."],
  ["Verdict", "SAFE · UNVERIFIED · SUSPICIOUS · MALICIOUS with a 0–100 risk score and findings."],
];

export default function ModelSupplyChainPage() {
  return (
    <main className="py-16 sm:py-24">
      <div className="container-page">
        {/* Hero */}
        <div className="text-center">
          <p className="eyebrow">Model supply-chain security</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Catch malicious models <span className="text-cyan">before load()</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-7 text-slate-400">
            A single <code className="text-cyan">torch.load()</code> on an untrusted file can run arbitrary code. SoterAI
            scans model artifacts for malicious serialization, verifies integrity and provenance, and produces an AI-BOM —
            with pure static analysis that never executes the model.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/signup" className="button-primary gap-2">
              Scan your models <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link href="/dashboard/security/model-scan" className="button-secondary gap-2">
              Open the scanner
            </Link>
            <Link href="/comparison/hiddenlayer" className="text-sm text-slate-400 hover:text-white">
              vs HiddenLayer
            </Link>
          </div>
        </div>

        {/* Threat framing */}
        <section className="mx-auto mt-14 max-w-3xl rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="flex items-center gap-2">
            <Ban className="text-red-300" size={20} />
            <h2 className="text-lg font-bold">The pickle problem</h2>
          </div>
          <p className="mt-3 text-sm leading-7 text-slate-400">
            Most distributed models (Huggingface <code className="text-slate-300">pytorch_model.bin</code>, checkpoints,
            joblib files) are Python pickles. Pickle is a stack VM that can import and call any function on load — the
            classic payload is <code className="text-slate-300">GLOBAL os system</code> + <code className="text-slate-300">REDUCE</code>.
            SoterAI parses that opcode stream and refuses to let it surprise you in production.
          </p>
        </section>

        {/* Capabilities */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">What it covers</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((c) => (
              <div key={c.title} className="card p-5">
                <c.Icon className="text-cyan" size={22} aria-hidden="true" />
                <h3 className="mt-3 font-semibold">{c.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-400">{c.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pipeline */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">How a scan runs</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-5">
            {pipeline.map(([title, desc], i) => (
              <div key={title} className="card p-5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan/15 text-sm font-bold text-cyan">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Formats */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold">Formats &amp; risk model</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-300">
                  <th className="px-4 py-3 font-semibold">Format</th>
                  <th className="px-4 py-3 font-semibold">Executes code on load?</th>
                  <th className="px-4 py-3 font-semibold">SoterAI scan</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["safetensors", "No", "Header validation — safest format"],
                  ["PyTorch .pt/.bin (zip)", "Yes (pickle)", "Unwrap + opcode scan"],
                  [".pkl / joblib", "Yes (pickle)", "Opcode scan"],
                  ["numpy .npy (object)", "Yes (pickle)", "Embedded pickle scan"],
                  ["HDF5 / Keras .h5", "Possible (Lambda)", "Flagged for review"],
                  ["GGUF / ONNX", "No", "Recognized data-only"],
                ].map(([fmt, exec, scan]) => (
                  <tr key={fmt} className="border-b border-slate-800/50">
                    <td className="px-4 py-3 font-medium text-slate-200">{fmt}</td>
                    <td className="px-4 py-3 text-slate-400">{exec}</td>
                    <td className="px-4 py-3 text-slate-400">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 size={14} className="text-lime" /> {scan}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* CTA */}
        <section className="mt-16">
          <div className="rounded-3xl bg-cyan p-10 text-center text-ink">
            <h2 className="text-3xl font-black">Trust no model you didn&apos;t scan.</h2>
            <p className="mx-auto mt-3 max-w-2xl text-ink/70">
              Drag a model file into the scanner, or call the API in CI before every deploy.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/dashboard/security/model-scan" className="inline-flex items-center gap-2 rounded-xl bg-ink px-6 py-3 font-semibold text-white">
                Open the scanner <ArrowRight size={18} />
              </Link>
              <Link href="/docs" className="inline-flex items-center gap-2 rounded-xl border border-ink/20 bg-ink/10 px-6 py-3 font-semibold text-ink">
                Read the docs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
