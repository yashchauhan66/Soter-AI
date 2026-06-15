import { apiError, jsonResponse } from "@/lib/apiResponse";
import { requireAdmin } from "@/lib/auth/guards";
import { razorpayConfigDiagnostics, razorpayConfigured, razorpayKeyId } from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const diag = razorpayConfigDiagnostics();
    const keyId = razorpayKeyId();
    const mode = keyId.startsWith("rzp_live_") ? "live" : keyId.startsWith("rzp_test_") ? "test" : "unknown";
    return jsonResponse({
      configured: razorpayConfigured(),
      mode,
      keyIdPrefix: keyId ? keyId.slice(0, 12) : null,
      missing: diag.missing,
      warnings: diag.warnings,
    });
  } catch (error) {
    return apiError(error, "Razorpay diagnostics could not be loaded.");
  }
}
