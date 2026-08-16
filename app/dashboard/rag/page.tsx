import { RagManager } from "@/components/dashboard/RagManager";
import { DocumentReviewButtons } from "@/components/dashboard/DocumentReviewButtons";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { FeatureGuide } from "@/components/docs/FeatureGuide";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export default async function RagPage({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([getCurrentProjectById(params.project), getCurrentUserProjects()]);
  const collections = await db.ragCollection.findMany({
    where: { projectId: project.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: {
      id: true,
      name: true,
      documents: {
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true,
          fileName: true,
          version: true,
          status: true,
          trustScore: true,
          riskTypes: true,
        },
      },
    },
  });
  return <div className="space-y-6"><FeatureGuide
    eyebrow="Retrieval security"
    title="RAG document guard"
    description="Scan documents for injected instructions and sensitive data before they enter your retrieval index. Uploads are redacted and held for approval, so poisoned or leaky content never reaches your agent."
    useCase="RAG pipelines trust whatever is in the index. A single document carrying hidden prompt-injection text or embedded secrets can hijack an agent or leak data at query time. The document guard scans every upload, assigns a trust score, flags risk types, and holds the file for human approval before it can be indexed."
    howItWorks={[
      { heading: "Upload to a collection", body: "Add documents to a RAG collection. Each upload is queued for a background scan rather than indexed immediately." },
      { heading: "Scan and score", body: "The scanner checks for prompt injection, sensitive data, and other risks, assigns a trust score, and records the risk types it found." },
      { heading: "Redact and hold", body: "Risky content is redacted and the document is held in a pending state so nothing untrusted is indexed automatically." },
      { heading: "Review and approve", body: "Approve or reject each document from this page. Only approved documents become available for retrieval." },
    ]}
    integrationCode={`// Upload a document for scanning (multipart form)
const form = new FormData();
form.append("collectionId", "your-collection-id");
form.append("file", file);

const res = await fetch("https://soterai.in/api/rag/documents", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.SOTER_API_KEY}\` },
  body: form,
});
// Returns 202 Accepted; the scan runs in the background.`}
    callout="Uploads are scanned asynchronously and start in a pending state. A document is only retrievable after it passes review and is approved here."
  /><div className="flex items-center justify-end"><ProjectSwitcher projects={projects} selectedId={project.id} /></div><RagManager projectId={project.id} collections={collections.map(({ id, name }) => ({ id, name }))} /><div className="mt-6 space-y-4">{collections.map((collection) => <section className="card p-5" key={collection.id}><h2 className="font-semibold">{collection.name}</h2><div className="mt-3 space-y-2">{collection.documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/60 p-3 text-sm"><div><p>{document.fileName} <span className="text-slate-300">v{document.version}</span></p><p className="text-xs text-slate-300">{document.status} · trust {document.trustScore} · {document.riskTypes.join(", ") || "no material risks"}</p></div><DocumentReviewButtons documentId={document.id} status={document.status} /></div>)}</div></section>)}</div></div>;
}
