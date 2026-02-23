import { Resend } from "resend";
import { env } from "@/lib/env";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

function warn(fn: string, params: unknown) {
  console.warn(`[mail] RESEND_API_KEY missing, skipping ${fn}`, params);
}

// ──────────────────────────────────────────────────────────
// Recibo de pago
// ──────────────────────────────────────────────────────────
type PaymentReceiptParams = {
  to: string;
  paymentId: string;
  amountCents: number;
  currency: string;
  concept: "Cita" | "Curso" | "Pago";
  stripePaymentIntentId?: string;
};

export async function sendPaymentReceiptEmail(params: PaymentReceiptParams) {
  if (!resend) { warn("sendPaymentReceiptEmail", params); return; }

  const amount = (params.amountCents / 100).toFixed(2);
  const symbol = params.currency === "EUR" ? "€" : params.currency;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: `Comprobante de pago — ${params.concept}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;margin:0 auto;color:#222">
        <div style="background:#1a1a2e;padding:28px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">Pago confirmado ✓</h1>
        </div>
        <div style="background:#f9f7f4;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8">
          <p style="margin-top:0">Gracias. Tu pago fue procesado correctamente.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666">Concepto</td><td style="padding:6px 0;font-weight:bold">${params.concept}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Monto</td><td style="padding:6px 0;font-weight:bold;font-size:18px">${symbol}${amount}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Referencia</td><td style="padding:6px 0;font-size:12px;color:#888">${params.paymentId}</td></tr>
            ${params.stripePaymentIntentId ? `<tr><td style="padding:6px 0;color:#666">Stripe ID</td><td style="padding:6px 0;font-size:12px;color:#888">${params.stripePaymentIntentId}</td></tr>` : ""}
          </table>
          <hr style="border:none;border-top:1px solid #e5e0d8;margin:20px 0"/>
          <p style="color:#777;font-size:13px;margin:0">¿Necesitás ayuda? Respondé a este correo.</p>
        </div>
      </div>
    `,
  });
}

// ──────────────────────────────────────────────────────────
// Confirmación de cita
// ──────────────────────────────────────────────────────────
type AppointmentConfirmationParams = {
  to: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  startAt: Date;
  endAt: Date;
  notes?: string;
};

export async function sendAppointmentConfirmationEmail(params: AppointmentConfirmationParams) {
  if (!resend) { warn("sendAppointmentConfirmationEmail", params); return; }

  const dateStr = params.startAt.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = params.startAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = params.endAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: `Cita confirmada — ${params.serviceName}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;margin:0 auto;color:#222">
        <div style="background:#1a1a2e;padding:28px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">Cita confirmada 📅</h1>
        </div>
        <div style="background:#f9f7f4;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8">
          <p style="margin-top:0">Hola <b>${params.customerName}</b>, tu cita ha sido confirmada.</p>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#666">Servicio</td><td style="padding:6px 0;font-weight:bold">${params.serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Especialista</td><td style="padding:6px 0;font-weight:bold">${params.staffName}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Fecha</td><td style="padding:6px 0;font-weight:bold;text-transform:capitalize">${dateStr}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Horario</td><td style="padding:6px 0;font-weight:bold">${startTime} – ${endTime}</td></tr>
            ${params.notes ? `<tr><td style="padding:6px 0;color:#666;vertical-align:top">Notas</td><td style="padding:6px 0">${params.notes}</td></tr>` : ""}
          </table>
          <hr style="border:none;border-top:1px solid #e5e0d8;margin:20px 0"/>
          <p style="color:#777;font-size:13px;margin:0">¿Necesitás cancelar o reprogramar? Respondé a este correo.</p>
        </div>
      </div>
    `,
  });
}

// ──────────────────────────────────────────────────────────
// Nuevo curso publicado (notificación masiva a estudiantes)
// ──────────────────────────────────────────────────────────
type NewCourseNotificationParams = {
  to: string;
  studentName: string;
  courseTitle: string;
  courseDescription?: string;
  priceCents: number;
  currency: string;
};

