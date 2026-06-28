// ── Agent Identity Fabric — Comprehensive Unit Tests ─────────────────────────
// Tests cover: capability engine, passport creation/verification, delegation
// chains, challenge-response auth, IdP integration, and edge cases.
// ────────────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";

// ── Capability Engine ──────────────────────────────────────────────────────

import {
  parseCapability,
  normalizeCapability,
  serializeCapability,
  capabilityMatches,
  hasCapability,
  intersectCapabilities,
  validateCapabilityChain,
  normalizeCapabilities,
  isValidCapability,
} from "../lib/identity-fabric/capabilities";

test("Identity-Fabric 1: parseCapability parses standard capabilities", () => {
  const result = parseCapability("read:workspace/docs/*");
  assert.ok(result !== null);
  assert.equal(result.action, "read");
  assert.equal(result.resource, "workspace/docs/*");
  assert.equal(result.subresource, undefined);
  assert.deepEqual(result.conditions, {});
});

test("Identity-Fabric 2: parseCapability parses capabilities with subresource", () => {
  const result = parseCapability("write:rag/collection/my-collection");
  assert.ok(result !== null);
  assert.equal(result.action, "write");
  assert.equal(result.resource, "rag/collection/my-collection");
  assert.equal(result.subresource, undefined);
});

test("Identity-Fabric 3: parseCapability parses capabilities with conditions", () => {
  const result = parseCapability("execute:tool/gmail.send?sensitivity=high");
  assert.ok(result !== null);
  assert.equal(result.action, "execute");
  assert.equal(result.resource, "tool/gmail.send");
  assert.deepEqual(result.conditions, { sensitivity: "high" });
});

test("Identity-Fabric 4: parseCapability parses capabilities with multiple conditions", () => {
  const result = parseCapability("read:docs?env=prod&region=us-east");
  assert.ok(result !== null);
  assert.deepEqual(result.conditions, { env: "prod", region: "us-east" });
});

test("Identity-Fabric 5: parseCapability returns null for malformed input", () => {
  assert.equal(parseCapability(""), null);
  assert.equal(parseCapability("not-a-capability"), null);
  assert.equal(parseCapability("invalid:"), null);
  assert.equal(parseCapability(":resource"), null);
  assert.equal(parseCapability("unknown:resource"), null);
});

test("Identity-Fabric 6: parseCapability is case-insensitive", () => {
  const upper = parseCapability("READ:Workspace/Docs");
  const lower = parseCapability("read:workspace/docs");
  assert.ok(upper !== null && lower !== null);
  assert.equal(upper.action, lower.action);
  assert.equal(upper.resource, lower.resource);
});

test("Identity-Fabric 7: normalizeCapability round-trips correctly", () => {
  const input = "read:workspace/docs/summary";
  assert.equal(normalizeCapability(input), input);
});

test("Identity-Fabric 8: normalizeCapability returns null for invalid", () => {
  assert.equal(normalizeCapability("bad:"), null);
});

test("Identity-Fabric 9: serializeCapability reconstructs from parsed", () => {
  const original = "read:docs/report?env=staging";
  const parsed = parseCapability(original);
  assert.ok(parsed);
  assert.equal(serializeCapability(parsed), original);
});

test("Identity-Fabric 10: isValidCapability validates correctly", () => {
  assert.equal(isValidCapability("read:docs"), true);
  assert.equal(isValidCapability("write:rag/*"), true);
  assert.equal(isValidCapability("execute:tool/slack?channel=general"), true);
  assert.equal(isValidCapability(""), false);
  assert.equal(isValidCapability("garbage"), false);
});

test("Identity-Fabric 11: capabilityMatches exact match", () => {
  assert.equal(capabilityMatches("read:docs/report", "read:docs/report"), true);
});

test("Identity-Fabric 12: capabilityMatches with glob pattern", () => {
  assert.equal(capabilityMatches("read:docs/*", "read:docs/report"), true);
  assert.equal(capabilityMatches("read:docs/weekly/*", "read:docs/weekly/2024-01"), true);
});

test("Identity-Fabric 13: capabilityMatches with double-star glob", () => {
  assert.equal(capabilityMatches("read:docs/**", "read:docs/deep/nested/file"), true);
});

test("Identity-Fabric 14: capabilityMatches rejects mismatched action", () => {
  assert.equal(capabilityMatches("read:docs/*", "write:docs/report"), false);
});

test("Identity-Fabric 15: capabilityMatches admin action satisfies any", () => {
  assert.equal(capabilityMatches("admin:project/*", "read:project/settings"), true);
  assert.equal(capabilityMatches("admin:project/*", "write:project/config"), true);
  assert.equal(capabilityMatches("admin:project/*", "execute:project/deploy"), true);
});

test("Identity-Fabric 16: capabilityMatches with conditions", () => {
  assert.equal(
    capabilityMatches("read:docs?env=prod", "read:docs?env=prod"),
    true,
  );
});

test("Identity-Fabric 17: hasCapability checks a list", () => {
  const caps = ["read:docs/*", "write:rag/*"];
  assert.equal(hasCapability(caps, "read:docs/report"), true);
  assert.equal(hasCapability(caps, "execute:tool/api"), false);
});

