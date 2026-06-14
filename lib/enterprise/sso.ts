import { z } from "zod";

export const ssoProviderSchema = z.object({ organizationId: z.string().min(1), name: z.string().min(1).max(100), metadataUrl: z.string().url().refine((value) => value.startsWith("https://"), "Metadata URL must use HTTPS.").optional().or(z.literal("")), entityId: z.string().max(500).optional(), ssoUrl: z.string().url().refine((value) => value.startsWith("https://"), "SSO URL must use HTTPS.").optional().or(z.literal("")), certificate: z.string().max(20_000).optional(), enabled: z.boolean().default(false) }).superRefine((value, context) => {
  if (!value.enabled) return;
  const metadataConfigured = Boolean(value.metadataUrl);
  const manualConfigured = Boolean(value.entityId && value.ssoUrl && value.certificate?.includes("BEGIN CERTIFICATE"));
  if (!metadataConfigured && !manualConfigured) context.addIssue({ code: "custom", message: "Enabled SAML requires an HTTPS metadata URL or entityId, HTTPS ssoUrl, and a PEM certificate." });
});
