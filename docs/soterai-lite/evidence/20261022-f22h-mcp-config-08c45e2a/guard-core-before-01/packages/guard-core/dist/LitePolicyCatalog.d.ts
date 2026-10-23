export declare const LITE_CREDENTIAL_PATTERNS: readonly (Readonly<{
    id: `${string}:${string}`;
    pattern: string;
    family: string;
    reason: `${string}: this credential filename or path can contain private values; conservatively withhold its contents.`;
    sample: string;
}> | Readonly<{
    id: string;
    pattern: string;
    family: "legacyCredential";
    reason: "Existing canonical credential filename or path; preserve earlier protection.";
    sample: string;
}>)[];
export declare const LITE_STACK_PRESETS: readonly Readonly<{
    patterns: readonly string[];
    id: string;
    label: string;
}>[];
//# sourceMappingURL=LitePolicyCatalog.d.ts.map