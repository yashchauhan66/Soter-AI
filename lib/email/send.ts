import { getEmailClient, type EmailMessage } from "./client";
import { renderEmailTemplate, type EmailTemplateName } from "./templates";

export async function sendTemplateEmail(input: {
  to: string | string[];
  template: EmailTemplateName;
  data?: Record<string, string | number>;
  attachments?: EmailMessage["attachments"];
}) {
  const rendered = renderEmailTemplate(input.template, input.data ?? {});
  return getEmailClient().send({
    to: Array.isArray(input.to) ? input.to : [input.to],
    ...rendered,
    attachments: input.attachments,
  });
}
