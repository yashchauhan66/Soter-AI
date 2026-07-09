export type EmailTemplateName =
  | "verify-email" | "verify-email-otp" | "password-reset" | "invite-member" | "usage-warning"
  | "usage-exceeded" | "payment-failed" | "monthly-report-ready"
  | "webhook-failure" | "high-risk-alert" | "governance-enforcement-alert";

export interface RenderedEmail { subject: string; html: string; text: string }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderEmailTemplate(name: EmailTemplateName, data: Record<string, string | number>): RenderedEmail {
  const app = "SoterAI";
  const url = data.url ? String(data.url) : "";
  const otp = escapeHtml(String(data.otp ?? ""));
  const project = escapeHtml(String(data.projectName ?? "your project"));

  if (name === "verify-email-otp") {
    const subject = "Verify your email address | SoterAI";
    return {
      subject,
      text: [
        "Verify your email address",
        "",
        `Your SoterAI verification code is: ${String(data.otp ?? "")}`,
        "",
        "This code expires in 10 minutes. Never share it with anyone.",
        "If you did not request this code, you can safely ignore this email.",
        "",
        "SoterAI Security Team",
      ].join("\n"),
      html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${subject}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Complete your SoterAI email verification.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
            <tr>
              <td style="background:#08111f;padding:24px 32px;">
                <div style="font-size:22px;font-weight:700;letter-spacing:.2px;color:#ffffff;">Soter<span style="color:#31d7c8;">AI</span></div>
                <div style="margin-top:5px;font-size:12px;color:#94a3b8;">AI Security Command Layer</div>
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 32px;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.3;color:#0f172a;">Verify your email address</h1>
                <p style="margin:0;color:#475569;font-size:15px;line-height:1.7;">Use the verification code below to finish setting up your SoterAI account.</p>
                <div style="margin:28px 0;padding:22px;text-align:center;background:#f8fafc;border:1px solid #cbd5e1;border-radius:12px;">
                  <div style="margin-bottom:8px;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;">Verification code</div>
                  <div style="font-family:Consolas,'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#08111f;">${otp}</div>
                </div>
                <p style="margin:0 0 10px;color:#475569;font-size:14px;line-height:1.6;"><strong>This code expires in 10 minutes.</strong> Never share it with anyone, including SoterAI support.</p>
                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.6;">If you did not request this code, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;line-height:1.6;">
                Sent by the SoterAI Security Team. This is an automated message; please do not reply.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    };
  }

  const templates: Record<EmailTemplateName, { subject: string; body: string }> = {
    "verify-email": { subject: `Verify your ${app} email`, body: `Verify your email address to activate your account. ${url}` },
    "verify-email-otp": {
      subject: `Verify your email address | ${app}`,
      body: `Your email verification code is ${otp}. It expires in 10 minutes. Never share this code with anyone.`,
    },
    "password-reset": { subject: `Reset your ${app} password`, body: `A password reset was requested. This one-time link expires soon. ${url}` },
    "invite-member": { subject: `You were invited to ${app}`, body: `You were invited to join ${escapeHtml(String(data.organizationName ?? "a workspace"))}. ${url}` },
    "usage-warning": { subject: `${project} usage warning`, body: `${project} has used ${data.percent ?? 80}% of its monthly quota.` },
    "usage-exceeded": { subject: `${project} usage limit reached`, body: `${project} reached its monthly usage limit. Guard requests may be restricted.` },
    "payment-failed": { subject: `${app} payment failed`, body: `We could not process the latest payment for ${escapeHtml(String(data.organizationName ?? "your workspace"))}.` },
    "monthly-report-ready": { subject: `${project} monthly security report`, body: `The monthly OWASP LLM Top 10 aligned report for ${project} is ready. ${url}` },
    "webhook-failure": { subject: `${project} webhook delivery failed`, body: `A webhook delivery entered the dead-letter queue after repeated failures.` },
    "high-risk-alert": { subject: `${project} high-risk alert`, body: `A high-risk event was blocked for ${project}. Review the redacted event metadata in the dashboard.` },
    "governance-enforcement-alert": {
      subject: `[Governance] ${String(data.providerName ?? "Unknown provider")} access ${String(data.enforcementAction ?? "blocked")}`,
      body: `AI Usage Governance has ${String(data.enforcementAction ?? "blocked")} access to ${String(data.providerName ?? "an AI provider")}${data.modelName ? ` (${String(data.modelName)})` : ""} for ${project}.\n\nReason: ${String(data.reason ?? "No reason provided")}\n\nReview governance enforcement events and manage policies in the AI Usage Governance dashboard.\n${data.dashboardUrl ? `Dashboard: ${String(data.dashboardUrl)}` : ""}`,
    },
  };
  const selected = templates[name];
  return {
    subject: selected.subject,
    text: `${selected.body}\n\nOWASP LLM Top 10 aligned risk reduction, not complete protection.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h2>${escapeHtml(selected.subject)}</h2><p>${escapeHtml(selected.body)}</p><p style="color:#64748b;font-size:12px">OWASP LLM Top 10 aligned risk reduction, not complete protection.</p></div>`,
  };
}
