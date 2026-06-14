import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { getActiveOrganization, requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { projectSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const projects = await db.project.findMany({
      where: { organizationId: active.org.id },
      orderBy: { createdAt: "desc" },
    });
    return jsonResponse(projects);
  } catch (error) { return apiError(error, "Projects could not be loaded."); }
}

export async function POST(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active) return jsonResponse({ error: true, message: "No active organization." }, { status: 403 });
    await requirePermission(active.org.id, "project:create");
    const body = projectSchema.parse(await readJson(request));
    const project = await db.project.create({
      data: {
        name: body.name,
        description: body.description,
        publicName: body.publicName,
        clientId: body.clientId,
        userId: (await db.organizationMember.findFirst({ where: { organizationId: active.org.id, userId: active.membership.userId } }))!.userId,
        organizationId: active.org.id,
      },
    });
    await db.onboardingProgress.upsert({
      where: { userId: project.userId },
      create: { userId: project.userId, projectCreated: true },
      update: { projectCreated: true },
    });
    return jsonResponse(project, { status: 201 });
  } catch (error) { return apiError(error, "Project could not be created."); }
}
