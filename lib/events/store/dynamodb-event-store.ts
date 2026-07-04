import { PutCommand, QueryCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

import { dynamoEventsConfig } from "../../dynamodb/config";
import { getDynamoDbDocumentClient } from "../../dynamodb/client";
import { buildStoredEvent } from "./keys";
import type { EventListFilters, EventPage, HeavyEvent, StoredEvent } from "./types";

const INDEX_GSI1 = "gsi1-org-project-time-index";
const INDEX_GSI3 = "gsi3-project-decision-time-index";
const INDEX_GSI4 = "gsi4-webhook-time-index";

export class DynamoDbEventStore {
  constructor(
    private readonly client: Pick<DynamoDBDocumentClient, "send"> = getDynamoDbDocumentClient(),
    private readonly tableName = dynamoEventsConfig().tableName,
  ) {}

  async write(event: HeavyEvent): Promise<StoredEvent> {
    const item = buildStoredEvent(event);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: item,
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    }));
    return item;
  }

  async listGuardEventsByProject(projectId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    if (filters.decision) {
      return this.query({
        indexName: INDEX_GSI3,
        partitionKeyName: "gsi3pk",
        partitionKeyValue: `PROJECT#${projectId}#DECISION#${filters.decision}`,
        sortKeyName: "gsi3sk",
        filters,
      });
    }
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `PROJECT#${projectId}`,
      sortKeyName: "sk",
      sortPrefix: "GUARD#",
      filters,
    });
  }

  async listGuardEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      indexName: INDEX_GSI1,
      partitionKeyName: "gsi1pk",
      partitionKeyValue: `ORG#${orgId}`,
      sortKeyName: "gsi1sk",
      sortPrefix: "GUARD#",
      filters,
    });
  }

  async listAuditEventsByOrg(orgId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `ORG#${orgId}`,
      sortKeyName: "sk",
      sortPrefix: "AUDIT#",
      filters,
    });
  }

  async listWebhookDeliveryEvents(webhookId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      indexName: INDEX_GSI4,
      partitionKeyName: "gsi4pk",
      partitionKeyValue: `WEBHOOK#${webhookId}`,
      sortKeyName: "gsi4sk",
      filters,
    });
  }

  async listIncidentEvents(incidentId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `INCIDENT#${incidentId}`,
      sortKeyName: "sk",
      sortPrefix: "EVENT#",
      filters,
    });
  }

  async listReportEvents(reportId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `REPORT#${reportId}`,
      sortKeyName: "sk",
      sortPrefix: "EVENT#",
      filters,
    });
  }

  async listWorkerTaskEvents(jobId: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `JOB#${jobId}`,
      sortKeyName: "sk",
      sortPrefix: "EVENT#",
      filters,
    });
  }

  async listProjectTypeEvents(projectId: string, type: "payload_event" | "rag_security_event", filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      indexName: "gsi2-project-type-time-index",
      partitionKeyName: "gsi2pk",
      partitionKeyValue: `PROJECT#${projectId}#TYPE#${type}`,
      sortKeyName: "gsi2sk",
      filters,
    });
  }

  async listProjectPrefixEvents(projectId: string, prefix: string, filters: EventListFilters = {}): Promise<EventPage<StoredEvent>> {
    return this.query({
      partitionKeyName: "pk",
      partitionKeyValue: `PROJECT#${projectId}`,
      sortKeyName: "sk",
      sortPrefix: prefix,
      filters,
    });
  }

  private async query(input: {
    indexName?: string;
    partitionKeyName: string;
    partitionKeyValue: string;
    sortKeyName: string;
    sortPrefix?: string;
    filters: EventListFilters;
  }): Promise<EventPage<StoredEvent>> {
    const limit = clampLimit(input.filters.limit);
    const names: Record<string, string> = {
      "#pk": input.partitionKeyName,
      "#sk": input.sortKeyName,
    };
    const values: Record<string, unknown> = { ":pk": input.partitionKeyValue };
    let keyCondition = "#pk = :pk";
    const range = sortRange(input.sortPrefix, input.filters.from, input.filters.to);
    if (range.expression) {
      keyCondition += ` AND ${range.expression}`;
      Object.assign(values, range.values);
    }

    const filterExpressions: string[] = [];
    if (input.filters.decision && input.indexName !== INDEX_GSI3) {
      names["#decision"] = "decision";
      values[":decision"] = input.filters.decision;
      filterExpressions.push("#decision = :decision");
    }
    if (input.filters.direction) {
      names["#guardType"] = "guardType";
      values[":direction"] = input.filters.direction;
      filterExpressions.push("#guardType = :direction");
    }
    if (input.filters.category) {
      names["#categories"] = "categories";
      values[":category"] = input.filters.category;
      filterExpressions.push("contains(#categories, :category)");
    }
    if (input.filters.status) {
      names["#status"] = "status";
      values[":status"] = input.filters.status;
      filterExpressions.push("#status = :status");
    }
    if (input.filters.action) {
      names["#action"] = "action";
      values[":action"] = input.filters.action;
      filterExpressions.push("#action = :action");
    }
    if (input.filters.provider) {
      names["#provider"] = "provider";
      values[":provider"] = input.filters.provider;
      filterExpressions.push("#provider = :provider");
    }
    if (input.filters.userId) {
      names["#userId"] = "userId";
      values[":userId"] = input.filters.userId;
      filterExpressions.push("#userId = :userId");
    }

    const response = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: input.indexName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      FilterExpression: filterExpressions.length ? filterExpressions.join(" AND ") : undefined,
      ExclusiveStartKey: decodeCursor(input.filters.cursor),
      ScanIndexForward: false,
      Limit: limit,
    }));

    return {
      items: (response.Items ?? []) as StoredEvent[],
      nextCursor: response.LastEvaluatedKey ? encodeCursor(response.LastEvaluatedKey) : null,
    };
  }
}

function sortRange(prefix: string | undefined, from?: Date, to?: Date) {
  const start = `${prefix ?? ""}${(from ?? new Date(0)).toISOString()}`;
  const end = `${prefix ?? ""}${(to ?? new Date("9999-12-31T23:59:59.999Z")).toISOString()}\uffff`;
  return {
    expression: "#sk BETWEEN :start AND :end",
    values: { ":start": start, ":end": end },
  };
}

function clampLimit(limit?: number) {
  return Math.min(100, Math.max(1, Math.trunc(limit ?? 50)));
}

export function encodeCursor(key: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(key), "utf8").toString("base64url");
}

export function decodeCursor(cursor?: string | null): Record<string, unknown> | undefined {
  if (!cursor) return undefined;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
  } catch {
    return undefined;
  }
}
