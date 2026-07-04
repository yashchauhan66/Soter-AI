import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { dynamoEventsConfig } from "./config";

let lowLevelClient: DynamoDBClient | undefined;
let documentClient: DynamoDBDocumentClient | undefined;

export function getDynamoDbClient(): DynamoDBClient {
  if (!lowLevelClient) {
    const config = dynamoEventsConfig();
    lowLevelClient = new DynamoDBClient({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    });
  }
  return lowLevelClient;
}

export function getDynamoDbDocumentClient(): DynamoDBDocumentClient {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoDbClient(), {
      marshallOptions: {
        removeUndefinedValues: true,
        convertClassInstanceToMap: true,
      },
    });
  }
  return documentClient;
}

export function resetDynamoDbClientsForTests() {
  lowLevelClient = undefined;
  documentClient = undefined;
}

