"use client";
import { useRouter } from "next/navigation";
export function DocumentReviewButtons({ documentId, status }: { documentId: string; status: string }) {
  const router = useRouter();
  async function act(action: "APPROVE" | "REJECT" | "INDEX") { await fetch("/api/rag/documents/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ documentId, action }) }); router.refresh(); }
  return <div className="flex gap-2">{status !== "APPROVED" && status !== "INDEXED" && <button onClick={() => act("APPROVE")} className="button-secondary !px-2 !py-1 text-xs">Approve</button>}{status === "APPROVED" && <button onClick={() => act("INDEX")} className="button-secondary !px-2 !py-1 text-xs">Index</button>}{status !== "REJECTED" && <button onClick={() => act("REJECT")} className="text-xs text-red-300">Reject</button>}</div>;
}
