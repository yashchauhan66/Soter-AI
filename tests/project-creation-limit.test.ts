import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  assertProjectCreationAllowed,
  FREE_PROJECT_CREATIONS_PER_MONTH,
  ProjectCreationLimitError,
  projectCreationMonthRange,
} from '../lib/projects/projectCreationLimit';

test('free plan allows only one project creation per calendar month', () => {
  assert.equal(FREE_PROJECT_CREATIONS_PER_MONTH, 1);
  assert.doesNotThrow(() => assertProjectCreationAllowed('FREE', 0));
  assert.throws(
    () => assertProjectCreationAllowed('FREE', 1),
    (error) =>
      error instanceof ProjectCreationLimitError && error.code === 'FREE_PROJECT_MONTHLY_LIMIT',
  );
});

test('paid plans are not restricted by the free monthly project limit', () => {
  for (const plan of ['STARTER', 'PRO', 'AGENCY', 'ENTERPRISE', 'DEMO'] as const) {
    assert.doesNotThrow(() => assertProjectCreationAllowed(plan, 100));
  }
});

test('project creation month uses stable UTC calendar boundaries', () => {
  assert.deepEqual(projectCreationMonthRange(new Date('2026-12-31T23:59:59.999Z')), {
    start: new Date('2026-12-01T00:00:00.000Z'),
    end: new Date('2027-01-01T00:00:00.000Z'),
  });
});

test('project API enforces the limit inside a concurrency-safe transaction', () => {
  const source = readFileSync('app/api/projects/route.ts', 'utf8');
  assert.match(source, /db\.\$transaction/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(
    source,
    /assertProjectCreationAllowed\(organization\.plan, projectsCreatedThisMonth\)/,
  );
  assert.match(source, /code: error\.code/);
  assert.match(source, /status: 403/);
});

test('automatic default project creation uses the same organization lock', () => {
  const source = readFileSync('lib/auth.ts', 'utf8');
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /projectCreatedWhileWaiting/);
  assert.match(
    source,
    /assertProjectCreationAllowed\(organization\.plan, projectsCreatedThisMonth\)/,
  );
});
