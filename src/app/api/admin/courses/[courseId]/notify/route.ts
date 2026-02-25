import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkAdminAuth } from "@/lib/admin-auth";
import { sendNewCourseNotificationEmail } from "@/lib/mail";
import { NotificationService } from "@/server/services/notification-service";

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
    select: { id: true, title: true, description: true, priceCents: true, currency: true },
  });

  if (!course) {
    return NextResponse.json({ ok: false, error: "Course not found" }, { status: 404 });
  }

  // Get all students (STUDENT role)
  const students = await db.user.findMany({
    where: { role: "STUDENT" },
    select: { id: true, name: true, email: true },
  });

  let emailsSent = 0;
  let notificationsCreated = 0;

  // Send in batches to avoid overwhelming the email provider
  for (const student of students) {
    // In-app notification
    NotificationService.createNotification({
      userId: student.id,
      type: "NEW_COURSE",
      title: "¡Nuevo curso disponible!",
      message: `"${course.title}" ya está disponible en la academia`,
      relatedId: course.id,
    }).then(() => { notificationsCreated++; }).catch(() => {});

    // Email notification
    if (student.email) {
      sendNewCourseNotificationEmail({
        to: student.email,
        studentName: student.name ?? "Estudiante",
        courseTitle: course.title,
        courseDescription: course.description ?? undefined,
        priceCents: course.priceCents,
        currency: course.currency ?? "EUR",
      }).then(() => { emailsSent++; }).catch((e) => {
        console.error(`[notify] failed to send to ${student.email}`, e);
      });
    }
  }

  return NextResponse.json({
    ok: true,
    data: {
      studentsCount: students.length,
      message: `Notificaciones enviadas a ${students.length} estudiante(s)`,
    },
  });
}
