CREATE TABLE "EmailVerificationOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationOtp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmailVerificationOtp_userId_createdAt_idx"
ON "EmailVerificationOtp"("userId", "createdAt");

CREATE INDEX "EmailVerificationOtp_userId_expiresAt_idx"
ON "EmailVerificationOtp"("userId", "expiresAt");

ALTER TABLE "EmailVerificationOtp"
ADD CONSTRAINT "EmailVerificationOtp_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
