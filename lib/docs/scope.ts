/**
 * Per-guide scope notes: what each guide deliberately does **not** cover.
 *
 * Kept as data rather than JSX inside each page for two reasons:
 *
 * 1. `DocsPageShell` can then require a scope note structurally — a guide with no
 *    entry here throws during development instead of shipping without caveats.
 *    On a security product, an omitted caveat is how a reader ends up assuming
 *    protection that does not exist.
 * 2. Reviewing all 18 notes side by side in one file makes inconsistent or
 *    over-promising language obvious. Scattered across 18 JSX files it was not.
 *
 * Rules for writing these:
 * - State a real boundary, not a disclaimer. "Not a substitute for X" is useful;
 *   "results may vary" is not.
 * - Point at the page that *does* cover it, where one exists.
 * - Never soften into marketing. If something is unimplemented, say so.
 */
export const DOCS_SCOPE: Record<string, string[]> = {
  "/docs": [
    "This page orients you; it does not contain working code. Start with the Quickstart for that.",
    "It does not cover dashboard operation, billing, or policy administration — those live in the product, not the docs.",
  ],

  "/docs/quickstart": [
    "Guards a single chat turn. Multi-turn conversation state, agent tool calls, and RAG retrieval each need their own guide.",
    "Uses the JavaScript SDK. For other languages, read the REST API guide instead.",
    "Does not cover deployment, key rotation, or webhook verification — see Security best practices before going to production.",
  ],

  "/docs/services": [
    "A directory, not a tutorial. Each service page carries its own setup steps.",
    "Availability depends on your plan; the directory lists every service regardless of tier.",
  ],

  "/docs/js": [
    "Server-side only. The SDK must never run in a browser bundle, because that would expose your API key.",
    "Does not cover React, Vue, or any client framework directly — call your own backend route from the client.",
  ],

  "/docs/python": [
    "Server-side only, for the same key-exposure reason as the JavaScript SDK.",
    "Does not cover notebook or Streamlit usage, where secrets are frequently committed by accident.",
  ],

  "/docs/rest-api": [
    "Shows the request and response shapes, not per-language idioms. Retries, timeouts, and connection pooling are your HTTP client's job.",
    "Field-by-field reference lives in the API reference, not here.",
  ],

  "/docs/api-contract": [
    "A reference, not a tutorial. It assumes you already have a working call.",
    "Documents the current stable surface. Endpoints marked beta or labs can change without a major version bump.",
  ],

  "/docs/cli": [
    "The `soter init` command is planned and not yet implemented. This page describes intended behaviour only.",
    "Manual setup is fully supported today and takes about two minutes — follow the Quickstart.",
  ],

  "/docs/nextjs": [
    "Covers App Router route handlers and server actions. Pages Router API routes work the same way but are not shown.",
    "Guarding inside a Client Component is not supported: the key would be exposed to the browser.",
  ],

  "/docs/express": [
    "Assumes an existing Express app with a chat route. It is not an Express tutorial.",
    "Does not cover WebSocket or Server-Sent Event streaming, where the output guard needs to buffer before it can decide.",
  ],

  "/docs/fastapi": [
    "Assumes a working FastAPI app. Does not cover deployment, ASGI server tuning, or dependency injection patterns.",
    "Background-task guarding is not shown; a rejected result must still reach the caller.",
  ],

  "/docs/rag": [
    "Inspects retrieved context and generated output. It does not secure your vector store, its access controls, or its network boundary.",
    "Document trust scoring reduces the impact of poisoned context; it does not guarantee that poisoned context is caught.",
  ],

  "/docs/generic-chatbot": [
    "A pattern, not a runnable app. You supply the transport, session handling, and model call.",
    "If a framework-specific guide exists for your stack, use it instead — this is the fallback.",
  ],

  "/docs/wordpress": [
    "The API key must stay in PHP or a server-side proxy. A key placed in theme JavaScript is publicly readable.",
    "Does not cover multisite networks, page caching interactions, or plugin conflict resolution.",
  ],

  "/docs/whatsapp": [
    "Covers the guard call, not WhatsApp Business API onboarding, template approval, or number verification.",
    "India PII detection is pattern and context based. It reduces exposure; it does not certify compliance with any regulation.",
  ],

  "/docs/intercom": [
    "Guards message content. It does not manage Intercom permissions, seats, or data-retention settings.",
    "Text already stored in Intercom before you integrated is out of scope — this guards new messages only.",
  ],

  "/docs/zendesk": [
    "Guards ticket and draft content. It does not alter Zendesk retention policy or purge historical tickets.",
    "Does not cover Zendesk app publishing or marketplace review.",
  ],

  "/docs/botpress": [
    "Shows the HTTP steps. It does not cover Botpress flow design, NLU training, or channel configuration.",
    "Store only the guard verdict in Botpress logs, never the raw text — Botpress logs are not a secure store.",
  ],

  "/docs/best-practices": [
    "Practices, not a compliance certificate. Following them does not make a deployment SOC 2 or ISO 27001 certified.",
    "Complements secure design, identity controls, monitoring, and incident response. It does not replace any of them.",
  ],
};

/** Scope note for a path, or undefined when the guide has no entry yet. */
export function getDocsScope(path: string): string[] | undefined {
  return DOCS_SCOPE[path];
}
