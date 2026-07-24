-- Add optional seat limit for browser-extension licensing.
-- NULL means unlimited (backward-compatible default).
ALTER TABLE "Organization" ADD COLUMN "extensionSeatLimit" INTEGER;
