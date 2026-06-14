import { RagManager } from "@/components/dashboard/RagManager";
import { DocumentReviewButtons } from "@/components/dashboard/DocumentReviewButtons";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
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
  return <div><div className="flex items-end justify-between gap-4"><div><p className="eyebrow">Retrieval security</p><h1 className="mt-2 text-3xl font-bold">RAG document guard</h1></div><ProjectSwitcher projects={projects} selectedId={project.id} /></div><p className="my-5 text-slate-400">Documents are scanned, redacted, and held for approval before indexing.</p><RagManager projectId={project.id} collections={collections.map(({ id, name }) => ({ id, name }))} /><div className="mt-6 space-y-4">{collections.map((collection) => <section className="card p-5" key={collection.id}><h2 className="font-semibold">{collection.name}</h2><div className="mt-3 space-y-2">{collection.documents.map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-950/60 p-3 text-sm"><div><p>{document.fileName} <span className="text-slate-500">v{document.version}</span></p><p className="text-xs text-slate-500">{document.status} · trust {document.trustScore} · {document.riskTypes.join(", ") || "no material risks"}</p></div><DocumentReviewButtons documentId={document.id} status={document.status} /></div>)}</div></section>)}</div></div>;
}
