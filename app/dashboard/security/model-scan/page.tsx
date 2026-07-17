import Link from "next/link";
import { ShieldCheck, ShieldX, ShieldAlert, FileSearch } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { ModelScanUploader } from "@/components/dashboard/ModelScanUploader";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { recentModelScans, modelScanStats } from "@/lib/model-scan/store";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Model Scanner | SoterAI",
};

export default async function ModelScanPage() {
  const active = await getActiveOrganization();
  if (!active) return <p className="p-6 text-slate-400">No active organization.</p>;

  const project = await db.project.findFirst({
    where: { organizationId: active.org.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  const [scans, stats] = await Promise.all([
    recentModelScans(active.org.id, 20).catch(() => []),
    modelScanStats(active.org.id).catch(() => ({ total: 0, malicious: 0, suspicious: 0, safe: 0, unverified: 0 })),
  ]);

  const cards = [
    { label: "Scanned", value: stats.total, color: "text-slate-200", Icon: FileSearch },
    { label: "Malicious", value: stats.malicious, color: "text-red-400", Icon: ShieldX },
    { label: "Suspicious", value: stats.suspicious, color: "text-amber-400", Icon: ShieldAlert },
    { label: "Safe", value: stats.safe, color: "text-lime-400", Icon: ShieldCheck },
  ];

  return (
    <div>
      <FeatureGuide
        eyebrow="Model supply chain"
        title="Model artifact scanner"
        description="Scan model files for malicious serialization (pickle code execution), unsafe formats, integrity mismatches, and weak provenance — before they ever reach load(). Pure static analysis; nothing is executed."
        useCase="Downloaded model weights are executable payloads in disguise. Formats like Python pickle run arbitrary code the moment you call load(), so a model pulled from a hub or shared by a third party can compromise the machine that loads it. This scanner inspects the artifact statically — parsing structure, opcodes, and metadata — to flag code-execution risk, unsafe formats, integrity mismatches, and weak provenance before the file is ever deserialized."
        howItWorks={[
          { heading: "Upload the artifact", body: "Submit a model file. The scanner reads its bytes and structure statically — the file is never deserialized or executed, so a malicious artifact cannot run during the scan." },
          { heading: "Detect dangerous serialization", body: "Pickle and similar formats are inspected for code-execution opcodes and reduce hooks; unsafe formats are flagged in favor of safer alternatives like safetensors." },
          { heading: "Check integrity and provenance", body: "The scanner checks for hash and integrity mismatches and weak or missing provenance signals that suggest the artifact was tampered with or came from an untrusted source." },
          { heading: "Verdict and history", body: "Each scan returns a verdict — malicious, suspicious, safe, or unverified — with a risk score, and recent scans are recorded so you can track what has been vetted." },
        ]}
        callout="This is static analysis of the artifact only. A safe verdict means no known malicious markers were found in the file, not a guarantee the model is benign or that its behavior at inference is safe. Combine with provenance controls and a trusted registry."
      />

      <div className="mt-7 grid gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <section className="card p-5" key={c.label}>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <c.Icon size={16} className={c.color} /> {c.label}
            </div>
            <p className={`mt-2 text-2xl font-bold ${c.color}`}>{c.value}</p>
          </section>
        ))}
      </div>

      <section className="mt-7">
        <ModelScanUploader projectId={project?.id ?? null} />
      </section>

      {scans.length > 0 && (
        <section className="card mt-7 p-5">
          <h2 className="text-lg font-semibold">Recent scans</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-slate-400">
                  <th className="py-2 pr-3 font-medium">File</th>
                  <th className="py-2 pr-3 font-medium">Format</th>
                  <th className="py-2 pr-3 font-medium">Verdict</th>
                  <th className="py-2 pr-3 font-medium">Risk</th>
                  <th className="py-2 pr-3 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id} className="border-b border-slate-800/50">
                    <td className="py-2 pr-3 font-medium text-slate-200">{s.filename}</td>
                    <td className="py-2 pr-3 text-slate-400">{s.format}</td>
                    <td className="py-2 pr-3">
                      <span className={
                        s.verdict === "MALICIOUS" ? "text-red-400" :
                        s.verdict === "SUSPICIOUS" ? "text-amber-400" :
                        s.verdict === "SAFE" ? "text-lime-400" : "text-slate-400"
                      }>{s.verdict}</span>
                    </td>
                    <td className="py-2 pr-3 text-slate-300">{s.riskScore}</td>
                    <td className="py-2 pr-3 text-slate-500">{new Date(s.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Looking for the full AI Bill of Materials?{" "}
        <Link href="/dashboard/security/supply-chain" className="text-cyan underline underline-offset-2">Supply chain inventory →</Link>
      </p>
    </div>
  );
}
