export const SOTERAI_API_VERSION = "v1";
export const SOTERAI_CONTRACT_VERSION = "2026-07-26";
export const SOTERAI_SDK_NAME = "@soterai/core";
export const SOTERAI_SDK_VERSION = "0.2.0";

export interface SoterApiContract {
  apiVersion: typeof SOTERAI_API_VERSION;
  contractVersion: typeof SOTERAI_CONTRACT_VERSION;
  sdkName: typeof SOTERAI_SDK_NAME;
  sdkVersion: typeof SOTERAI_SDK_VERSION;
}

export const SOTERAI_API_CONTRACT: SoterApiContract = {
  apiVersion: SOTERAI_API_VERSION,
  contractVersion: SOTERAI_CONTRACT_VERSION,
  sdkName: SOTERAI_SDK_NAME,
  sdkVersion: SOTERAI_SDK_VERSION,
};

export function isCompatibleSoterApiVersion(version: string) {
  return version.trim().toLowerCase() === SOTERAI_API_VERSION;
}
