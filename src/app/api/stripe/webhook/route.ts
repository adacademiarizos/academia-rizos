import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { verifyStripeWebhook } from "@/lib/stripe";
import { db } from "@/lib/db";
import { sendPaymentReceiptEmail, sendAppointmentConfirmationEmail, sendAppointmentNotificationEmail, sendAdminAlertEmail } from "@/lib/mail";
import { CourseService } from "@/server/services/course-service";
import { NotificationService } from "@/server/services/notification-service";
import { AchievementService } from "@/server/services/achievement-service";

export async function POST(req: Request) {
  const sig = (await headers()).get("stripe-signature");
  if (!sig) {
    return NextResponse.json(
      { ok: false, error: { code: "NO_SIGNATURE", message: "Missing signature" } },
      { status: 400 }
    );
  }

  const rawBody = await req.text();

  let event;
  try {
    event = verifyStripeWebhook(rawBody, sig);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_SIGNATURE", message: err.message } },
      { status: 400 }
    );
  }

  try {
    // Mínimo: checkout.session.completed
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;

      // metadata que vos le vas a meter cuando crees el checkout:
      // metadata.type: APPOINTMENT | COURSE | PAYMENT_LINK
      // metadata.appointmentId, metadata.courseId, metadata.paymentLinkId, etc.
      const metadata = session.metadata ?? {};
      const type = metadata.type as string | undefined;

      const stripeCheckoutSessionId = session.id as string;
      const stripePaymentIntentId = session.payment_intent as string | undefined;

      const amountTotal = session.amount_total as number | null;
      const currency = (session.currency as string | undefined)?.toUpperCase() ?? "EUR";

      const payerEmail = (session.customer_details?.email as string | undefined) ?? undefined;

      // Upsert Payment by stripeCheckoutSessionId
      const payment = await db.payment.upsert({
        where: { stripeCheckoutSessionId },
        create: {
          type: (type as any) ?? "PAYMENT_LINK",
          status: "PAID",
          amountCents: amountTotal ?? 0,
          currency,
          stripeCheckoutSessionId,
          stripePaymentIntentId,
          appointmentId: metadata.appointmentId ?? null,
          courseId: metadata.courseId ?? null,
          paymentLinkId: metadata.paymentLinkId ?? null,
          payerEmail,
          metadata,
        },
        update: {
          status: "PAID",
          amountCents: amountTotal ?? 0,
          currency,
          stripePaymentIntentId,
          payerEmail: payerEmail ?? undefined,
          metadata,
        },
      });

      // Si es appointment, confirmar appointment y notificar
      if (payment.type === "APPOINTMENT" && payment.appointmentId) {
        const appointment = await db.appointment.update({
          where: { id: payment.appointmentId },
          data: { status: "CONFIRMED" },
          include: {
            service: { select: { name: true } },
            staff: { select: { name: true, email: true } },
          },
        });

        // Email de confirmación de cita al cliente
        const customerEmail = appointment.customerEmail ?? payerEmail;
        const customerName = appointment.customerName ?? "Cliente";
        if (customerEmail) {
          sendAppointmentConfirmationEmail({
            to: customerEmail,
            customerName,
            serviceName: appointment.service?.name ?? "Servicio",
            staffName: appointment.staff?.name ?? "Especialista",
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            notes: appointment.notes ?? undefined,
          }).catch((e) => console.error("[mail] appointment confirmation error", e));
        }

        // Email de notificación al staff y admins
        const admins = await db.user.findMany({
          where: { role: "ADMIN" },
          select: { email: true },
        });
        const adminEmails = admins.map((a) => a.email);
        const staffEmail = appointment.staff?.email;
        const notifyRecipients = [
          ...(staffEmail ? [staffEmail] : []),
          ...adminEmails,
        ].filter((e, i, arr) => arr.indexOf(e) === i); // deduplicate

        if (notifyRecipients.length > 0 && customerEmail) {
          sendAppointmentNotificationEmail({
            to: notifyRecipients,
            customerName,
            customerEmail,
            serviceName: appointment.service?.name ?? "Servicio",
            staffName: appointment.staff?.name ?? "Especialista",
            startAt: appointment.startAt,
            endAt: appointment.endAt,
            notes: appointment.notes ?? undefined,
          }).catch((e) => console.error("[mail] staff notification error", e));
        }

        // Notificación in-app al cliente (solo si tiene cuenta)
        if (appointment.customerId) {
          NotificationService.createNotification({
            userId: appointment.customerId,
            type: "APPOINTMENT",
            title: "Cita confirmada",
            message: `Tu cita de ${appointment.service?.name ?? "servicio"} fue confirmada`,
            relatedId: payment.appointmentId,
          }).catch(() => {});
        }

        // Notificación in-app a todos los admins
        NotificationService.notifyAllAdmins({
          type: "APPOINTMENT",
          title: "Nueva cita reservada",
          message: `${appointment.customerName ?? "Un cliente"} reservó ${appointment.service?.name ?? "una cita"}`,
          relatedId: payment.appointmentId ?? undefined,
        }).catch(() => {});
      }

      // ✅ Si es payment link, marcarlo como PAID
      if (payment.type === "PAYMENT_LINK" && payment.paymentLinkId) {
        await db.paymentLink.update({
          where: { id: payment.paymentLinkId },
          data: { status: "PAID" },
        });
      }

      // ✅ Si es course, otorgar acceso al curso
      if (payment.type === "COURSE" && payment.courseId && payment.payerId) {
        try {
          await CourseService.createCourseAccess(payment.payerId, payment.courseId);
          console.log(`✅ Granted course access: ${payment.payerId} → ${payment.courseId}`);

          // Get course and payer info for admin notifications
          const [courseInfo, payerInfo] = await Promise.all([
            db.course.findUnique({ where: { id: payment.courseId }, select: { title: true } }),
            db.user.findUnique({ where: { id: payment.payerId }, select: { name: true, email: true } }),
          ]).catch(() => [null, null])

          // Notify admins about course purchase
          const adminsForNotif = await db.user.findMany({
            where: { role: "ADMIN" },
            select: { email: true },
          }).catch(() => [])
          const adminEmailsForNotif = adminsForNotif.map((a) => a.email)

          if (adminEmailsForNotif.length > 0 && courseInfo && payerInfo) {
            sendAdminAlertEmail({
              to: adminEmailsForNotif,
              subject: `Nuevo pago de curso — ${courseInfo.title}`,
              title: 'Curso adquirido',
              rows: [
                ['Curso', courseInfo.title],
                ['Estudiante', payerInfo.name ?? '—'],
                ['Email', payerInfo.email],
                ['Monto', `${(payment.amountCents / 100).toFixed(2)} ${payment.currency}`],
                ['Fecha', new Date().toLocaleDateString('es-ES', { dateStyle: 'long' })],
              ],
            }).catch((e) => console.error('[mail] admin course-purchase notification error', e))
          }

          NotificationService.notifyAllAdmins({
            type: "PAYMENT",
            title: "Nuevo pago de curso",
            message: `${payerInfo?.name ?? payerEmail ?? "Un estudiante"} compró "${courseInfo?.title ?? "un curso"}"`,
            relatedId: payment.courseId,
          }).catch(() => {})

          // Trigger notifications and activity recording after successful enrollment
          await Promise.all([
            NotificationService.triggerOnCourseEnrollment(payment.payerId, payment.courseId),
            AchievementService.recordActivity(
              payment.payerId,
              'COURSE_STARTED',
              payment.courseId
            ),
          ]).catch((error) => {
            console.error('Error with notifications/achievements after enrollment:', error)
            // Don't throw - payment is still successful
          })
        } catch (error) {
          console.error(`❌ Failed to grant course access:`, error);
          // Don't throw - payment is still successful
        }
      }

      // Enviar recibo si no se ha enviado
      if (!payment.receiptEmailSentAt && payerEmail) {
        await sendPaymentReceiptEmail({
          to: payerEmail,
          paymentId: payment.id,
          amountCents: payment.amountCents,
          currency: payment.currency,
          concept:
            payment.type === "APPOINTMENT"
              ? "Cita"
              : payment.type === "COURSE"
              ? "Curso"
              : "Pago",
          stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
        });

        // Notify admins about the payment (if not a course — we notify separately above)
        if (payment.type !== "COURSE") {
          NotificationService.notifyAllAdmins({
            type: "PAYMENT",
            title: "Nuevo pago recibido",
            message: `Pago de ${(payment.amountCents / 100).toFixed(2)} ${payment.currency} — ${payment.type === "APPOINTMENT" ? "Cita" : "Link de pago"}`,
            relatedId: payment.id,
          }).catch(() => {})
        }

        await db.payment.update({
          where: { id: payment.id },
          data: {
            receiptEmailSentAt: new Date(),
            receiptToEmail: payerEmail,
          },
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: { code: "WEBHOOK_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
