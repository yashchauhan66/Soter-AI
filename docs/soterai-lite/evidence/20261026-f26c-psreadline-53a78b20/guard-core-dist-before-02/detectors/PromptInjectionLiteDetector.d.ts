import type { DetectorResult } from "../types";
export declare const PROMPT_INJECTION_DETECTOR_VERSION = "1.3.0";
export declare const PATTERN_TIMEOUT_MS = 100;
export declare const PATTERN_MAX_ITERATIONS = 5000;
export declare const DETECTOR_TIMEOUT_MS = 2000;
declare const G = "[\\s()\\[\\]{}$0-9.*_`'\";,-]{0,15}";
export declare function detectPromptInjection(text: string): DetectorResult;
export { G as INJECTION_NOISE_GAP };
//# sourceMappingURL=PromptInjectionLiteDetector.d.ts.map