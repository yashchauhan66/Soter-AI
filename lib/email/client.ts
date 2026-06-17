import { createHash, createHmac } from "crypto";
import net from "net";
import tls from "tls";
import { isProduction } from "../utils";

export type EmailProvider = "resend" | "aws-ses" | "smtp" | "mock";

export interface EmailMessage {
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>;
}

export interface EmailResult { id: string; provider: EmailProvider; mocked: boolean }

export interface EmailClient { send(message: EmailMessage): Promise<EmailResult> }

class MockEmailClient implements EmailClient {
  async send(message: EmailMessage): Promise<EmailResult> {
    console.info(JSON.stringify({ level: "info", event: "email.mock", to: message.to, subject: message.subject }));
    return { id: `mock_${Date.now()}`, provider: "mock", mocked: true };
  }
}

class ResendEmailClient implements EmailClient {
  async send(message: EmailMessage): Promise<EmailResult> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required for the Resend provider.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        attachments: message.attachments?.map((item) => ({ filename: item.filename, content: item.content.toString("base64") })),
      }),
    });
    if (!response.ok) throw new Error(`Resend rejected email (${response.status}).`);
    const data = await response.json() as { id: string };
    return { id: data.id, provider: "resend", mocked: false };
  }
}

function encodeMime(message: EmailMessage) {
  const boundary = `crg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const headers = [`From: ${process.env.EMAIL_FROM}`, `To: ${message.to.join(", ")}`, `Subject: ${message.subject}`, "MIME-Version: 1.0", `Content-Type: multipart/mixed; boundary=${boundary}`];
  const parts = [`--${boundary}`, "Content-Type: text/html; charset=UTF-8", "Content-Transfer-Encoding: base64", "", Buffer.from(message.html).toString("base64")];
  for (const item of message.attachments ?? []) parts.push(`--${boundary}`, `Content-Type: ${item.contentType}; name=${item.filename}`, `Content-Disposition: attachment; filename=${item.filename}`, "Content-Transfer-Encoding: base64", "", item.content.toString("base64"));
  return [...headers, "", ...parts, `--${boundary}--`, ""].join("\r\n");
}

class SmtpEmailClient implements EmailClient {
  async send(message: EmailMessage): Promise<EmailResult> {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT ?? 587);
    if (!host || !process.env.EMAIL_FROM) throw new Error("SMTP_HOST and EMAIL_FROM are required.");
    const secure = process.env.SMTP_TLS === "true" || port === 465;
    const socket = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
    let buffer = "";
    const waitFor = (codes: number[]) => new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("SMTP response timed out.")), 10_000);
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split(/\r?\n/).filter(Boolean);
        const last = lines[lines.length - 1] ?? "";
        if (!/^\d{3} /.test(last)) return;
        clearTimeout(timeout); socket.off("data", onData); buffer = "";
        const code = Number(last.slice(0, 3));
        if (!codes.includes(code)) reject(new Error(`SMTP rejected command: ${last}`)); else resolve(lines.join("\n"));
      };
      socket.on("data", onData);
    });
    const command = async (value: string, codes = [250]) => { socket.write(`${value}\r\n`); return waitFor(codes); };
    try {
      await waitFor([220]);
      await command(`EHLO ${process.env.SMTP_HELO ?? "cyberrakshak.local"}`);
      if (process.env.SMTP_USER) {
        await command("AUTH LOGIN", [334]);
        await command(Buffer.from(process.env.SMTP_USER).toString("base64"), [334]);
        await command(Buffer.from(process.env.SMTP_PASS ?? "").toString("base64"), [235]);
      }
      await command(`MAIL FROM:<${process.env.EMAIL_FROM}>`);
      for (const recipient of message.to) await command(`RCPT TO:<${recipient}>`, [250, 251]);
      await command("DATA", [354]);
      socket.write(`${encodeMime(message).replace(/^\./gm, "..")}\r\n.\r\n`);
      await waitFor([250]);
      await command("QUIT", [221]);
      return { id: `smtp_${Date.now()}`, provider: "smtp", mocked: false };
    } finally { socket.destroy(); }
  }
}

function hmac(key: Buffer | string, value: string) { return createHmac("sha256", key).update(value).digest(); }
class SesEmailClient implements EmailClient {
  async send(message: EmailMessage): Promise<EmailResult> {
    const region = process.env.AWS_REGION ?? "ap-south-1";
    const accessKey = process.env.AWS_ACCESS_KEY_ID;
    const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
    const from = process.env.EMAIL_FROM;
    if (!accessKey || !secretKey || !from) throw new Error("AWS credentials, AWS_REGION, and EMAIL_FROM are required for SES.");
    const host = `email.${region}.amazonaws.com`;
    const path = "/v2/email/outbound-emails";
    const body = JSON.stringify({ FromEmailAddress: from, Destination: { ToAddresses: message.to }, Content: { Raw: { Data: Buffer.from(encodeMime(message)).toString("base64") } } });
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const payloadHash = createHash("sha256").update(body).digest("hex");
    const canonicalHeaders = `content-type:application/json\nhost:${host}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-date";
    const canonicalRequest = `POST\n${path}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
    const scope = `${date}/${region}/ses/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${createHash("sha256").update(canonicalRequest).digest("hex")}`;
    const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, date), region), "ses"), "aws4_request");
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
    const response = await fetch(`https://${host}${path}`, { method: "POST", headers: { "Content-Type": "application/json", "X-Amz-Date": amzDate, Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}` }, body });
    if (!response.ok) throw new Error(`AWS SES rejected email (${response.status}).`);
    const data = await response.json() as { MessageId?: string };
    return { id: data.MessageId ?? `ses_${Date.now()}`, provider: "aws-ses", mocked: false };
  }
}

export function getEmailClient(): EmailClient {
  const provider = (process.env.EMAIL_PROVIDER ?? "mock").toLowerCase() as EmailProvider;
  if (provider === "mock" && isProduction()) {
    throw new Error("EMAIL_PROVIDER=mock is disabled in production. Configure resend, aws-ses, or smtp.");
  }
  if (provider === "resend") return new ResendEmailClient();
  if (provider === "aws-ses") return new SesEmailClient();
  if (provider === "smtp") return new SmtpEmailClient();
  if (provider !== "mock") throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
  return new MockEmailClient();
}
