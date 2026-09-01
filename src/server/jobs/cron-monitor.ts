import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import type { MaintenanceExecutionLog, MaintenanceJobKey } from "./types";

type CronAlertEntry = {
  failed: boolean;
  lastAlertedAt?: string;
  lastError?: string | null;
  lastRunAt: string;
  lastSuccessAt?: string;
  lastTransitionAt: string;
};

type CronAlertState = Partial<Record<MaintenanceJobKey, CronAlertEntry>>;

function parseAdminEmails(rawValue: string | undefined) {
  return rawValue
    ?.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean) ?? [];
}

function isCronAlertEntry(value: unknown): value is CronAlertEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.failed === "boolean" && typeof candidate.lastRunAt === "string";
}

function parseCronAlertState(rawValue: Prisma.JsonValue | null): CronAlertState {
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return {};
  }

  const state: CronAlertState = {};

  for (const [job, value] of Object.entries(rawValue)) {
    if (isCronAlertEntry(value)) {
      state[job as MaintenanceJobKey] = value;
    }
  }

  return state;
}

async function getAdminAlertRecipients() {
  const envEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

  const dbEmails = await db.user
    .findMany({
      where: { role: "ADMIN" },
      select: { email: true },
    })
    .then((admins) => admins.map((admin) => admin.email.toLowerCase()))
    .catch(() => []);

  return Array.from(new Set([...envEmails, ...dbEmails]));
}

async function sendCronFailureAlert(logEntry: MaintenanceExecutionLog) {
  const recipients = await getAdminAlertRecipients();

  if (recipients.length === 0) {
    return;
  }

  const { sendAdminAlertEmail } = await import("@/lib/mail");

  await sendAdminAlertEmail({
    to: recipients,
    subject: `[ALERTA] Fallo en job de mantenimiento: ${logEntry.job}`,
    title: "Job de mantenimiento con fallos",
    rows: [
      ["Job", logEntry.job],
      ["Estado", logEntry.status],
      ["Procesados", String(logEntry.processed)],
      ["Duración", `${logEntry.durationMs} ms`],
      ["Finalizó", new Date(logEntry.finishedAt).toLocaleString("es-ES")],
      ["Primer error", logEntry.errors[0] ?? "—"],
    ],
    note: "Se notifica solo cuando el job pasa de un estado sano a uno con error.",
  });
}

export async function syncCronAlertState(logEntry: MaintenanceExecutionLog) {
  const settings = await db.settings.upsert({
    where: { id: "global" },
    create: { id: "global" },
    update: {},
    select: { cronAlertState: true },
  });

  const alertState = parseCronAlertState(settings.cronAlertState);
  const jobKey = logEntry.job as MaintenanceJobKey;
  const previousState = alertState[jobKey];
  const failed = logEntry.status === "error";
  const transitioned = previousState?.failed !== failed;
  const shouldAlert = failed && previousState?.failed !== true;

  if (shouldAlert) {
    await sendCronFailureAlert(logEntry);
  }

  alertState[jobKey] = {
    failed,
    lastAlertedAt: shouldAlert ? logEntry.finishedAt : previousState?.lastAlertedAt,
    lastError: logEntry.errors[0] ?? null,
    lastRunAt: logEntry.finishedAt,
    lastSuccessAt: failed ? previousState?.lastSuccessAt : logEntry.finishedAt,
    lastTransitionAt: transitioned
      ? logEntry.finishedAt
      : previousState?.lastTransitionAt ?? logEntry.finishedAt,
  };

  await db.settings.update({
    where: { id: "global" },
    data: {
      cronAlertState: alertState as Prisma.InputJsonValue,
    },
  });
}
