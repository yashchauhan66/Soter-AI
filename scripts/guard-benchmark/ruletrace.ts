import { normalizeForDetection } from "../../lib/guard/detectors/helpers";
// Re-import the module source to access rules via a hack: we replicate by requiring internals.
// Instead, monkey-path: import detector and instrument by reading its rule list through a debug export.
import * as mod from "../../lib/guard/detectors/generalizedIntentDetector";
const text = process.argv[2];
const dbg = (mod as any).__debugRules;
if (!dbg) { console.log("no debug export"); process.exit(0); }
for (const info of dbg(text)) console.log(info);
