import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_DATABASE_CONNECT_TIMEOUT_SECONDS,
  withDatabaseConnectTimeout,
} from "../lib/databaseUrl";

test("database URLs get a cold-start-safe connection timeout", () => {
  assert.equal(
    withDatabaseConnectTimeout("postgresql://user:pass@db.example.com/app"),
    `postgresql://user:pass@db.example.com/app?connect_timeout=${DEFAULT_DATABASE_CONNECT_TIMEOUT_SECONDS}`,
  );
  assert.equal(
    withDatabaseConnectTimeout("postgresql://user:pass@db.example.com/app?sslmode=require"),
    `postgresql://user:pass@db.example.com/app?sslmode=require&connect_timeout=${DEFAULT_DATABASE_CONNECT_TIMEOUT_SECONDS}`,
  );
});

test("an explicit database connection timeout is preserved", () => {
  const url = "postgresql://user:pass@db.example.com/app?sslmode=require&connect_timeout=12";
  assert.equal(withDatabaseConnectTimeout(url), url);
  assert.equal(withDatabaseConnectTimeout(undefined), undefined);
});
