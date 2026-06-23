export type EmailTemplateName =
  | "verify-email" | "password-reset" | "invite-member" | "usage-warning"
  | "usage-exceeded" | "payment-failed" | "monthly-report-ready"
  | "webhook-failure" | "high-risk-alert";

export interface RenderedEmail { subject: string; html: string; text: string }

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function renderEmailTemplate(name: EmailTemplateName, data: Record<string, string | number>): RenderedEmail {
  const app = "SoterAI";
  const url = data.url ? String(data.url) : "";
  const project = escapeHtml(String(data.projectName ?? "your project"));
  const templates: Record<EmailTemplateName, { subject: string; body: string }> = {
    "verify-email": { subject: `Verify your ${app} email`, body: `Verify your email address to activate your account. ${url}` },
    "password-reset": { subject: `Reset your ${app} password`, body: `A password reset was requested. This one-time link expires soon. ${url}` },
    "invite-member": { subject: `You were invited to ${app}`, body: `You were invited to join ${escapeHtml(String(data.organizationName ?? "a workspace"))}. ${url}` },
    "usage-warning": { subject: `${project} usage warning`, body: `${project} has used ${data.percent ?? 80}% of its monthly quota.` },
    "usage-exceeded": { subject: `${project} usage limit reached`, body: `${project} reached its monthly usage limit. Guard requests may be restricted.` },
    "payment-failed": { subject: `${app} payment failed`, body: `We could not process the latest payment for ${escapeHtml(String(data.organizationName ?? "your workspace"))}.` },
    "monthly-report-ready": { subject: `${project} monthly security report`, body: `The monthly OWASP LLM Top 10 aligned report for ${project} is ready. ${url}` },
    "webhook-failure": { subject: `${project} webhook delivery failed`, body: `A webhook delivery entered the dead-letter queue after repeated failures.` },
    "high-risk-alert": { subject: `${project} high-risk alert`, body: `A high-risk event was blocked for ${project}. Review the redacted event metadata in the dashboard.` },
  };
  const selected = templates[name];
  return {
    subject: selected.subject,
    text: `${selected.body}\n\nOWASP LLM Top 10 aligned risk reduction, not complete protection.`,
    html: `<div style="font-family:Arial,sans-serif;max-width:640px"><h2>${escapeHtml(selected.subject)}</h2><p>${escapeHtml(selected.body)}</p><p style="color:#64748b;font-size:12px">OWASP LLM Top 10 aligned risk reduction, not complete protection.</p></div>`,
  };
}
