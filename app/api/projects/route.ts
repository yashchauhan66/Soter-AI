import { apiError, jsonResponse, readJson } from '@/lib/apiResponse';
import { getActiveOrganization, requirePermission, requireUser } from '@/lib/auth/guards';
import { db } from '@/lib/db';
import {
  assertProjectCreationAllowed,
  ProjectCreationLimitError,
  projectCreationMonthRange,
} from '@/lib/projects/projectCreationLimit';
import { projectSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Defense-in-depth: explicit auth check in addition to middleware protection.
    await requireUser();
    const active = await getActiveOrganization();
    if (!active) return jsonResponse([]);
    const projects = await db.project.findMany({
      where: { organizationId: active.org.id },
      orderBy: { createdAt: 'desc' },
    });
    return jsonResponse(projects);
  } catch (error) {
    return apiError(error, 'Projects could not be loaded.');
  }
}

export async function POST(request: Request) {
  try {
    const active = await getActiveOrganization();
    if (!active)
      return jsonResponse({ error: true, message: 'No active organization.' }, { status: 403 });
    await requirePermission(active.org.id, 'project:create');
    const body = projectSchema.parse(await readJson(request));
    const { start, end } = projectCreationMonthRange();
    const project = await db.$transaction(async (tx) => {
      // Serialize project creation per organization so simultaneous requests
      // cannot both pass the free-plan count check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`project-create:${active.org.id}`}))`;

      const organization = await tx.organization.findUnique({
        where: { id: active.org.id },
        select: { plan: true },
      });
      if (!organization) throw new Error('Active organization no longer exists.');

      const projectsCreatedThisMonth =
        organization.plan === 'FREE'
          ? await tx.project.count({
              where: { organizationId: active.org.id, createdAt: { gte: start, lt: end } },
            })
          : 0;
      assertProjectCreationAllowed(organization.plan, projectsCreatedThisMonth);

      const created = await tx.project.create({
        data: {
          name: body.name,
          description: body.description,
          publicName: body.publicName,
          clientId: body.clientId,
          userId: active.membership.userId,
          organizationId: active.org.id,
        },
      });
      await tx.onboardingProgress.upsert({
        where: { userId: created.userId },
        create: { userId: created.userId, projectCreated: true },
        update: { projectCreated: true },
      });
      return created;
    });
    return jsonResponse(project, { status: 201 });
  } catch (error) {
    if (error instanceof ProjectCreationLimitError) {
      return jsonResponse(
        { error: true, code: error.code, message: error.message, upgradeUrl: '/pricing' },
        { status: 403 },
      );
    }
    return apiError(error, 'Project could not be created.');
  }
}
