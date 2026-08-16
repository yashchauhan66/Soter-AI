import { MetricCard } from "@/components/dashboard/MetricCard";
import { ProjectSwitcher } from "@/components/dashboard/ProjectSwitcher";
import { getCurrentProjectById, getCurrentUserProjects } from "@/lib/auth";
import { requireProjectPermission } from "@/lib/auth/guards";
import { dbGetFabricStats, dbRecentDelegations, dbRecentRevocations, dbRecentServicePrincipals } from "@/lib/identity-fabric/db";
import type { IdentityFabricDelegation, IdentityFabricRevocation, IdentityFabricServicePrincipal } from "@prisma/client";
import { FeatureGuide } from "@/components/docs/FeatureGuide";

export const dynamic = "force-dynamic";

export default async function IdentityFabricPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const [project, projects] = await Promise.all([
    getCurrentProjectById(params.project),
    getCurrentUserProjects(),
  ]);
  await requireProjectPermission(project.id, "policy:manage");

  // Live database stats
  const stats = await dbGetFabricStats(project.id);
  const [recentDelegations, recentRevocations, recentPrincipals] = await Promise.all([
    dbRecentDelegations(project.id, 6),
    dbRecentRevocations(project.id, 6),
    dbRecentServicePrincipals(project.id, 6),
  ]);

  return (
    <div className="space-y-6">
      <FeatureGuide
        eyebrow="Agent security"
        title="Agent identity fabric"
        description="Treat every AI agent as a first-class security principal with its own cryptographic identity, scoped capabilities, and an auditable delegation chain — just like a user or service account in your IAM system."
        useCase="When one agent spawns another, or a service principal acts on a user's behalf, you lose accountability fast. The identity fabric gives each agent a durable identity and records the full delegation chain, so you can always answer who authorized an action, what capabilities were passed down, and where a revocation should propagate."
        howItWorks={[
          { heading: "Register principals", body: "Each agent and service principal gets a cryptographic identity. This is the durable actor that passports and delegations reference." },
          { heading: "Issue scoped passports", body: "A session passport grants a subset of capabilities. An agent can only act within the scope its passport allows." },
          { heading: "Delegate down a chain", body: "A parent agent can issue a narrower passport to a child agent for a specific intent. Each delegation is recorded so the chain of authority stays auditable." },
          { heading: "Revoke and audit", body: "Revocations are tracked here alongside recent delegations and service principals, giving you a live view of the identity graph and its history." },
        ]}
        integrationCode={`// Delegate a narrower passport from a parent agent to a child
const res = await fetch("https://soterai.in/api/agent/passport/delegate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${process.env.SOTER_API_KEY}\`,
  },
  body: JSON.stringify({
    parentSessionId: "parent-session-id",
    parentPassportToken: process.env.PARENT_PASSPORT_TOKEN,
    childAgentIdentityId: "child-agent-identity-id",
    intent: "Summarize the retrieved documents only",
    ttlSeconds: 900,
    allowedTools: ["read_file"],
  }),
});`}
        callout="The delegation chain reflects passports issued and revoked through the SDK or passport API. Agents that bypass passport issuance do not appear in the fabric."
      />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <ProjectSwitcher projects={projects} selectedId={project.id} />
      </div>

      {/* Live metric cards */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Passports issued" value={stats.passportsIssued} tone="cyan" />
        <MetricCard label="Active passports" value={stats.activePassports} tone="green" />
        <MetricCard label="Revocations" value={stats.revocations} tone="red" />
        <MetricCard label="Service principals" value={stats.servicePrincipals} tone="blue" />
        <MetricCard label="Delegations" value={stats.delegations} tone="yellow" />
        <MetricCard label="Auth challenges" value={stats.challenges} tone="gray" />
      </div>

      {/* Database-backed recent activity */}
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Recent delegations</h2>
          <div className="mt-3 space-y-2">
            {recentDelegations.length === 0 && <p className="text-sm text-slate-300">No delegations yet. They appear here when an agent issues a scoped passport to a child agent.</p>}
            {recentDelegations.map((d: IdentityFabricDelegation) => (
              <div key={d.id} className="rounded-lg border border-slate-800 p-3 text-xs">
                <p><span className="text-slate-300">Child:</span> {d.childAgentIdentityId}</p>
                <p><span className="text-slate-300">Parent JTI:</span> <span className="font-mono">{d.parentPassportJti.slice(0, 24)}...</span></p>
                <p className="mt-1 text-slate-600">{d.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Recent revocations</h2>
          <div className="mt-3 space-y-2">
            {recentRevocations.length === 0 && <p className="text-sm text-slate-300">No revocations yet. Revoking a passport instantly invalidates an agent identity — revocations are logged here.</p>}
            {recentRevocations.map((r: IdentityFabricRevocation) => (
              <div key={r.id} className="rounded-lg border border-red-400/20 bg-red-400/5 p-3 text-xs">
                <p><span className="text-slate-300">JTI:</span> <span className="font-mono">{r.jti.slice(0, 24)}...</span></p>
                <p className="mt-1 text-slate-200">{r.reason ?? "No reason"}</p>
                <p className="mt-1 text-slate-600">{r.revokedAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Service principals</h2>
          <div className="mt-3 space-y-2">
            {recentPrincipals.length === 0 && <p className="text-sm text-slate-300">No principals registered.</p>}
            {recentPrincipals.map((p: IdentityFabricServicePrincipal) => (
              <div key={p.id} className="rounded-lg border border-slate-800 p-3 text-xs">
                <p><span className="text-cyan">{p.provider}</span> — {p.principalId}</p>
                <p className="mt-1 text-slate-300">Agent: {p.agentIdentityId}</p>
                <p className="mt-1 text-slate-600">{p.createdAt.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Why this matters */}
      <section className="card border-cyan/20 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan">Why this matters</h2>
        <p className="mt-3 leading-7 text-slate-300">
          Current AI security tools treat agents as anonymous extensions — they authenticate users
          (via SSO) but never give agents their own identity. The Agent Identity Fabric closes this
          gap by issuing each agent a cryptographically signed passport with explicit capabilities.
          Delegation chains ensure that a compromised agent cannot escalate privileges, and every
          cross-agent interaction is verifiable through challenge-response authentication.
        </p>
      </section>

      {/* How it works */}
      <section className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200">How it works</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            {
              heading: "Cryptographic passport",
              body: "Each agent gets a signed JWT-like token containing its identity ID, capabilities (action:resource pairs), expiry, and a unique token ID. Tokens are HMAC-SHA256 signed with your organization's secret.",
            },
            {
              heading: "Capability-based authorization",
              body: 'Capabilities use the format action:resource (e.g., read:workspace/docs) with glob matching and optional conditions. The admin action satisfies any request.',
            },
            {
              heading: "OAuth-style token exchange",
              body: "Parent agents issue ultra-short-lived (5 min) task tokens to child agents. Each task token carries a single capability and references the parent's JTI for full chain auditability.",
            },
            {
              heading: "Cross-agent verification",
              body: "Agents authenticate each other using a challenge-response protocol. Agent A sends a random challenge, Agent B signs it with the shared secret, and Agent A verifies the signature.",
            },
            {
              heading: "IdP service principal mapping",
              body: "Map agent identities to Okta or Azure AD service principals. Agents appear as managed principals in SCIM directories with their own OAuth scopes.",
            },
            {
              heading: "Delegation chain validation",
              body: "Each delegation step is cryptographically proven. The chain is limited to 5 hops by default, and every child capability must be a subset of the parent's capabilities.",
            },
          ].map((step, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-800 bg-slate-950/30 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan/10 text-xs font-bold text-cyan">
                  {i + 1}
                </span>
                <h3 className="text-sm font-semibold">{step.heading}</h3>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>



      {/* Integration code */}
      <section className="card p-5">
        <h2 className="text-lg font-semibold">Copy-paste integration</h2>
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
          <strong>Note:</strong> The identity fabric uses Node.js <code>crypto</code> module
          and has zero external dependencies. Configure the signing secret via
          <code className="mx-1 rounded bg-slate-800 px-1.5 py-0.5">IDENTITY_FABRIC_SECRET</code>
          environment variable at application startup.
        </div>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-300">{`import {
  createAgentPassport,
  verifyAgentPassport,
  passportAuthorizes,
  exchangePassportForTask,
  delegateCredentials,
  createAuthChallenge,
  respondToAuthChallenge,
  verifyAuthResponse,
  verifyAgentIdentity,
  configureIdentityFabric,
} from "@/lib/identity-fabric";

// ═══════════════════════════════════════════
// 1. Configure at startup
// ═══════════════════════════════════════════
configureIdentityFabric({
  passportLifetimeSec: 3600,   // 1 hour (default)
  maxDelegationDepth: 5,       // max delegation hops
});

// ═══════════════════════════════════════════
// 2. Issue a passport for an agent
// ═══════════════════════════════════════════
const { raw, claims } = createAgentPassport(
  "agent_identity_xxx",
  ["read:workspace/docs/*", "execute:tool/rag.search"],
  { scope: "session:chat-123" }
);
// → "st.v1.eyJzdWIi...aGVsbG8.abc123def456"

// ═══════════════════════════════════════════
// 3. Verify a passport
// ═══════════════════════════════════════════
const result = verifyAgentPassport(token);
if (result.status !== "valid") reject();

// ═══════════════════════════════════════════
// 4. Authorize a specific action
// ═══════════════════════════════════════════
const allowed = passportAuthorizes(token, "read:workspace/docs/*");
if (!allowed) throw new Error("Not authorized");

// ═══════════════════════════════════════════
// 5. Delegate capabilities to a child agent
// ═══════════════════════════════════════════
const delegation = delegateCredentials({
  parentPassport: parentToken,
  childAgentIdentityId: "agent_identity_yyy",
  delegatedCapabilities: ["read:workspace/docs/report-*"],
  intent: "Generate weekly report",
});
// delegation.allowed === true if parent has those capabilities

// ═══════════════════════════════════════════
// 6. Exchange for a short-lived task token
// ═══════════════════════════════════════════
const task = exchangePassportForTask({
  parentToken,
  requiredCapability: "execute:tool/gmail.send",
  audience: "gmail-api",
});
// task.expiresAt: 5 minutes from now

// ═══════════════════════════════════════════
// 7. Cross-agent authentication
// ═══════════════════════════════════════════
const challenge = createAuthChallenge("agent_a", "agent_b");
const response = respondToAuthChallenge(challenge, agentBToken);
const verified = verifyAuthResponse(challenge, response);
// verified.verified === true if agent_b is who they claim`}</pre>
      </section>
    </div>
  );
}