test("Identity-Fabric 18: intersectCapabilities preserves subset", () => {
  const parent = ["read:docs/*", "write:rag/*"];
  const child = ["read:docs/report"];
  const result = intersectCapabilities(parent, child);
  assert.deepEqual(result, ["read:docs/report"]);
});

test("Identity-Fabric 19: intersectCapabilities rejects out-of-scope child", () => {
  const parent = ["read:docs/*"];
  const child = ["write:rag/data"];
  assert.deepEqual(intersectCapabilities(parent, child), []);
});

test("Identity-Fabric 20: intersectCapabilities handles admin parent", () => {
  const parent = ["admin:project/*"];
  const child = ["read:project/settings", "write:project/config"];
  const result = intersectCapabilities(parent, child);
  assert.equal(result.length, 2);
});

test("Identity-Fabric 21: validateCapabilityChain validates a valid chain", () => {
  const chain = [
    { jti: "jti_1", capabilities: ["read:docs/*", "write:rag/*"], depth: 0 },
    { jti: "jti_2", capabilities: ["read:docs/report"], depth: 1 },
  ];
  const result = validateCapabilityChain(chain);
  assert.equal(result.valid, true);
  assert.deepEqual(result.violations, []);
});

test("Identity-Fabric 22: validateCapabilityChain rejects escalation", () => {
  const chain = [
    { jti: "jti_1", capabilities: ["read:docs/*"], depth: 0 },
    { jti: "jti_2", capabilities: ["admin:project/*"], depth: 1 },
  ];
  const result = validateCapabilityChain(chain);
  assert.equal(result.valid, false);
  assert.ok(result.violations.length > 0);
});

test("Identity-Fabric 23: validateCapabilityChain rejects empty chain", () => {
  const result = validateCapabilityChain([]);
  assert.equal(result.valid, false);
});

test("Identity-Fabric 24: validateCapabilityChain rejects non-increasing depth", () => {
  const chain = [
    { jti: "jti_1", capabilities: ["read:docs/*"], depth: 2 },
    { jti: "jti_2", capabilities: ["read:docs/report"], depth: 1 },
  ];
  const result = validateCapabilityChain(chain);
  assert.equal(result.valid, false);
});

test("Identity-Fabric 25: normalizeCapabilities deduplicates and sorts", () => {
  const result = normalizeCapabilities(["write:rag/*", "read:docs/*", "read:docs/*"]);
  assert.deepEqual(result, ["read:docs/*", "write:rag/*"]);
});

// ── Passport System ─────────────────────────────────────────────────────────

import {
  configureIdentityFabric,
  createAgentPassport,
  decodeAndVerifyPassport,
  verifyAgentPassport,
  decodePassportUnverified,
  createPassportJti,
  revokePassportByJti,
  isPassportRevoked,
  isPassportRevokedByToken,
  refreshAgentPassport,
  passportAuthorizes,
  revokedPassportCount,
} from "../lib/identity-fabric/passport";

// Use a deterministic secret for testing.
const TEST_SECRET = "test-secret-for-identity-fabric-tests-2026";

// Make sure the fabric has a consistent test secret.
configureIdentityFabric({ signingSecret: TEST_SECRET, passportLifetimeSec: 3600 });

test("Identity-Fabric 26: createAgentPassport issues a valid token", () => {
  const { raw, claims } = createAgentPassport("agent_identity_demo_001", [
    "read:docs/*",
    "write:rag/*",
  ]);
  assert.ok(raw.startsWith("st.v1."));
  assert.equal(raw.split(".").length, 4);
  assert.equal(claims.sub, "agent_identity_demo_001");
  assert.equal(claims.iss, "soter-identity-fabric");
  assert.deepEqual(claims.cap, ["read:docs/*", "write:rag/*"]);
  assert.ok(claims.iat > 0);
  assert.ok(claims.exp > claims.iat);
  assert.ok(claims.jti.startsWith("st_"));
});

test("Identity-Fabric 27: decodeAndVerifyPassport verifies a valid token", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const decoded = decodeAndVerifyPassport(raw);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.active, true);
  assert.equal(decoded.status, "valid");
  assert.equal(decoded.claims.sub, "agent_001");
});

test("Identity-Fabric 28: decodeAndVerifyPassport rejects tampered payload", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const parts = raw.split(".");
  // Tamper with the payload section.
  const tampered = [parts[0], parts[1], "dGFtcGVyZWQ", parts[3]].join(".");
  const decoded = decodeAndVerifyPassport(tampered);
  assert.equal(decoded.valid, false);
  assert.equal(decoded.status, "invalid-signature");
});

test("Identity-Fabric 29: decodeAndVerifyPassport rejects tampered signature", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const parts = raw.split(".");
  const tampered = [parts[0], parts[1], parts[2], "deadbeef"].join(".");
  const decoded = decodeAndVerifyPassport(tampered);
  assert.equal(decoded.valid, false);
});

