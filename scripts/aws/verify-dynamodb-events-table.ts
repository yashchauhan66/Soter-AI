import {
  DescribeTableCommand,
  DescribeTimeToLiveCommand,
} from "@aws-sdk/client-dynamodb";

import { createClient, INDEXES, REGION, TABLE_NAME } from "./dynamodb-events-common";

const client = createClient();

async function main() {
  const [tableResponse, ttlResponse] = await Promise.all([
    client.send(new DescribeTableCommand({ TableName: TABLE_NAME })),
    client.send(new DescribeTimeToLiveCommand({ TableName: TABLE_NAME })),
  ]);
  const table = tableResponse.Table;
  if (!table) throw new Error("DescribeTable returned no table.");

  const errors: string[] = [];
  if (table.TableStatus !== "ACTIVE") errors.push(`table status is ${table.TableStatus}`);
  if (!hasKey(table.KeySchema, "pk", "HASH") || !hasKey(table.KeySchema, "sk", "RANGE")) {
    errors.push("primary key must be pk (HASH) + sk (RANGE)");
  }
  for (const [name, partitionKey, sortKey] of INDEXES) {
    const index = table.GlobalSecondaryIndexes?.find((candidate) => candidate.IndexName === name);
    if (!index) {
      errors.push(`missing GSI ${name}`);
      continue;
    }
    if (!hasKey(index.KeySchema, partitionKey, "HASH") || !hasKey(index.KeySchema, sortKey, "RANGE")) {
      errors.push(`GSI ${name} has an invalid key schema`);
    }
    if (index.IndexStatus !== "ACTIVE") errors.push(`GSI ${name} status is ${index.IndexStatus}`);
  }

  const ttl = ttlResponse.TimeToLiveDescription;
  if (ttl?.AttributeName !== "expiresAt") errors.push("TTL attribute is not expiresAt");
  if (ttl?.TimeToLiveStatus !== "ENABLED" && ttl?.TimeToLiveStatus !== "ENABLING") {
    errors.push(`TTL status is ${ttl?.TimeToLiveStatus ?? "unknown"}`);
  }

  if (errors.length) {
    console.error(`Verification failed for ${TABLE_NAME}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Verified ${TABLE_NAME} in ${REGION}.`);
  console.log(`Table status: ${table.TableStatus}`);
  console.log(`Billing mode: ${table.BillingModeSummary?.BillingMode ?? "PAY_PER_REQUEST (legacy response omitted summary)"}`);
  console.log(`GSIs: ${INDEXES.map(([name]) => name).join(", ")}`);
  console.log(`TTL: ${ttl?.TimeToLiveStatus} on ${ttl?.AttributeName}`);
}

function hasKey(
  schema: Array<{ AttributeName?: string; KeyType?: string }> | undefined,
  attribute: string,
  type: string,
) {
  return Boolean(schema?.some((key) => key.AttributeName === attribute && key.KeyType === type));
}

main().catch((error) => {
  console.error("DynamoDB verification failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

