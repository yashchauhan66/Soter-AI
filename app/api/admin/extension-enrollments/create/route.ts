import { z } from "zod";
import { apiError, jsonResponse, readJson } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeEmail: z.string().email().max(200).optional(),
  department: z.string().trim().max(100).optional(),
  role: z.string().trim().max(100).optional(),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInHours: z.number().int().min(1).max(8760).default(720),
});

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = createSchema.parse(await readJson(request));

    const { createEnrollmentToken } = await import("@/lib/extension/enrollment");

    const result = await createEnrollmentToken({
      organizationId: body.organizationId,
      createdByAdminId: admin.id,
      employeeEmail: body.employeeEmail,
      department: body.department,
      role: body.role,
      maxUses: body.maxUses,
      expiresAt: new Date(Date.now() + body.expiresInHours * 3600_000),
    });

    return jsonResponse({
      ok: true,
      token: result.token,
      rawToken: result.rawToken,
      message: "Copy this enrollment token now. It will not be shown again.",
    }, { status: 201 });
  } catch (error) {
    return apiError(error, "Enrollment token could not be created.");
  }
}