test("Identity-Fabric 30: decodeAndVerifyPassport rejects malformed token", () => {
  assert.equal(decodeAndVerifyPassport("not-a-token").valid, false);
  assert.equal(decodeAndVerifyPassport("st.v1.too.few").valid, false);
  assert.equal(decodeAndVerifyPassport("st.v1.a.b.c.d.e").valid, false);
});

test("Identity-Fabric 31: decodeAndVerifyPassport rejects wrong prefix", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const wrong = raw.replace("st.", "xx.");
  assert.equal(decodeAndVerifyPassport(wrong).status, "invalid-signature");
});

test("Identity-Fabric 32: decodeAndVerifyPassport detects expired token", () => {
  // Create a passport that expired 1 second ago.
  const { raw, claims } = createAgentPassport("agent_001", ["read:docs/*"], {
    lifetimeSec: -1,
  });
  // Manually force exp to be in the past.
  const now = Math.floor(Date.now() / 1000);
  const pastClaims = { ...claims, iat: now - 10, exp: now - 1 };
  const manExpired = JSON.stringify(pastClaims);
  const b64 = Buffer.from(manExpired, "utf8").toString("base64url");
  const sig = require("crypto")
    .createHash("sha256")
    .update(`identity-fabric.v1:${manExpired}:${TEST_SECRET}`)
    .digest("hex");
  const expiredToken = `st.v1.${b64}.${sig}`;

  const decoded = decodeAndVerifyPassport(expiredToken);
  assert.equal(decoded.active, false);
  assert.equal(decoded.status, "expired");
});

test("Identity-Fabric 33: verifyAgentPassport alias works", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const result = verifyAgentPassport(raw);
  assert.equal(result.valid, true);
});

test("Identity-Fabric 34: decodePassportUnverified extracts claims", () => {
  const { raw, claims } = createAgentPassport("agent_001", ["read:docs/*"]);
  const unverified = decodePassportUnverified(raw);
  assert.ok(unverified.claims !== null);
  assert.equal(unverified.claims!.sub, claims.sub);
});

test("Identity-Fabric 35: decodePassportUnverified returns null for bad token", () => {
  const result = decodePassportUnverified("bad-token");
  assert.equal(result.claims, null);
});

test("Identity-Fabric 36: createPassportJti generates unique IDs", () => {
  const jti1 = createPassportJti();
  const jti2 = createPassportJti();
  assert.ok(jti1.startsWith("st_"));
  assert.notEqual(jti1, jti2);
});

test("Identity-Fabric 37: passport with audience and scope is decodeable", () => {
  const { claims } = createAgentPassport("agent_001", ["read:docs/*"], {
    audience: "rag-service",
    scope: "search",
  });
  assert.equal(claims.aud, "rag-service");
  assert.equal(claims.scope, "search");
});

test("Identity-Fabric 38: passport with parentJti and depth is decodeable", () => {
  const { claims } = createAgentPassport("agent_001", ["read:docs/*"], {
    parentJti: "st_parent_jti",
    depth: 1,
  });
  assert.equal(claims.prt, "st_parent_jti");
  assert.equal(claims.depth, 1);
});

test("Identity-Fabric 39: passportAuthorizes authorizes valid capability", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  assert.equal(passportAuthorizes(raw, "read:docs/report"), true);
});

test("Identity-Fabric 40: passportAuthorizes denies unauthorized capability", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  assert.equal(passportAuthorizes(raw, "write:rag/data"), false);
});

// ── Revocation ─────────────────────────────────────────────────────────────

test("Identity-Fabric 41: revokePassportByJti marks as revoked", () => {
  const { claims } = createAgentPassport("agent_001", ["read:docs/*"]);
  assert.equal(isPassportRevoked(claims.jti), false);
  revokePassportByJti(claims.jti, "admin-revoked");
  assert.equal(isPassportRevoked(claims.jti), true);
});

test("Identity-Fabric 42: isPassportRevokedByToken checks from token string", () => {
  const { raw, claims } = createAgentPassport("agent_002", ["read:docs/*"]);
  assert.equal(isPassportRevokedByToken(raw), false);
  revokePassportByJti(claims.jti, "compromised");
  assert.equal(isPassportRevokedByToken(raw), true);
});

test("Identity-Fabric 43: passportAuthorizes returns false for revoked passport", () => {
  const { raw, claims } = createAgentPassport("agent_003", ["read:docs/*"]);
  revokePassportByJti(claims.jti, "compromised");
  assert.equal(passportAuthorizes(raw, "read:docs/report"), false);
});

test("Identity-Fabric 44: revokedPassportCount tracks count", () => {
  const countBefore = revokedPassportCount();
  const { claims } = createAgentPassport("agent_count", ["read:docs/*"]);
  revokePassportByJti(claims.jti, "admin-revoked");
  assert.ok(revokedPassportCount() > countBefore);
});

test("Identity-Fabric 45: refreshAgentPassport revokes old and issues new", () => {
  const { raw, claims } = createAgentPassport("agent_001", ["read:docs/*"]);
  const refreshed = refreshAgentPassport(raw);
  assert.ok(refreshed !== null);
  assert.equal(refreshed.claims.sub, claims.sub);
  assert.deepEqual(refreshed.claims.cap, claims.cap);
  // Old JTI should now be revoked.
  assert.equal(isPassportRevoked(claims.jti), true);
});