export async function sendNewCourseNotificationEmail(params: NewCourseNotificationParams) {
  if (!resend) { warn("sendNewCourseNotificationEmail", params); return; }

  const price = (params.priceCents / 100).toFixed(2);
  const symbol = params.currency === "EUR" ? "€" : params.currency;

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: `¡Nuevo curso disponible — ${params.courseTitle}!`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:560px;margin:0 auto;color:#222">
        <div style="background:#1a1a2e;padding:28px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:22px">¡Nuevo curso disponible! 🎓</h1>
        </div>
        <div style="background:#f9f7f4;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8">
          <p style="margin-top:0">Hola <b>${params.studentName}</b>, hay un nuevo curso esperándote en la plataforma.</p>
          <div style="background:#fff;border:1px solid #e5e0d8;border-radius:10px;padding:20px;margin:16px 0">
            <h2 style="margin:0 0 8px;font-size:18px;color:#1a1a2e">${params.courseTitle}</h2>
            ${params.courseDescription ? `<p style="color:#555;margin:0 0 12px;font-size:14px">${params.courseDescription}</p>` : ""}
            <p style="margin:0;font-size:20px;font-weight:bold;color:#b5684a">${symbol}${price}</p>
          </div>
          <a href="${process.env.NEXTAUTH_URL ?? ""}/courses" style="display:inline-block;background:#b5684a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">Ver curso →</a>
          <hr style="border:none;border-top:1px solid #e5e0d8;margin:24px 0"/>
          <p style="color:#777;font-size:13px;margin:0">Recibís este correo porque estás registrada/o en Apoteósicas by Elizabeth Rizos.</p>
        </div>
      </div>
    `,
  });
}

// ──────────────────────────────────────────────────────────
// Reporte de bug (para administradores)
// ──────────────────────────────────────────────────────────
type BugReportEmailParams = {
  to: string | string[];
  reporterName: string;
  reporterEmail: string;
  title: string;
  description: string;
  bugType: "CONTENT" | "FUNCTIONALITY";
  imageUrls?: string[];
};

export async function sendBugReportEmail(params: BugReportEmailParams) {
  if (!resend) { warn("sendBugReportEmail", params); return; }

  const typeLabel = params.bugType === "FUNCTIONALITY" ? "⚙️ Funcionalidad" : "📝 Contenido";
  const imagesHtml = params.imageUrls && params.imageUrls.length > 0
    ? `<div style="margin-top:16px">
        <b>Imágenes adjuntas (${params.imageUrls.length}):</b>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px">
          ${params.imageUrls.map((url, i) =>
            `<a href="${url}" target="_blank" style="display:block">
              <img src="${url}" alt="Screenshot ${i + 1}" style="max-width:200px;max-height:120px;border-radius:6px;border:1px solid #e5e0d8;object-fit:cover"/>
            </a>`
          ).join("")}
        </div>
      </div>`
    : "";

  const toAddresses = Array.isArray(params.to) ? params.to : [params.to];

  await resend.emails.send({
    from: env.EMAIL_FROM,
    to: toAddresses,
    subject: `[Bug Report] ${params.bugType === "FUNCTIONALITY" ? "⚙️ Funcionalidad" : "📝 Contenido"} — ${params.title}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;max-width:600px;margin:0 auto;color:#222">
        <div style="background:#7f1d1d;padding:24px 32px;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0;font-size:20px">🐛 Reporte de Bug</h1>
        </div>
        <div style="background:#f9f7f4;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e0d8">
          <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
            <tr><td style="padding:6px 0;color:#666;width:130px">Tipo</td><td style="padding:6px 0;font-weight:bold">${typeLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#666">Reportado por</td><td style="padding:6px 0"><b>${params.reporterName}</b> &lt;${params.reporterEmail}&gt;</td></tr>
            <tr><td style="padding:6px 0;color:#666">Título</td><td style="padding:6px 0;font-weight:bold">${params.title}</td></tr>
          </table>
          <div style="background:#fff;border:1px solid #e5e0d8;border-radius:8px;padding:16px">
            <b style="font-size:13px;color:#666;text-transform:uppercase;letter-spacing:0.5px">Descripción</b>
            <p style="margin:8px 0 0;white-space:pre-wrap">${params.description}</p>
          </div>
          ${imagesHtml}
          <hr style="border:none;border-top:1px solid #e5e0d8;margin:20px 0"/>
          <p style="color:#777;font-size:12px;margin:0">Este correo fue generado automáticamente por la plataforma Apoteósicas.</p>
        </div>
      </div>
    `,
  });
}
