import { z } from "zod";

export const agentIdentitySchema = z.object({
  organizationId: z.string().trim().min(1).max(200),
  employeeId: z.string().trim().max(200).optional(),
  deviceId: z.string().trim().min(1).max(200),
  type: z.enum(["browser_extension", "vscode_extension", "jetbrains_plugin", "local_agent", "cli_guard"]),
  version: z.string().trim().min(1).max(40),
  platform: z.string().trim().min(1).max(80),
});
