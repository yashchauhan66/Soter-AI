"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, ShieldCheck, ShieldAlert, ShieldX, FileSearch, Loader2 } from "lucide-react";

type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
type Verdict = "SAFE" | "SUSPICIOUS" | "MALICIOUS" | "UNVERIFIED";

interface Finding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  detail: string;
  location?: string;
}
interface Report {
  filename: string | null;
  format: string;
  sizeBytes: number;
  sha256: string;
  verdict: Verdict;
  riskScore: number;
  highestSeverity: Severity;
  findings: Finding[];
  imports: Array<{ module: string; name: string }>;
  scannedEntries: string[];
}

const VERDICT_STYLE: Record<Verdict, { bg: string; text: string; border: string; Icon: typeof ShieldCheck; label: string }> = {
  SAFE: { bg: "bg-lime-500/10", text: "text-lime-300", border: "border-lime-500/30", Icon: ShieldCheck, label: "Safe" },
  UNVERIFIED: { bg: "bg-slate-500/10", text: "text-slate-300", border: "border-slate-500/30", Icon: FileSearch, label: "Unverified" },
  SUSPICIOUS: { bg: "bg-amber-500/10", text: "text-amber-300", border: "border-amber-500/30", Icon: ShieldAlert, label: "Suspicious" },
  MALICIOUS: { bg: "bg-red-500/10", text: "text-red-300", border: "border-red-500/30", Icon: ShieldX, label: "Malicious" },
};

const SEV_COLOR: Record<Severity, string> = {
  LOW: "bg-slate-700 text-slate-300",
  MEDIUM: "bg-amber-500/20 text-amber-300",
  HIGH: "bg-orange-500/20 text-orange-300",
  CRITICAL: "bg-red-500/20 text-red-300",
};

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ModelScanUploader({ projectId }: { projectId: string | null }) {
  const [report, setReport] = useState<Report | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const scan = useCallback(async (file: File) => {
    if (!projectId) { setError("No project available to attribute this scan."); return; }
    setScanning(true); setError(null); setReport(null);
    try {
      const qs = new URLSearchParams({ projectId, filename: file.name });
      const res = await fetch(`/api/supply-chain/model-scan?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.message ?? "Scan failed.");
      setReport(data.report as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }, [projectId]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) scan(file);
  }, [scan]);

  const vs = report ? VERDICT_STYLE[report.verdict] : null;

  return (
    <div className="space-y-6">
      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition ${
          dragging ? "border-cyan bg-cyan/5" : "border-slate-700 hover:border-slate-500"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) scan(f); }}
        />
        {scanning ? (
          <Loader2 className="h-8 w-8 animate-spin text-cyan" />
        ) : (
          <Upload className="h-8 w-8 text-slate-400" />
        )}
        <p className="mt-3 font-semibold text-slate-200">
          {scanning ? "Scanning artifact…" : "Drop a model file or click to scan"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          .safetensors · .bin · .pt · .pth · .pkl · .ckpt · .h5 · .gguf · .onnx — up to 50MB
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div>
      )}

      {report && vs && (
        <div className={`overflow-hidden rounded-xl border ${vs.border} ${vs.bg}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/50 p-5">
            <div className="flex items-center gap-3">
              <vs.Icon className={vs.text} size={28} />
              <div>
                <p className={`text-xl font-black ${vs.text}`}>{vs.label}</p>
                <p className="text-sm text-slate-400">{report.filename} · {report.format} · {fmtBytes(report.sizeBytes)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-slate-500">Risk score</p>
              <p className={`text-3xl font-black ${report.riskScore >= 75 ? "text-red-400" : report.riskScore >= 40 ? "text-amber-400" : "text-lime-400"}`}>
                {report.riskScore}
              </p>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <p className="font-mono text-xs text-slate-500">sha256: {report.sha256}</p>
            {report.scannedEntries.length > 0 && (
              <p className="text-xs text-slate-500">Scanned entries: {report.scannedEntries.join(", ")}</p>
            )}

            {report.findings.length === 0 ? (
              <p className="text-sm text-slate-400">No findings.</p>
            ) : (
              <ul className="space-y-2">
                {report.findings.map((f) => (
                  <li key={f.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${SEV_COLOR[f.severity]}`}>{f.severity}</span>
                      <span className="text-sm font-semibold text-slate-200">{f.title}</span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{f.detail}</p>
                    {f.location && <p className="mt-0.5 font-mono text-[10px] text-slate-600">@ {f.location}</p>}
                  </li>
                ))}
              </ul>
            )}

            {report.imports.length > 0 && (
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer">Imported globals ({report.imports.length})</summary>
                <ul className="mt-2 space-y-0.5 font-mono">
                  {report.imports.map((im, i) => <li key={i}>{im.module}.{im.name}</li>)}
                </ul>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
