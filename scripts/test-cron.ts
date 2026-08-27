import "dotenv/config";

const ALL_JOBS = ["expire-access", "issue-certificates", "send-receipts", "notifications"] as const;

type JobName = (typeof ALL_JOBS)[number];

function isJobName(value: string): value is JobName {
  return ALL_JOBS.includes(value as JobName);
}

async function runJob(baseUrl: string, cronSecret: string, job: JobName) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/cron/${job}`, {
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  const body = await response.json();

  console.log(`\n[cron] ${job} -> HTTP ${response.status}`);
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok) {
    process.exitCode = 1;
  }
}

async function main() {
  const selectedJob = process.argv[2];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    throw new Error("CRON_SECRET no está definido en el entorno local.");
  }

  const jobs = selectedJob
    ? (() => {
        if (!isJobName(selectedJob)) {
          throw new Error(`Job inválido: ${selectedJob}`);
        }
        return [selectedJob];
      })()
    : [...ALL_JOBS];

  for (const job of jobs) {
    await runJob(baseUrl, cronSecret, job);
  }
}

main().catch((error) => {
  console.error("[test-cron] failed:", error);
  process.exitCode = 1;
});