test("Identity-Fabric 46: refreshAgentPassport returns null for invalid token", () => {
  assert.equal(refreshAgentPassport("invalid-token"), null);
});

// ── Delegation ─────────────────────────────────────────────────────────────

import {
  exchangePassportForTask,
  delegateCredentials,
  createDelegationProof,
  verifyDelegationChain,
  isTaskToken,
  getTokenTtl,
} from "../lib/identity-fabric/delegation";

test("Identity-Fabric 47: exchangePassportForTask creates task token", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"], {
    audience: "rag-service",
  });
  const taskToken = exchangePassportForTask({
    parentToken: raw,
    requiredCapability: "read:docs/report",
    audience: "rag-service",
  });
  assert.ok(taskToken !== null);
  assert.ok(taskToken.raw.startsWith("st.v1."));
  assert.ok(taskToken.expiresAt.getTime() > Date.now());
  assert.equal(taskToken.parentJti, decodePassportUnverified(raw).claims!.jti);
});

test("Identity-Fabric 48: exchangePassportForTask rejects missing capability", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const taskToken = exchangePassportForTask({
    parentToken: raw,
    requiredCapability: "admin:project/*",
    audience: "admin-service",
  });
  assert.equal(taskToken, null);
});

test("Identity-Fabric 49: exchangePassportForTask rejects invalid parent", () => {
  const taskToken = exchangePassportForTask({
    parentToken: "invalid-token",
    requiredCapability: "read:docs/*",
    audience: "service",
  });
  assert.equal(taskToken, null);
});

test("Identity-Fabric 50: delegateCredentials delegates valid capabilities", () => {
  const { raw } = createAgentPassport("parent-agent", [
    "read:docs/*",
    "write:rag/*",
  ]);
  const result = delegateCredentials({
    parentPassport: raw,
    childAgentIdentityId: "child-agent",
    delegatedCapabilities: ["read:docs/report"],
    intent: "search assistance",
  });
  assert.equal(result.allowed, true);
  assert.deepEqual(result.resultingCapabilities, ["read:docs/report"]);
  assert.ok(result.proof !== null);
  assert.equal(result.proof.format, "soter.delegation.v1");
  assert.equal(result.proof.childAgentIdentityId, "child-agent");
});

