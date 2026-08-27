import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { buildActiveCourseAccessWhere } from "@/lib/course-access";
import { NotificationEventService } from "@/server/services/notification-event-service";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const auth = await checkAdminAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { courseId } = await params;

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, title: true, isActive: true, updatedAt: true },
  });

  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found" }, { status: 404 });
  }
  if (!course.isActive) {
    return NextResponse.json(
      { ok: false, error: "Only an active course can be explicitly published" },
      { status: 409 },
    );
  }

  // Publication is an explicit action. It reaches current holders only, never
  // every student account, and honors their optional COURSE_UPDATES setting.
  const access = await db.courseAccess.findMany({
    where: { courseId, ...buildActiveCourseAccessWhere() },
    select: { userId: true },
    distinct: ["userId"],
  });

  await NotificationEventService.coursePublished({
    courseId: course.id,
    courseTitle: course.title,
    recipientUserIds: access.map(({ userId }) => userId),
    publicationId: course.updatedAt.toISOString(),
  });

  return NextResponse.json({
    ok: true,
    data: {
      studentsCount: access.length,
      message: `Publicación enviada a ${access.length} estudiante(s) con acceso activo`,
    },
  });
}
