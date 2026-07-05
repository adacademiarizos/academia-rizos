import { expireAccessJob } from "./expireAccess.job";
import { issueCertificateJob } from "./issueCertificate.job";
import { sendReceiptJob } from "./sendReceipt.job";
import type { MaintenanceJob, MaintenanceJobKey } from "./types";

export const maintenanceJobs: Record<MaintenanceJobKey, MaintenanceJob> = {
  "expire-access": expireAccessJob,
  "issue-certificates": issueCertificateJob,
  "send-receipts": sendReceiptJob,
};

export function isMaintenanceJobKey(value: string): value is MaintenanceJobKey {
  return value in maintenanceJobs;
}
