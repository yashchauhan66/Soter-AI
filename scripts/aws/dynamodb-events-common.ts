import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

import { awsCredentialSource, unsetBlankAwsCredentialEnv } from "../../lib/dynamodb/aws-env";

export const REGION = process.env.AWS_REGION || "ap-south-1";
export const TABLE_NAME = process.env.DYNAMODB_EVENTS_TABLE || "soterai_events";

export function createClient() {
  const removed = unsetBlankAwsCredentialEnv();
  if (removed.length) {
    console.log(`Ignoring blank AWS credential variables: ${removed.join(", ")}.`);
  }
  console.log(`Using AWS credential source: ${awsCredentialSource()}.`);
  return new DynamoDBClient({
    region: REGION,
    ...(process.env.DYNAMODB_ENDPOINT ? { endpoint: process.env.DYNAMODB_ENDPOINT } : {}),
  });
}

export const INDEXES = [
  ["gsi1-org-project-time-index", "gsi1pk", "gsi1sk"],
  ["gsi2-project-type-time-index", "gsi2pk", "gsi2sk"],
  ["gsi3-project-decision-time-index", "gsi3pk", "gsi3sk"],
  ["gsi4-webhook-time-index", "gsi4pk", "gsi4sk"],
] as const;
