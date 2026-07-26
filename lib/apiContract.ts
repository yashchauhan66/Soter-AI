export const SOTERAI_API_VERSION = "v1";
export const SOTERAI_CONTRACT_VERSION = "2026-07-26";
export const SOTERAI_OPENAPI_SPEC_PATH = "/api/openapi";

export function isCompatibleSoterApiVersion(version: string) {
  return version.trim().toLowerCase() === SOTERAI_API_VERSION;
}
