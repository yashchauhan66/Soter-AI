import { jsonResponse } from "@/lib/apiResponse";

export const dynamic = "force-static";

export async function GET() {
  return jsonResponse({
    name: "CyberRakshak Guard Badge",
    embed: '<script src="https://yourdomain.com/badge.js" data-project-id="PROJECT_BADGE_SLUG"></script>',
    statuses: ["PROTECTED", "MONITORING_ACTIVE", "ISSUES_FOUND", "INACTIVE"],
    docs: "/docs#badge",
  });
}
