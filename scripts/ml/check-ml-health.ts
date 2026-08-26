/**
 * `npm run ml:health` — deploy gate for the ML guard tier.
 *
 * WHY A CLI AND NOT JUST A ROUTE
 *   /api/health can only report a degraded tier after the instance is already
 *   serving traffic. This runs BEFORE that: in CI, in a release step, or by hand
 *   after changing model paths. It exits non-zero when the operator asked for a
 *   working ML tier (SOTERAI_ML_REQUIRE_HEALTHY=on) and did not get one, which is
 *   what turns "the guard silently dropped to rules-only" into a failed deploy.
 *
 *   Exit codes:
 *     0  tier healthy, or intentionally disabled, or degraded while
 *        SOTERAI_ML_REQUIRE_HEALTHY is off (reported as a warning)
 *     1  configured + SOTERAI_ML_REQUIRE_HEALTHY=on + tier not running
 *     2  the check itself could not complete
 *
 *   --require  force the gate on regardless of SOTERAI_ML_REQUIRE_HEALTHY, for a
 *              pipeline that wants to assert health without changing env
 *   --json     machine-readable output for CI annotations
 *   --env <f>  env file to load first (default .env; use .env.production to check
 *              what the deployed configuration would actually do)
 */

import * as path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { getGuardHealth, resolveRequireHealthyMl } from "../../lib/guard/guardHealth";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json");
const forceRequire = argv.includes("--require");
const envIndex = argv.indexOf("--env");
const envFile = envIndex >= 0 ? argv[envIndex + 1] : ".env";

// The tier's health is a property of the CONFIGURATION, so the check has to read
// the same env the app would. Without this a developer running the gate with a bare
// shell sees "disabled" and passes trivially.
loadEnvFile({ path: path.resolve(process.cwd(), envFile), quiet: true });

async function main(): Promise<number> {
  if (forceRequire) process.env.SOTERAI_ML_REQUIRE_HEALTHY = "on";
  const health = await getGuardHealth({ force: true });
  const required = resolveRequireHealthyMl();

  if (asJson) {
    console.log(JSON.stringify(health, null, 2));
  } else {
    const { ml } = health;
    console.log(`SoterAI guard tier health (env: ${envFile})`);
    console.log(`  configured mode   ${ml.configuredMode}`);
    console.log(`  actual status     ${ml.status}${ml.enforcing ? " (enforcing)" : ""}`);
    console.log(`  model path        ${ml.modelPath ?? "(unset)"}`);
    if (ml.probeLatencyMs !== undefined) {
      // The label is the model's raw argmax and can look alarming on neutral text;
      // what matters operationally is whether the tier would have ACTED on it.
      console.log(
        `  canary            ${ml.canaryLabel ?? "-"} in ${ml.probeLatencyMs}ms` +
          (ml.canaryWouldEscalate
            ? "  <-- benign canary would be ESCALATED: live false positive\n" +
              "                    (expected on both shipped artifacts — read the CANARY_TEXT\n" +
              "                     comment in lib/guard/guardHealth.ts before changing anything)"
            : "  (not escalated)"),
      );
    }
    console.log(
      `  runtime           ${ml.runtime.ran} ran / ${ml.runtime.failedOpen} failed open ` +
        `of ${ml.runtime.calls} calls this process`,
    );
    console.log(`  require healthy   ${required ? "on" : "off"}`);
    if (ml.reason) console.log(`  reason            ${ml.reason}`);
  }

  if (required && health.ml.status === "degraded") {
    if (!asJson) {
      console.error(
        "\nFAIL: the ML tier is configured but not running, and SOTERAI_ML_REQUIRE_HEALTHY is on.\n" +
          "This is a rules-only guard advertising itself as ML-protected. Fix the model artifact\n" +
          "(npm run ml:sign for the signed manifest + trust store), or set SOTERAI_ML_AUGMENT=off\n" +
          "so the reduced coverage is at least declared honestly.",
      );
    }
    return 1;
  }

  if (health.ml.status === "degraded" && !asJson) {
    console.warn(
      "\nWARN: the ML tier is configured but not running. Traffic is being served by rules only.\n" +
        "Set SOTERAI_ML_REQUIRE_HEALTHY=on to make this a deploy failure instead of a warning.",
    );
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`ml:health could not complete: ${(error as Error).message}`);
    process.exit(2);
  });
