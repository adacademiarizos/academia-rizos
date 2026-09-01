import { db } from "@/lib/db";

import type { MaintenanceJobResult } from "./types";

export async function expireAccessJob(): Promise<MaintenanceJobResult> {
  const processed = await db.courseAccess.count({
    where: {
      accessUntil: {
        not: null,
        lte: new Date(),
      },
    },
  });

  return {
    processed,
    errors: [],
  };
}