test("Identity-Fabric 51: delegateCredentials rejects escalation", () => {
  const { raw } = createAgentPassport("parent-agent", ["read:docs/*"]);
  const result = delegateCredentials({
    parentPassport: raw,
    childAgentIdentityId: "child-agent",
    delegatedCapabilities: ["admin:project/*"],
    intent: "privilege escalation attempt",
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.resultingCapabilities, []);
});

test("Identity-Fabric 52: delegateCredentials rejects invalid parent passport", () => {
  const result = delegateCredentials({
    parentPassport: "invalid",
    childAgentIdentityId: "child",
    delegatedCapabilities: ["read:docs/*"],
    intent: "test",
  });
  assert.equal(result.allowed, false);
});

test("Identity-Fabric 53: createDelegationProof creates deterministic proofs", () => {
  const proof1 = createDelegationProof({
    parentPassportJti: "jti_parent",
    childAgentIdentityId: "child_001",
    policy: ["read:docs/*"],
    depth: 1,
  });
  const proof2 = createDelegationProof({
    parentPassportJti: "jti_parent",
    childAgentIdentityId: "child_001",
    policy: ["read:docs/*"],
    depth: 1,
  });
  assert.equal(proof1.proofHash, proof2.proofHash);
  assert.equal(proof1.policyHash, proof2.policyHash);
  assert.equal(proof1.depth, 1);
});

test("Identity-Fabric 54: verifyDelegationChain validates a valid chain", () => {
  const { raw: rootToken } = createAgentPassport("root-agent", [
    "read:docs/*",
    "write:rag/*",
  ]);
  const rootClaims = decodePassportUnverified(rootToken).claims!;

  const { raw: childToken } = createAgentPassport("child-agent", ["read:docs/*"], {
    parentJti: rootClaims.jti,
    depth: 1,
  });

  const chain = [
    { passportToken: rootToken },
    { passportToken: childToken },
  ];
  const result = verifyDelegationChain(chain);
  assert.equal(result.valid, true);
});

test("Identity-Fabric 55: verifyDelegationChain detects JTI mismatch", () => {
  const { raw: rootToken } = createAgentPassport("root-agent", [
    "read:docs/*",
  ]);
  // Child references a non-existent parent JTI.
  const { raw: childToken } = createAgentPassport("child-agent", ["read:docs/*"], {
    parentJti: "non-existent-jti",
    depth: 1,
  });

  const chain = [
    { passportToken: rootToken },
    { passportToken: childToken },
  ];
  const result = verifyDelegationChain(chain);
  assert.equal(result.valid, false);
});

test("Identity-Fabric 56: verifyDelegationChain rejects empty chain", () => {
  const result = verifyDelegationChain([]);
  assert.equal(result.valid, false);
});

test("Identity-Fabric 57: isTaskToken detects task scope", () => {
  const { claims: regular } = createAgentPassport("agent_001", ["read:docs/*"]);
  assert.equal(isTaskToken(regular), false);

  const { claims: task } = createAgentPassport("agent_001", ["read:docs/*"], {
    scope: "task:search",
  });
  assert.equal(isTaskToken(task), true);
});

test("Identity-Fabric 58: getTokenTtl returns remaining seconds", () => {
  const { claims } = createAgentPassport("agent_001", ["read:docs/*"]);
  const ttl = getTokenTtl(claims);
  assert.ok(ttl > 0);
  assert.ok(ttl <= 3600); // Our configured lifetime
});

// ── Cross-Agent Verification ───────────────────────────────────────────────

import {
  createAuthChallenge,
  respondToAuthChallenge,
  verifyAuthResponse,
  verifyAgentIdentity,
  isChallengeExpired,
  challengeTtl,
} from "../lib/identity-fabric/verification";

test("Identity-Fabric 59: createAuthChallenge generates challenge", () => {
  const challenge = createAuthChallenge("source-agent", "target-agent");
  assert.ok(challenge.challenge.length > 0);
  assert.equal(challenge.sourceAgentId, "source-agent");
  assert.equal(challenge.targetAgentId, "target-agent");
  assert.ok(challenge.expiresAt > Math.floor(Date.now() / 1000));
});

test("Identity-Fabric 60: respondToAuthChallenge signs valid challenge", () => {
  const { raw: passport } = createAgentPassport("agent-responder", [
    "read:docs/*",
  ]);
  const challenge = createAuthChallenge("source-agent", "agent-responder");
  const response = respondToAuthChallenge(challenge, passport);
  assert.ok(response !== null);
  assert.equal(response.challenge, challenge.challenge);
  assert.ok(response.signature.length > 0);
  assert.equal(response.passportToken, passport);
});

test("Identity-Fabric 61: respondToAuthChallenge rejects expired challenge", () => {
  const { raw: passport } = createAgentPassport("agent-responder", [
    "read:docs/*",
  ]);
  const expiredChallenge = {
    challenge: "old-nonce",
    targetAgentId: "agent-responder",
    sourceAgentId: "source-agent",
    expiresAt: Math.floor(Date.now() / 1000) - 10,
  };
  assert.equal(respondToAuthChallenge(expiredChallenge, passport), null);
});

test("Identity-Fabric 62: respondToAuthChallenge rejects mismatched subject", () => {
  const { raw: passport } = createAgentPassport("wrong-agent", ["read:docs/*"]);
  const challenge = createAuthChallenge("source-agent", "expected-agent");
  const response = respondToAuthChallenge(challenge, passport);
  assert.equal(response, null);
});

test("Identity-Fabric 63: verifyAuthResponse verifies valid response", () => {
  const { raw: passport } = createAgentPassport("target-agent", ["read:docs/*"]);
  const challenge = createAuthChallenge("source-agent", "target-agent");
  const response = respondToAuthChallenge(challenge, passport);
  assert.ok(response !== null);

  const result = verifyAuthResponse(challenge, response);
  assert.equal(result.verified, true);
  assert.equal(result.agentIdentityId, "target-agent");
});

test("Identity-Fabric 64: verifyAuthResponse rejects expired challenge", () => {
  const expiredChallenge = {
    challenge: "old",
    targetAgentId: "agent",
    sourceAgentId: "source",
    expiresAt: Math.floor(Date.now() / 1000) - 10,
  };
  const response = {
    challenge: "old",
    signature: "sig",
    passportToken: "token",
    respondedAt: Math.floor(Date.now() / 1000),
  };
  const result = verifyAuthResponse(expiredChallenge, response);
  assert.equal(result.verified, false);
});

test("Identity-Fabric 65: verifyAuthResponse detects challenge mismatch (replay)", () => {
  const challenge = createAuthChallenge("source", "target");
  const differentChallenge = {
    ...challenge,
    challenge: "different-nonce",
  };
  const response = {
    challenge: challenge.challenge,
    signature: "some-sig",
    passportToken: "some-token",
    respondedAt: Math.floor(Date.now() / 1000),
  };
  const result = verifyAuthResponse(differentChallenge, response);
  assert.equal(result.verified, false);
  assert.match(result.reason!, /mismatch/i);
});

test("Identity-Fabric 66: verifyAgentIdentity verifies subject", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const result = verifyAgentIdentity(raw, "agent_001");
  assert.equal(result.verified, true);
});

test("Identity-Fabric 67: verifyAgentIdentity rejects wrong expected agent", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const result = verifyAgentIdentity(raw, "agent_002");
  assert.equal(result.verified, false);
});

test("Identity-Fabric 68: verifyAgentIdentity checks required capability", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const hasIt = verifyAgentIdentity(raw, "agent_001", "read:docs/report");
  assert.equal(hasIt.verified, true);

  const lacksIt = verifyAgentIdentity(raw, "agent_001", "admin:project/*");
  assert.equal(lacksIt.verified, false);
});

