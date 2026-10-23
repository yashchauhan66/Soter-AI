import type { DetectorResult } from "../types";
export declare const JAILBREAK_DETECTOR_VERSION = "1.1.0";
export declare const PATTERN_TIMEOUT_MS = 100;
export declare const PATTERN_MAX_ITERATIONS = 5000;
export declare const DETECTOR_TIMEOUT_MS = 2000;
declare const NOISE = "[()\\[\\]{}$0-9.*_`'\";,-]{0,15}";
export declare function detectJailbreak(text: string): DetectorResult;
export { NOISE as JAILBREAK_NOISE_GAP };
//# sourceMappingURL=JailbreakLiteDetector.d.ts.map