import { relativePath } from "../ai-boundary/policy";

export const SENSITIVE_MARKS_KEY = "soterai.projectPrivacy.sensitive.v1";

export function parseSensitiveMarks(raw: unknown, root: string): string[] {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid sensitive restrictions.");
    const marks = Object.prototype.hasOwnProperty.call(raw, root) ? (raw as Record<string, unknown>)[root] : [];
    if (!Array.isArray(marks) || marks.length > 256 || marks.some(item => typeof item !== "string")) throw new Error("Invalid sensitive restrictions.");
    return marks.map(item => relativePath(item));
}