test("Identity-Fabric 69: isChallengeExpired detects expiry", () => {
  const fresh = createAuthChallenge("src", "tgt");
  assert.equal(isChallengeExpired(fresh), false);

  const stale = { ...fresh, expiresAt: Math.floor(Date.now() / 1000) - 60 };
  assert.equal(isChallengeExpired(stale), true);
});

test("Identity-Fabric 70: challengeTtl returns remaining time", () => {
  const challenge = createAuthChallenge("src", "tgt");
  const ttl = challengeTtl(challenge);
  assert.ok(ttl > 0);
  assert.ok(ttl <= 120); // Default challenge expiry
});

// ── IdP Integration ─────────────────────────────────────────────────────────

import {
  registerAgentServicePrincipal,
  getServicePrincipal,
  getAgentServicePrincipals,
  touchServicePrincipal,
  unregisterAgentServicePrincipal,
  exchangeIdpTokenForPassport,
  generateAgentScimExternalId,
  buildAgentScimProfile,
  servicePrincipalCount,
  listAllServicePrincipals,
} from "../lib/identity-fabric/idp";

// Reset state before IdP tests by noting the starting count.
const idpStartCount = servicePrincipalCount();

test("Identity-Fabric 71: registerAgentServicePrincipal creates mapping", () => {
  const sp = registerAgentServicePrincipal(
    "sp_okta_001",
    "okta",
    "agent_identity_001",
    ["rag:search", "agent:execute"],
  );
  assert.equal(sp.principalId, "sp_okta_001");
  assert.equal(sp.provider, "okta");
  assert.equal(sp.agentIdentityId, "agent_identity_001");
  assert.deepEqual(sp.scopes, ["rag:search", "agent:execute"]);
  assert.ok(sp.createdAt instanceof Date);
});

test("Identity-Fabric 72: getServicePrincipal retrieves by provider+id", () => {
  const sp = getServicePrincipal("okta", "sp_okta_001");
  assert.ok(sp !== undefined);
  assert.equal(sp!.agentIdentityId, "agent_identity_001");
});

test("Identity-Fabric 73: getServicePrincipal returns undefined for unknown", () => {
  assert.equal(getServicePrincipal("okta", "nonexistent"), undefined);
});

test("Identity-Fabric 74: getAgentServicePrincipals finds all for agent", () => {
  registerAgentServicePrincipal("sp_azure_001", "azure-ad", "agent_identity_001", ["read:rag"]);
  const principals = getAgentServicePrincipals("agent_identity_001");
  assert.ok(principals.length >= 2);
  assert.ok(principals.some((sp) => sp.provider === "azure-ad"));
});

test("Identity-Fabric 75: registerAgentServicePrincipal rejects invalid provider", () => {
  assert.throws(() => {
    registerAgentServicePrincipal("bad", "unsupported" as any, "agent_001");
  }, /Unsupported IdP provider/);
});

test("Identity-Fabric 76: touchServicePrincipal updates lastUsedAt", () => {
  touchServicePrincipal("okta", "sp_okta_001");
  const sp = getServicePrincipal("okta", "sp_okta_001");
  assert.ok(sp !== undefined);
  assert.ok(sp!.lastUsedAt !== undefined);
});

test("Identity-Fabric 77: unregisterAgentServicePrincipal removes mapping", () => {
  registerAgentServicePrincipal("sp_temp", "generic-saml", "agent_temp");
  assert.ok(getServicePrincipal("generic-saml", "sp_temp") !== undefined);
  const removed = unregisterAgentServicePrincipal("generic-saml", "sp_temp");
  assert.equal(removed, true);
  assert.equal(getServicePrincipal("generic-saml", "sp_temp"), undefined);
});

test("Identity-Fabric 78: unregisterAgentServicePrincipal returns false for missing", () => {
  assert.equal(unregisterAgentServicePrincipal("okta", "definitely-not-there"), false);
});

test("Identity-Fabric 79: exchangeIdpTokenForPassport creates passport from principal", () => {
  const result = exchangeIdpTokenForPassport(
    { idpToken: "okta-jwt", provider: "okta", organizationId: "org_001" },
    "agent_identity_001",
  );
  assert.ok(result !== null);
  assert.ok(result.raw.startsWith("st.v1."));
  assert.equal(result.principal.agentIdentityId, "agent_identity_001");
});

test("Identity-Fabric 80: exchangeIdpTokenForPassport returns null for unknown provider", () => {
  const result = exchangeIdpTokenForPassport(
    { idpToken: "jwt", provider: "unknown" as any, organizationId: "org" },
    "agent_001",
  );
  assert.equal(result, null);
});

test("Identity-Fabric 81: exchangeIdpTokenForPassport returns null for unmapped agent", () => {
  const result = exchangeIdpTokenForPassport(
    { idpToken: "jwt", provider: "okta", organizationId: "org" },
    "agent_unmapped",
  );
  assert.equal(result, null);
});

