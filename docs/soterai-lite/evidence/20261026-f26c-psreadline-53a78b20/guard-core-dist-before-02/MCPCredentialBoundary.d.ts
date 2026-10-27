export interface McpAuthRequest {
    /** Tool/server name for display. */
    server: string;
    /** The resource/audience the downstream API expects, e.g. "https://api.example.com". */
    resource: string;
    /** Audience claim declared on the token to be used, if any. */
    tokenAudience?: string;
    /** The authorization URL the user would be sent to (external consent). */
    authorizationUrl?: string;
    /** True if the flow reuses the client's/upstream token as the downstream token. */
    tokenPassthrough?: boolean;
    /** True if the plan routes the raw credential through model/client context. */
    routesCredentialThroughModel?: boolean;
    /** The identity the server would act as, if declared. */
    actingAs?: string;
    /** The user identity the request is on behalf of, if declared. */
    onBehalfOf?: string;
}
export type McpAuthVerdict = "allow" | "ask" | "deny";
export interface McpAuthDecision {
    verdict: McpAuthVerdict;
    reasons: string[];
    /** The full, human-readable domain to show for consent (never truncated). */
    trustedDomain?: string;
    /** True if the auth URL host uses punycode / mixed scripts (spoofing risk). */
    suspiciousDomain: boolean;
}
/**
 * Decide whether an MCP third-party authorization flow may proceed. Fails closed
 * (deny) on the boundary violations that leak credentials, and asks the user to
 * confirm the external domain otherwise.
 */
export declare function evaluateMcpAuth(req: McpAuthRequest): McpAuthDecision;
//# sourceMappingURL=MCPCredentialBoundary.d.ts.map