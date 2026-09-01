import type { Prisma } from "@prisma/client";

type CourseAccessLike = {
  accessUntil: Date | null;
  revokedAt: Date | null;
};

export function buildActiveCourseAccessWhere(now = new Date()): Prisma.CourseAccessWhereInput {
  return {
    revokedAt: null,
    OR: [{ accessUntil: null }, { accessUntil: { gt: now } }],
  };
}

export function isCourseAccessActive(
  access: CourseAccessLike | null | undefined,
  now = new Date()
) {
  if (!access || access.revokedAt) {
    return false;
  }

  return !access.accessUntil || access.accessUntil > now;
}
