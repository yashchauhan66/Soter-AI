-- Additive persistence for Agent Identity Fabric.
-- No existing tables or data are modified.

CREATE TABLE "IdentityFabricPassport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "capabilitiesJson" JSONB NOT NULL,
    "audience" TEXT,
    "scope" TEXT,
    "parentJti" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityFabricPassport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityFabricRevocation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jti" TEXT NOT NULL,
    "reason" TEXT,
    "revokedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityFabricRevocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityFabricServicePrincipal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "agentIdentityId" TEXT NOT NULL,
    "scopesJson" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IdentityFabricServicePrincipal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityFabricDelegation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentPassportJti" TEXT NOT NULL,
    "childAgentIdentityId" TEXT NOT NULL,
    "policyHash" TEXT NOT NULL,
    "proofHash" TEXT NOT NULL,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityFabricDelegation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdentityFabricChallenge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "sourceAgentId" TEXT NOT NULL,
    "targetAgentId" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "signature" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityFabricChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityFabricPassport_jti_key" ON "IdentityFabricPassport"("jti");
CREATE INDEX "IdentityFabricPassport_projectId_createdAt_idx" ON "IdentityFabricPassport"("projectId", "createdAt");
CREATE INDEX "IdentityFabricPassport_jti_idx" ON "IdentityFabricPassport"("jti");
CREATE INDEX "IdentityFabricPassport_projectId_expiresAt_idx" ON "IdentityFabricPassport"("projectId", "expiresAt");
CREATE INDEX "IdentityFabricPassport_subjectId_idx" ON "IdentityFabricPassport"("subjectId");
CREATE INDEX "IdentityFabricPassport_projectId_revokedAt_idx" ON "IdentityFabricPassport"("projectId", "revokedAt");

CREATE INDEX "IdentityFabricRevocation_projectId_revokedAt_idx" ON "IdentityFabricRevocation"("projectId", "revokedAt");
CREATE INDEX "IdentityFabricRevocation_jti_idx" ON "IdentityFabricRevocation"("jti");
CREATE UNIQUE INDEX "IdentityFabricRevocation_projectId_jti_key" ON "IdentityFabricRevocation"("projectId", "jti");

CREATE UNIQUE INDEX "IdentityFabricServicePrincipal_projectId_provider_principalId_key" ON "IdentityFabricServicePrincipal"("projectId", "provider", "principalId");
CREATE INDEX "IdentityFabricServicePrincipal_projectId_agentIdentityId_idx" ON "IdentityFabricServicePrincipal"("projectId", "agentIdentityId");
CREATE INDEX "IdentityFabricServicePrincipal_projectId_createdAt_idx" ON "IdentityFabricServicePrincipal"("projectId", "createdAt");
CREATE INDEX "IdentityFabricServicePrincipal_provider_principalId_idx" ON "IdentityFabricServicePrincipal"("provider", "principalId");

CREATE UNIQUE INDEX "IdentityFabricDelegation_proofHash_key" ON "IdentityFabricDelegation"("proofHash");
CREATE INDEX "IdentityFabricDelegation_projectId_createdAt_idx" ON "IdentityFabricDelegation"("projectId", "createdAt");
CREATE INDEX "IdentityFabricDelegation_parentPassportJti_idx" ON "IdentityFabricDelegation"("parentPassportJti");
CREATE INDEX "IdentityFabricDelegation_childAgentIdentityId_idx" ON "IdentityFabricDelegation"("childAgentIdentityId");
CREATE INDEX "IdentityFabricDelegation_proofHash_idx" ON "IdentityFabricDelegation"("proofHash");

CREATE UNIQUE INDEX "IdentityFabricChallenge_challenge_key" ON "IdentityFabricChallenge"("challenge");
CREATE INDEX "IdentityFabricChallenge_projectId_createdAt_idx" ON "IdentityFabricChallenge"("projectId", "createdAt");
CREATE INDEX "IdentityFabricChallenge_challenge_idx" ON "IdentityFabricChallenge"("challenge");
CREATE INDEX "IdentityFabricChallenge_sourceAgentId_targetAgentId_idx" ON "IdentityFabricChallenge"("sourceAgentId", "targetAgentId");
