CREATE TABLE "SamlSessionExchange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SamlSessionExchange_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SamlSessionExchange_tokenHash_key" ON "SamlSessionExchange"("tokenHash");
CREATE INDEX "SamlSessionExchange_userId_expiresAt_idx" ON "SamlSessionExchange"("userId", "expiresAt");
CREATE INDEX "SamlSessionExchange_organizationId_expiresAt_idx" ON "SamlSessionExchange"("organizationId", "expiresAt");
CREATE INDEX "SamlSessionExchange_expiresAt_usedAt_idx" ON "SamlSessionExchange"("expiresAt", "usedAt");

ALTER TABLE "SamlSessionExchange"
ADD CONSTRAINT "SamlSessionExchange_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SamlSessionExchange"
ADD CONSTRAINT "SamlSessionExchange_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SamlSessionExchange"
ADD CONSTRAINT "SamlSessionExchange_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "SamlProvider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