test("Identity-Fabric 82: generateAgentScimExternalId is deterministic", () => {
  const id1 = generateAgentScimExternalId("agent_001", "org_001");
  const id2 = generateAgentScimExternalId("agent_001", "org_001");
  assert.equal(id1, id2);
  assert.equal(id1.length, 32);

  // Different org produces different ID.
  const id3 = generateAgentScimExternalId("agent_001", "org_002");
  assert.notEqual(id1, id3);
});

test("Identity-Fabric 83: buildAgentScimProfile returns correct shape", () => {
  const profile = buildAgentScimProfile("support-bot", "agent_001", "org_001");
  assert.equal(profile.displayName, "Agent: support-bot");
  assert.ok(profile.userName.includes("soter-identity-fabric"));
  assert.equal(profile.active, true);
  assert.equal(profile.externalId.length, 32);
});

test("Identity-Fabric 84: servicePrincipalCount returns positive count", () => {
  const count = servicePrincipalCount();
  assert.ok(count > idpStartCount);
});

test("Identity-Fabric 85: listAllServicePrincipals returns all entries", () => {
  const all = listAllServicePrincipals();
  assert.equal(all.length, servicePrincipalCount());
});

// ── Dashboard & API Routes ─────────────────────────────────────────────────

test("Identity-Fabric 86: dashboard page exists", () => {
  assert.equal(existsSync("app/dashboard/identity-fabric/page.tsx"), true);
});

test("Identity-Fabric 87: identity-fabric module files exist", () => {
  assert.equal(existsSync("lib/identity-fabric/types.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/capabilities.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/passport.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/delegation.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/verification.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/idp.ts"), true);
  assert.equal(existsSync("lib/identity-fabric/index.ts"), true);
});

test("Identity-Fabric 88: Prisma models exist in schema", () => {
  const schema = require("fs").readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /model IdentityFabricPassport/);
  assert.match(schema, /model IdentityFabricRevocation/);
  assert.match(schema, /model IdentityFabricServicePrincipal/);
  assert.match(schema, /model IdentityFabricDelegation/);
  assert.match(schema, /model IdentityFabricChallenge/);
});

// ── Barrel Export Verification ─────────────────────────────────────────────

import * as identityFabric from "../lib/identity-fabric";

test("Identity-Fabric 89: barrel exports all public APIs", () => {
  // Capability engine
  assert.equal(typeof identityFabric.parseCapability, "function");
  assert.equal(typeof identityFabric.capabilityMatches, "function");
  assert.equal(typeof identityFabric.hasCapability, "function");
  assert.equal(typeof identityFabric.intersectCapabilities, "function");
  assert.equal(typeof identityFabric.validateCapabilityChain, "function");

  // Passport system
  assert.equal(typeof identityFabric.createAgentPassport, "function");
  assert.equal(typeof identityFabric.decodeAndVerifyPassport, "function");
  assert.equal(typeof identityFabric.verifyAgentPassport, "function");
  assert.equal(typeof identityFabric.passportAuthorizes, "function");
  assert.equal(typeof identityFabric.revokePassportByJti, "function");

  // Delegation
  assert.equal(typeof identityFabric.exchangePassportForTask, "function");
  assert.equal(typeof identityFabric.delegateCredentials, "function");
  assert.equal(typeof identityFabric.verifyDelegationChain, "function");

  // Verification
  assert.equal(typeof identityFabric.createAuthChallenge, "function");
  assert.equal(typeof identityFabric.respondToAuthChallenge, "function");
  assert.equal(typeof identityFabric.verifyAuthResponse, "function");
  assert.equal(typeof identityFabric.verifyAgentIdentity, "function");

  // IdP
  assert.equal(typeof identityFabric.registerAgentServicePrincipal, "function");
  assert.equal(typeof identityFabric.exchangeIdpTokenForPassport, "function");
  assert.equal(typeof identityFabric.buildAgentScimProfile, "function");
});

// ── Edge Cases ─────────────────────────────────────────────────────────────

test("Identity-Fabric 90: empty capabilities list still creates a passport", () => {
  const { raw } = createAgentPassport("agent_empty", []);
  const decoded = decodeAndVerifyPassport(raw);
  assert.equal(decoded.valid, true);
  assert.deepEqual(decoded.claims.cap, []);
});

test("Identity-Fabric 91: passport with all optional fields", () => {
  const { claims } = createAgentPassport("agent_full", ["read:docs/*"], {
    audience: "all-services",
    scope: "full-access",
    parentJti: "st_parent",
    depth: 3,
  });
  assert.equal(claims.aud, "all-services");
  assert.equal(claims.scope, "full-access");
  assert.equal(claims.prt, "st_parent");
  assert.equal(claims.depth, 3);
});

test("Identity-Fabric 92: capabilityMatches with strict conditions fails mismatch", () => {
  assert.equal(
    capabilityMatches("read:docs?env=prod", "read:docs?env=staging", {
      strictConditions: true,
    }),
    false,
  );
});

test("Identity-Fabric 93: capabilityMatches strict-to-broad false requires exact resource", () => {
  assert.equal(
    capabilityMatches("read:docs/report", "read:docs/other", {
      allowStrictToBroad: false,
    }),
    false,
  );
});

