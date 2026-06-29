-- Model artifact scanner: persist scan results for audit trail and analytics.
CREATE TABLE "ModelArtifactScan" (
    "id"               TEXT NOT NULL,
    "organizationId"   TEXT NOT NULL,
    "projectId"        TEXT,
    "filename"         TEXT NOT NULL,
    "format"           TEXT NOT NULL,
    "sizeBytes"        INTEGER NOT NULL,
    "sha256"           TEXT NOT NULL,
    "verdict"          TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "riskScore"        INTEGER NOT NULL DEFAULT 0,
    "highestSeverity"  TEXT NOT NULL DEFAULT 'LOW',
    "findingCount"     INTEGER NOT NULL DEFAULT 0,
    "report"           JSONB NOT NULL,
    "scannedById"      TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModelArtifactScan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ModelArtifactScan_organizationId_createdAt_idx" ON "ModelArtifactScan"("organizationId", "createdAt");
CREATE INDEX "ModelArtifactScan_organizationId_verdict_idx" ON "ModelArtifactScan"("organizationId", "verdict");
CREATE INDEX "ModelArtifactScan_sha256_idx" ON "ModelArtifactScan"("sha256");
CREATE INDEX "ModelArtifactScan_projectId_idx" ON "ModelArtifactScan"("projectId");
