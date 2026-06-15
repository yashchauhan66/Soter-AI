import { getTopRiskTypes } from "../lib/dashboard/metrics";
import { db } from "../lib/db";

async function main() {
  const now = new Date();
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const projectId = process.env.VERIFY_PROJECT_ID ?? "demo-project";
  const rows = await getTopRiskTypes(projectId, since);
  console.log(JSON.stringify({ projectId, since: since.toISOString(), rows }));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
