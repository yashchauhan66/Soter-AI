import {
  CreateTableCommand,
  DescribeTableCommand,
  waitUntilTableExists,
} from "@aws-sdk/client-dynamodb";

import { createClient, INDEXES, REGION, TABLE_NAME } from "./dynamodb-events-common";

const client = createClient();

async function main() {
  try {
    const existing = await client.send(new DescribeTableCommand({ TableName: TABLE_NAME }));
    console.log(`DynamoDB table ${TABLE_NAME} already exists with status ${existing.Table?.TableStatus}.`);
    return;
  } catch (error) {
    if ((error as { name?: string }).name !== "ResourceNotFoundException") throw error;
  }

  await client.send(new CreateTableCommand({
    TableName: TABLE_NAME,
    BillingMode: "PAY_PER_REQUEST",
    AttributeDefinitions: [
      { AttributeName: "pk", AttributeType: "S" },
      { AttributeName: "sk", AttributeType: "S" },
      ...INDEXES.flatMap(([, partitionKey, sortKey]) => [
        { AttributeName: partitionKey, AttributeType: "S" as const },
        { AttributeName: sortKey, AttributeType: "S" as const },
      ]),
    ],
    KeySchema: [
      { AttributeName: "pk", KeyType: "HASH" },
      { AttributeName: "sk", KeyType: "RANGE" },
    ],
    GlobalSecondaryIndexes: INDEXES.map(([IndexName, partitionKey, sortKey]) => ({
      IndexName,
      KeySchema: [
        { AttributeName: partitionKey, KeyType: "HASH" as const },
        { AttributeName: sortKey, KeyType: "RANGE" as const },
      ],
      Projection: { ProjectionType: "ALL" as const },
    })),
  }));

  await waitUntilTableExists({ client, maxWaitTime: 180 }, { TableName: TABLE_NAME });
  console.log(`Created ${TABLE_NAME} in ${REGION} with on-demand billing and ${INDEXES.length} GSIs.`);
  console.log("Next: npm run dynamodb:events:ttl");
}

main().catch((error) => {
  console.error("DynamoDB table creation failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

