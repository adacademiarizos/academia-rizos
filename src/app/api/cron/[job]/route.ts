import { NextResponse } from "next/server";

import { syncCronAlertState } from "@/server/jobs/cron-monitor";
import type {
  MaintenanceExecutionLog,
  MaintenanceJob,
  MaintenanceJobKey,
} from "@/server/jobs/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type CronRouteContext = {
  params: Promise<{
    job: string;
  }>;
};

type CronRouteDeps = {
  getCronSecret: () => string | undefined;
  loadJobs: () => Promise<Record<MaintenanceJobKey, MaintenanceJob>>;
  log: (entry: MaintenanceExecutionLog) => void;
  now: () => Date;
  syncAlertState: (entry: MaintenanceExecutionLog) => Promise<void>;
};

const defaultDeps: CronRouteDeps = {
  getCronSecret: () => process.env.CRON_SECRET,
  loadJobs: async () => {
    const { maintenanceJobs } = await import("@/server/jobs/registry");
    return maintenanceJobs;
  },
  log: (entry) => {
    console.log(JSON.stringify(entry));
  },
  now: () => new Date(),
  syncAlertState: syncCronAlertState,
};

function isAuthorized(request: Request, cronSecret: string) {
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function buildLogEntry(
  job: string,
  startedAt: Date,
  finishedAt: Date,
  processed: number,
  errors: string[],
): MaintenanceExecutionLog {
  return {
    job,
    status: errors.length > 0 ? "error" : "ok",
    processed,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    errors,
  };
}

async function respondWithLoggedError(
  job: string,
  startedAt: Date,
  statusCode: number,
  errors: string[],
  deps: CronRouteDeps,
) {
  const finishedAt = deps.now();
  const logEntry = buildLogEntry(job, startedAt, finishedAt, 0, errors);

  deps.log(logEntry);

  return NextResponse.json(logEntry, { status: statusCode });
}

export async function handleCronGet(
  request: Request,
  { params }: CronRouteContext,
  deps: CronRouteDeps = defaultDeps,
) {
  const startedAt = deps.now();
  const { job } = await params;
  const cronSecret = deps.getCronSecret();

  if (!cronSecret) {
    return respondWithLoggedError(
      job,
      startedAt,
      500,
      ["CRON_SECRET is not configured"],
      deps,
    );
  }

  if (!isAuthorized(request, cronSecret)) {
    return respondWithLoggedError(job, startedAt, 401, ["Unauthorized"], deps);
  }

  const jobs = await deps.loadJobs();
  const selectedJob = jobs[job as MaintenanceJobKey];

  if (!selectedJob) {
    return respondWithLoggedError(job, startedAt, 404, ["Unknown cron job"], deps);
  }

  let processed = 0;
  const errors: string[] = [];
  let statusCode = 200;

  try {
    const result = await selectedJob();
    processed = result.processed;
    errors.push(...result.errors);
  } catch (error) {
    statusCode = 500;
    errors.push(error instanceof Error ? error.message : "Unknown cron execution error");
  }

  const finishedAt = deps.now();
  const logEntry = buildLogEntry(job, startedAt, finishedAt, processed, errors);

  try {
    await deps.syncAlertState(logEntry);
  } catch (error) {
    logEntry.errors.push(
      `Failed to sync cron alert state: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    logEntry.status = "error";
  }

  deps.log(logEntry);

  return NextResponse.json(logEntry, { status: statusCode });
}

export async function GET(request: Request, context: CronRouteContext) {
  return handleCronGet(request, context);
}
