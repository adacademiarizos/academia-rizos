export type MaintenanceJobKey =
  | "expire-access"
  | "issue-certificates"
  | "send-receipts"
  | "notifications";

export type MaintenanceJobResult = {
  processed: number;
  errors: string[];
};

export type MaintenanceJob = () => Promise<MaintenanceJobResult>;

export type MaintenanceExecutionLog = MaintenanceJobResult & {
  job: string;
  status: "ok" | "error";
  durationMs: number;
  startedAt: string;
  finishedAt: string;
};
