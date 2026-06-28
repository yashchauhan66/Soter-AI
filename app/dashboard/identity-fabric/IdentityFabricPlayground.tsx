"use client";

import { useActionState, useState } from "react";
import {
  issueIdentityPassport,
  verifyIdentityPassport,
  delegateIdentityCredentials,
  exchangeForTaskToken,
  crossAgentVerify,
  registerIdpPrincipal,
} from "./actions";

// ── Tab Navigation ───────────────────────────────────────────────────────────

const TABS = [
  { id: "issue", label: "Issue passport" },
  { id: "verify", label: "Verify passport" },
  { id: "delegate", label: "Delegate" },
  { id: "exchange", label: "Task token" },
  { id: "cross-auth", label: "Cross-agent auth" },
  { id: "idp", label: "IdP registration" },
] as const;

type TabId = (typeof TABS)[number]["id"];

// ── Main Playground Component ────────────────────────────────────────────────

interface IdentityFabricPlaygroundProps {
  issuePassport: typeof issueIdentityPassport;
  verifyPassport: typeof verifyIdentityPassport;
  delegateCredentials: typeof delegateIdentityCredentials;
  exchangeForTask: typeof exchangeForTaskToken;
  crossAgentVerify: typeof crossAgentVerify;
  registerIdp: typeof registerIdpPrincipal;
}

export function IdentityFabricPlayground({
  issuePassport,
  verifyPassport,
  delegateCredentials,
  exchangeForTask,
  crossAgentVerify,
  registerIdp,
}: IdentityFabricPlaygroundProps) {
  const [activeTab, setActiveTab] = useState<TabId>("issue");

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Playground</h2>
        <span className="text-xs text-slate-500">Test the identity fabric APIs</span>
      </div>

      {/* Tabs */}
      <nav className="mt-4 flex flex-wrap gap-1.5 border-b border-slate-800 pb-3">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === tab.id
                ? "bg-cyan/10 text-cyan"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "issue" && <IssuePassportForm action={issuePassport} />}
        {activeTab === "verify" && <VerifyPassportForm action={verifyPassport} />}
        {activeTab === "delegate" && <DelegateForm action={delegateCredentials} />}
        {activeTab === "exchange" && <ExchangeForm action={exchangeForTask} />}
        {activeTab === "cross-auth" && <CrossAuthForm action={crossAgentVerify} />}
        {activeTab === "idp" && <IdpForm action={registerIdp} />}
      </div>
    </section>
  );
}

// ── Issue Passport ───────────────────────────────────────────────────────────

