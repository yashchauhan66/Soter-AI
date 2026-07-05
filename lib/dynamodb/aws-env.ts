const BLANK_CREDENTIAL_ENV_VARS = [
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_PROFILE",
] as const;

export function unsetBlankAwsCredentialEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const removed: string[] = [];
  for (const name of BLANK_CREDENTIAL_ENV_VARS) {
    if (env[name] !== undefined && env[name]?.trim() === "") {
      delete env[name];
      removed.push(name);
    }
  }
  return removed;
}

export function awsCredentialSource(env: NodeJS.ProcessEnv = process.env): string {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) return "environment";
  if (env.AWS_PROFILE) return `profile:${env.AWS_PROFILE}`;
  if (env.AWS_EC2_METADATA_DISABLED === "true") return "none:metadata-disabled";
  return "default-provider-chain";
}