test("Identity-Fabric 94: delegateCredentials exceeding depth returns violations", () => {
  configureIdentityFabric({
    signingSecret: TEST_SECRET,
    maxDelegationDepth: 1,
    passportLifetimeSec: 3600,
  });

  try {
    const { raw: root } = createAgentPassport("root", ["read:docs/*"], {
      depth: 0,
    });

    // First delegation should work (depth 0 → 1)
    const firstDelegate = delegateCredentials({
      parentPassport: root,
      childAgentIdentityId: "child_1",
      delegatedCapabilities: ["read:docs/report"],
      intent: "first hop",
    });
    assert.equal(firstDelegate.allowed, true);

    // To exceed depth, need child passport at depth 1.
    const parentClaims = decodePassportUnverified(root).claims!;
    const { raw: childPass } = createAgentPassport("child_1", ["read:docs/report"], {
      parentJti: parentClaims.jti,
      depth: 1,
    });

    const secondDelegate = delegateCredentials({
      parentPassport: childPass,
      childAgentIdentityId: "child_2",
      delegatedCapabilities: ["read:docs/report"],
      intent: "second hop",
    });
    assert.equal(secondDelegate.allowed, false);
    assert.ok(secondDelegate.violations.some((v) => /depth/i.test(v)));
  } finally {
    // Reset config for other tests
    configureIdentityFabric({
      signingSecret: TEST_SECRET,
      maxDelegationDepth: 5,
      passportLifetimeSec: 3600,
    });
  }
});

test("Identity-Fabric 95: verifyDelegationChain exceeds max depth", () => {
  configureIdentityFabric({
    signingSecret: TEST_SECRET,
    maxDelegationDepth: 2,
    passportLifetimeSec: 3600,
  });

  // Chain with 5 links should exceed max depth (maxDepth + 1 = 3)
  const chain = [
    { passportToken: createAgentPassport("a", ["read:docs/*"]).raw },
    { passportToken: createAgentPassport("b", ["read:docs/*"], { depth: 1 }).raw },
    { passportToken: createAgentPassport("c", ["read:docs/*"], { depth: 2 }).raw },
    { passportToken: createAgentPassport("d", ["read:docs/*"], { depth: 3 }).raw },
    { passportToken: createAgentPassport("e", ["read:docs/*"], { depth: 4 }).raw },
  ];
  const result = verifyDelegationChain(chain);
  assert.equal(result.valid, false);

  configureIdentityFabric({
    signingSecret: TEST_SECRET,
    maxDelegationDepth: 5,
    passportLifetimeSec: 3600,
  });
});

test("Identity-Fabric 96: unverified decode preserves base64 padding edge case", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*"]);
  const result = decodePassportUnverified(raw);
  assert.ok(result.claims !== null);
  assert.equal(result.claims!.sub, "agent_001");
});

test("Identity-Fabric 97: exchange fails beyond max delegation depth", () => {
  // Create a passport already at max depth (5).
  const { raw: deepToken } = createAgentPassport("deep_agent", ["read:docs/*"], {
    depth: 5,
  });

  // Exchanging for a task token would push depth to 6, exceeding max of 5.
  const result = exchangePassportForTask({
    parentToken: deepToken,
    requiredCapability: "read:docs/report",
    audience: "service",
  });
  assert.equal(result, null);

  // A passport at depth 4 should still be exchangeable (depth would be 5).
  const { raw: nearLimitToken } = createAgentPassport("near_agent", ["read:docs/*"], {
    depth: 4,
  });
  const allowed = exchangePassportForTask({
    parentToken: nearLimitToken,
    requiredCapability: "read:docs/report",
    audience: "service",
  });
  assert.ok(allowed !== null);
});

test("Identity-Fabric 98: verifyAuthResponse rejects wrong signature", () => {
  const challenge = createAuthChallenge("source", "target");
  const wrongSigResponse = {
    challenge: challenge.challenge,
    signature: "0000000000000000000000000000000000000000000000000000000000000000",
    passportToken: createAgentPassport("target", ["read:docs/*"]).raw,
    respondedAt: Math.floor(Date.now() / 1000),
  };
  const result = verifyAuthResponse(challenge, wrongSigResponse);
  assert.equal(result.verified, false);
});

test("Identity-Fabric 99: verifyAgentIdentity rejects invalid token", () => {
  const result = verifyAgentIdentity("not-a-token", "agent_001");
  assert.equal(result.verified, false);
  assert.ok(result.reason);
});

test("Identity-Fabric 100: refreshAgentPassport preserves optional fields", () => {
  const { raw } = createAgentPassport("agent_001", ["read:docs/*", "write:rag/*"], {
    audience: "test-service",
    scope: "full",
    depth: 2,
    parentJti: "st_parent_test",
  });
  const refreshed = refreshAgentPassport(raw);
  assert.ok(refreshed !== null);
  assert.equal(refreshed.claims.aud, "test-service");
  assert.equal(refreshed.claims.scope, "full");
  assert.equal(refreshed.claims.depth, 2);
  assert.equal(refreshed.claims.prt, "st_parent_test");
  // Capabilities preserved
  assert.deepEqual(refreshed.claims.cap, ["read:docs/*", "write:rag/*"]);
});