function IssuePassportForm({ action }: { action: typeof issueIdentityPassport }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Issue a new cryptographic passport for an agent. The passport is signed with HMAC-SHA256
        and carries capabilities in <code className="text-cyan">action:resource</code> format.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="agentId">
            Agent identity ID
          </label>
          <input
            id="agentId"
            name="agentId"
            className="input mt-1 w-full"
            placeholder="agent_identity_xxx"
            defaultValue="agent_identity_demo_001"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="audience">
            Audience (optional)
          </label>
          <input
            id="audience"
            name="audience"
            className="input mt-1 w-full"
            placeholder="gmail-api, rag-service, ..."
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="capabilities">
          Capabilities <span className="text-slate-500">(one per line)</span>
        </label>
        <textarea
          id="capabilities"
          name="capabilities"
          className="input mt-1 min-h-[100px] w-full font-mono text-xs"
          defaultValue={`read:workspace/docs/*\nexecute:tool/rag.search\nread:workspace/projects/*\nwrite:rag/collection/reports`}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Format: <code>&lt;action&gt;:&lt;resource&gt;[/&lt;subresource&gt;]</code>
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="scope">
          Scope label (optional)
        </label>
        <input
          id="scope"
          name="scope"
          className="input mt-1 w-full"
          placeholder="session:chat-123"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="button-primary" type="submit" disabled={pending}>
          {pending ? "Issuing..." : "Issue passport"}
        </button>
      </div>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.success && state.raw && (
            <>
              <p className="mb-2 text-xs font-semibold text-slate-400">Token:</p>
              <pre className="max-h-[120px] overflow-auto rounded bg-slate-950 p-3 text-xs text-emerald-300 break-all">
                {state.raw}
              </pre>
              {state.claims && (
                <div className="mt-3 grid gap-1 text-xs">
                  <p><span className="text-slate-500">Subject:</span> {state.claims.sub}</p>
                  <p><span className="text-slate-500">Capabilities:</span> {state.claims.cap.join(", ")}</p>
                  <p><span className="text-slate-500">JTI:</span> {state.claims.jti}</p>
                  <p>
                    <span className="text-slate-500">Expires:</span>{" "}
                    {new Date(state.claims.exp * 1000).toLocaleString()}
                  </p>
                </div>
              )}
            </>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── Verify Passport ──────────────────────────────────────────────────────────

function VerifyPassportForm({ action }: { action: typeof verifyIdentityPassport }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Verify a passport token&apos;s signature, check expiration, and optionally test
        whether it authorizes a specific capability.
      </p>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="token">
          Passport token
        </label>
        <textarea
          id="token"
          name="token"
          className="input mt-1 min-h-[80px] w-full font-mono text-xs"
          placeholder="st.v1.eyJzdWIi...aGVsbG8.abc123def456"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="requiredCapability">
          Required capability (optional)
        </label>
        <input
          id="requiredCapability"
          name="requiredCapability"
          className="input mt-1 w-full"
          placeholder="read:workspace/docs/*"
        />
      </div>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Verifying..." : "Verify passport"}
      </button>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.success && (
            <div className="grid gap-2 text-xs">
              <p>
                <span className="text-slate-500">Status:</span>{" "}
                <span className={state.status === "valid" ? "text-emerald-300" : "text-red-300"}>
                  {state.status}
                </span>
              </p>
              <p><span className="text-slate-500">Valid signature:</span> {String(state.valid)}</p>
              <p><span className="text-slate-500">Active (not expired):</span> {String(state.active)}</p>
              {state.remainingTtl !== undefined && (
                <p><span className="text-slate-500">Remaining TTL:</span> {state.remainingTtl}s</p>
              )}
              {state.claims && (
                <>
                  <p><span className="text-slate-500">Subject:</span> {state.claims.sub}</p>
                  <p><span className="text-slate-500">Capabilities:</span> {state.claims.cap.join(", ")}</p>
                  {state.claims.aud && <p><span className="text-slate-500">Audience:</span> {state.claims.aud}</p>}
                  {state.claims.scope && <p><span className="text-slate-500">Scope:</span> {state.claims.scope}</p>}
                </>
              )}
            </div>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── Delegate Capabilities ────────────────────────────────────────────────────

function DelegateForm({ action }: { action: typeof delegateIdentityCredentials }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Delegate capabilities from a parent passport to a child agent. The child can only
        receive capabilities that the parent already possesses (capability intersection).
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="parentToken">
            Parent passport token
          </label>
          <textarea
            id="parentToken"
            name="parentToken"
            className="input mt-1 min-h-[80px] w-full font-mono text-xs"
            placeholder="st.v1.eyJzdWIi...aGVsbG8.abc123"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="childAgentId">
            Child agent identity ID
          </label>
          <input
            id="childAgentId"
            name="childAgentId"
            className="input mt-1 w-full"
            placeholder="agent_identity_child_001"
            defaultValue="agent_identity_child_001"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="delegateCapabilities">
          Capabilities to delegate <span className="text-slate-500">(one per line)</span>
        </label>
        <textarea
          id="delegateCapabilities"
          name="delegateCapabilities"
          className="input mt-1 min-h-[80px] w-full font-mono text-xs"
          defaultValue={`read:workspace/docs/*\nexecute:tool/rag.search`}
          required
        />
      </div>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Delegating..." : "Delegate capabilities"}
      </button>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.allowed !== undefined && (
            <div className="grid gap-2 text-xs">
              <p>
                <span className="text-slate-500">Allowed:</span>{" "}
                <span className={state.allowed ? "text-emerald-300" : "text-red-300"}>
                  {String(state.allowed)}
                </span>
              </p>
              {state.resultingCapabilities && state.resultingCapabilities.length > 0 && (
                <>
                  <p className="text-slate-500">Resulting capabilities:</p>
                  <ul className="ml-4 list-disc space-y-1 text-emerald-300">
                    {state.resultingCapabilities.map((cap, i) => (
                      <li key={i}>{cap}</li>
                    ))}
                  </ul>
                </>
              )}
              {state.proofHash && (
                <p>
                  <span className="text-slate-500">Proof hash:</span>{" "}
                  <span className="font-mono text-xs">{state.proofHash}</span>
                </p>
              )}
              {(state.violations ?? []).length > 0 && (
                <div className="rounded border border-red-400/20 bg-red-400/5 p-2 text-red-300">
                  <p className="text-xs font-semibold">Violations:</p>
                  <ul className="ml-4 list-disc text-xs">
                    {state.violations!.map((v, i) => (
                      <li key={i}>{v}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── Task Token Exchange ──────────────────────────────────────────────────────

function ExchangeForm({ action }: { action: typeof exchangeForTaskToken }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Exchange a parent passport for an ultra-short-lived (5 minute) task token. The task token
        carries a single capability and is bound to a specific service audience.
      </p>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="parentToken">
          Parent passport token
        </label>
        <textarea
          id="parentToken"
          name="parentToken"
          className="input mt-1 min-h-[80px] w-full font-mono text-xs"
          placeholder="st.v1.eyJzdWIi...aGVsbG8.abc123"
          required
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="requiredCap">
            Required capability
          </label>
          <input
            id="requiredCap"
            name="requiredCap"
            className="input mt-1 w-full"
            placeholder="execute:tool/gmail.send"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="audience">
            Target audience
          </label>
          <input
            id="audience"
            name="audience"
            className="input mt-1 w-full"
            placeholder="gmail-api"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="context">
            Context (optional)
          </label>
          <input
            id="context"
            name="context"
            className="input mt-1 w-full"
            placeholder="Send weekly report"
          />
        </div>
      </div>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Exchanging..." : "Exchange for task token"}
      </button>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.success && state.raw && (
            <>
              <p className="mb-2 text-xs font-semibold text-slate-400">Task token:</p>
              <pre className="max-h-[100px] overflow-auto rounded bg-slate-950 p-3 text-xs text-yellow-300 break-all">
                {state.raw}
              </pre>
              <div className="mt-3 grid gap-1 text-xs">
                <p>
                  <span className="text-slate-500">Expires at:</span>{" "}
                  {new Date(state.expiresAt!).toLocaleString()}
                </p>
                <p>
                  <span className="text-slate-500">Parent JTI:</span>{" "}
                  <span className="font-mono">{state.parentJti}</span>
                </p>
              </div>
            </>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── Cross-Agent Authentication ───────────────────────────────────────────────

function CrossAuthForm({ action }: { action: typeof crossAgentVerify }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Demonstrate agent-to-agent authentication. Agent A challenges Agent B to prove its identity
        by signing a random nonce with the shared signing secret.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="sourceAgentId">
            Source agent (challenger)
          </label>
          <input
            id="sourceAgentId"
            name="sourceAgentId"
            className="input mt-1 w-full"
            placeholder="agent_a"
            defaultValue="agent_a"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="targetAgentId">
            Target agent (responder)
          </label>
          <input
            id="targetAgentId"
            name="targetAgentId"
            className="input mt-1 w-full"
            placeholder="agent_b"
            defaultValue="agent_b"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="targetPassport">
            Target agent&apos;s passport
          </label>
          <input
            id="targetPassport"
            name="targetPassport"
            className="input mt-1 w-full font-mono text-xs"
            placeholder="st.v1.eyJzdWIi..."
            required
          />
        </div>
      </div>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Verifying..." : "Verify cross-agent identity"}
      </button>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.step && (
            <div className="grid gap-2 text-xs">
              <p>
                <span className="text-slate-500">Verified:</span>{" "}
                <span className={state.verified ? "text-emerald-300" : "text-red-300"}>
                  {String(state.verified)}
                </span>
              </p>
              {state.agentIdentityId && (
                <p>
                  <span className="text-slate-500">Agent identity:</span> {state.agentIdentityId}
                </p>
              )}
              {state.challengeToken && (
                <p>
                  <span className="text-slate-500">Challenge nonce:</span>{" "}
                  <span className="font-mono text-xs">{state.challengeToken}</span>
                </p>
              )}
              {state.responseSignature && (
                <p>
                  <span className="text-slate-500">Response signature:</span>{" "}
                  <span className="font-mono text-xs">{state.responseSignature}</span>
                </p>
              )}
            </div>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── IdP Registration ─────────────────────────────────────────────────────────

function IdpForm({ action }: { action: typeof registerIdpPrincipal }) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-slate-400">
        Register an agent as a service principal in an identity provider (Okta, Azure AD).
        The agent will appear as a managed principal in your enterprise directory.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="provider">
            IdP provider
          </label>
          <select
            id="provider"
            name="provider"
            className="input mt-1 w-full"
            defaultValue="okta"
            required
          >
            <option value="okta">Okta</option>
            <option value="azure-ad">Azure AD</option>
            <option value="generic-saml">Generic SAML</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="principalId">
            Service principal ID
          </label>
          <input
            id="principalId"
            name="principalId"
            className="input mt-1 w-full"
            placeholder="okta-sp-001"
            defaultValue="okta-sp-001"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="agentId">
            Agent identity ID
          </label>
          <input
            id="agentId"
            name="agentId"
            className="input mt-1 w-full"
            placeholder="agent_identity_xxx"
            defaultValue="agent_identity_demo_001"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase text-slate-400" htmlFor="scopes">
          OAuth scopes <span className="text-slate-500">(one per line)</span>
        </label>
        <textarea
          id="scopes"
          name="scopes"
          className="input mt-1 min-h-[60px] w-full font-mono text-xs"
          defaultValue={`rag:read\nagent:execute`}
        />
      </div>

      <button className="button-primary" type="submit" disabled={pending}>
        {pending ? "Registering..." : "Register service principal"}
      </button>

      {state && (
        <ResultBlock success={state.success} error={state.error}>
          {state.success && (
            <div className="grid gap-1 text-xs">
              <p><span className="text-slate-500">Principal ID:</span> {state.principalId}</p>
              <p><span className="text-slate-500">Provider:</span> {state.provider}</p>
              <p><span className="text-slate-500">Mapped agent:</span> {state.mappedAgentId}</p>
              <p><span className="text-slate-500">SCIM external ID:</span> <span className="font-mono">{state.scimExternalId}</span></p>
            </div>
          )}
        </ResultBlock>
      )}
    </form>
  );
}

// ── Result Block ─────────────────────────────────────────────────────────────

function ResultBlock({
  success,
  error,
  children,
}: {
  success: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        success
          ? "border-emerald-400/20 bg-emerald-400/5"
          : "border-red-400/20 bg-red-400/5"
      }`}
    >
      {error ? (
        <p className="text-sm text-red-300">{error}</p>
      ) : (
        <div className="text-sm text-slate-200">{children}</div>
      )}
    </div>
  );
}
