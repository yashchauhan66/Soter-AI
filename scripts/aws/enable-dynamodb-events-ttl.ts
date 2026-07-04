import {
  DescribeTimeToLiveCommand,
  UpdateTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

import { createClient, TABLE_NAME } from "./dynamodb-events-common";

const client = createClient();

async function main() {
  const current = await client.send(new DescribeTimeToLiveCommand({ TableName: TABLE_NAME }));
  const status = current.TimeToLiveDescription?.TimeToLiveStatus;
  const attribute = current.TimeToLiveDescription?.AttributeName;
  if ((status === "ENABLED" || status === "ENABLING") && attribute === "expiresAt") {
    console.log(`TTL is already ${status.toLowerCase()} on ${TABLE_NAME}.expiresAt.`);
    return;
  }

  await client.send(new UpdateTimeToLiveCommand({
    TableName: TABLE_NAME,
    TimeToLiveSpecification: {
      AttributeName: "expiresAt",
      Enabled: true,
    },
  }));
  console.log(`TTL enablement requested for ${TABLE_NAME}.expiresAt.`);
  console.log("AWS may take up to one hour to report TTL as ENABLED.");
}

main().catch((error) => {
  console.error("DynamoDB TTL setup failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

