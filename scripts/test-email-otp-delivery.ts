// Ad-hoc delivery test for the Resend email path used by signup/OTP.
// Sends the real verify-email-otp template to Resend's safe test recipient
// (delivered@resend.dev) — this exercises API auth + the from-domain without
// emailing a real person. Run: npx tsx scripts/test-email-otp-delivery.ts [to]
import "dotenv/config";
import { sendTemplateEmail } from "../lib/email/send";
import { resolveEmailDeliveryMode } from "../lib/auth/signupPolicy";

async function main() {
  const to = process.argv[2] ?? "delivered@resend.dev";
  console.log("provider:", process.env.EMAIL_PROVIDER);
  console.log("from:", process.env.EMAIL_FROM);
  console.log("delivery mode:", resolveEmailDeliveryMode());
  console.log("sending verify-email-otp to:", to);
  try {
    const result = await sendTemplateEmail({
      to,
      template: "verify-email-otp",
      data: { otp: "246813" },
    });
    console.log("RESULT: SUCCESS", result);
  } catch (error) {
    console.log("RESULT: FAILED");
    console.log(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

void main();
