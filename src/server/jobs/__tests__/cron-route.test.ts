import assert from "node:assert/strict";
import { test } from "vitest";

import { handleCronGet } from "@/app/api/cron/[job]/route";
import type { MaintenanceExecutionLog, MaintenanceJobKey, MaintenanceJobResult } from "@/server/jobs/types";

type TestDepsOptions = {
  jobs?: Partial<Record<MaintenanceJobKey, () => Promise<MaintenanceJobResult>>>;
  secret?: string | undefined;
};

function createRequest(job: string, authorization?: string) {
  return new Request(`https://example.com/api/cron/${job}`, {
    headers: authorization
      ? {
          authorization,
        }
      : undefined,
  });
}

function createContext(job: string) {
  return {
    params: Promise.resolve({ job }),
  };
}

function createDeps(options: TestDepsOptions = {}) {
  const logs: MaintenanceExecutionLog[] = [];
  const syncCalls: MaintenanceExecutionLog[] = [];

  return {
    deps: {
      getCronSecret: () => options.secret,
      loadJobs: async () =>
        ({
          "expire-access": async () => ({ processed: 0, errors: [] }),
          "issue-certificates": async () => ({ processed: 0, errors: [] }),
          "send-receipts": async () => ({ processed: 0, errors: [] }),
          notifications: async () => ({ processed: 0, errors: [] }),
          ...options.jobs,
        }) as Record<MaintenanceJobKey, () => Promise<MaintenanceJobResult>>,
      log: (entry: MaintenanceExecutionLog) => {
        logs.push(entry);
      },
      now: (() => {
        let tick = 0;
        return () => new Date(`2026-07-05T12:00:0${tick++}Z`);
      })(),
      syncAlertState: async (entry: MaintenanceExecutionLog) => {
        syncCalls.push(entry);
      },
    },
    logs,
    syncCalls,
  };
}

test("returns 401 when the authorization header is missing", async () => {
  const harness = createDeps({ secret: "test-secret" });

  const response = await handleCronGet(
    createRequest("expire-access"),
    createContext("expire-access"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.job, "expire-access");
  assert.equal(body.status, "error");
  assert.equal(body.processed, 0);
  assert.deepEqual(body.errors, ["Unauthorized"]);
  assert.equal(harness.syncCalls.length, 0);
});

test("returns 401 when the authorization header is invalid", async () => {
  const harness = createDeps({ secret: "test-secret" });

  const response = await handleCronGet(
    createRequest("expire-access", "Bearer wrong-secret"),
    createContext("expire-access"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.job, "expire-access");
  assert.deepEqual(body.errors, ["Unauthorized"]);
  assert.equal(harness.syncCalls.length, 0);
});

test("returns 404 when the job name is unknown", async () => {
  const harness = createDeps({ secret: "test-secret" });

  const response = await handleCronGet(
    createRequest("unknown-job", "Bearer test-secret"),
    createContext("unknown-job"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.job, "unknown-job");
  assert.deepEqual(body.errors, ["Unknown cron job"]);
  assert.equal(harness.syncCalls.length, 0);
});

test("runs the expire-access job successfully", async () => {
  let called = 0;
  const harness = createDeps({
    secret: "test-secret",
    jobs: {
      "expire-access": async () => {
        called += 1;
        return { processed: 3, errors: [] };
      },
    },
  });

  const response = await handleCronGet(
    createRequest("expire-access", "Bearer test-secret"),
    createContext("expire-access"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.job, "expire-access");
  assert.equal(body.status, "ok");
  assert.equal(body.processed, 3);
  assert.equal(called, 1);
  assert.equal(harness.syncCalls.length, 1);
});

test("runs the issue-certificates job successfully", async () => {
  let called = 0;
  const harness = createDeps({
    secret: "test-secret",
    jobs: {
      "issue-certificates": async () => {
        called += 1;
        return { processed: 2, errors: [] };
      },
    },
  });

  const response = await handleCronGet(
    createRequest("issue-certificates", "Bearer test-secret"),
    createContext("issue-certificates"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.job, "issue-certificates");
  assert.equal(body.status, "ok");
  assert.equal(body.processed, 2);
  assert.equal(called, 1);
  assert.equal(harness.syncCalls.length, 1);
});

test("runs the send-receipts job successfully", async () => {
  let called = 0;
  const harness = createDeps({
    secret: "test-secret",
    jobs: {
      "send-receipts": async () => {
        called += 1;
        return { processed: 4, errors: [] };
      },
    },
  });

  const response = await handleCronGet(
    createRequest("send-receipts", "Bearer test-secret"),
    createContext("send-receipts"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.job, "send-receipts");
  assert.equal(body.status, "ok");
  assert.equal(body.processed, 4);
  assert.equal(called, 1);
  assert.equal(harness.syncCalls.length, 1);
});

test("runs the notifications job successfully", async () => {
  let called = 0;
  const harness = createDeps({
    secret: "test-secret",
    jobs: {
      notifications: async () => {
        called += 1;
        return { processed: 5, errors: [] };
      },
    },
  });

  const response = await handleCronGet(
    createRequest("notifications", "Bearer test-secret"),
    createContext("notifications"),
    harness.deps,
  );

  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.job, "notifications");
  assert.equal(body.status, "ok");
  assert.equal(body.processed, 5);
  assert.equal(called, 1);
  assert.equal(harness.syncCalls.length, 1);
});
