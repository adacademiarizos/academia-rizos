import { env } from "@/lib/env";
import { createGmailTransport } from "@/lib/gmail";

// ─── Design tokens ────────────────────────────────────────
// Mirrors the site palette exactly.
const C = {
  bg:        "#0D0C0B",   // outermost background
  card:      "#181716",   // card background
  cardAlt:   "#211F1C",   // slightly lighter inset areas
  border:    "#2E2A25",   // subtle dark border
  copper:    "#B16E34",   // primary accent
  copperMid: "#8F5828",   // darker copper for borders
  ivory:     "#FAF4EA",   // primary text
  ivoryMid:  "#C4B49A",   // secondary text
  ivoryDim:  "#7A6E60",   // footer/muted text
  white:     "#FFFFFF",
};

// ─── Shared layout shell ────────────────────────────────────
// Every email is wrapped in this. Renders the wordmark header,
// a custom section header, a body area, and a footer.
function shell(title: string, body: string, footerNote = "Apoteósicas by Elizabeth Rizos"): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg}">
<table width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:${C.bg};min-height:100vh">
<tr><td align="center" style="padding:32px 16px">

  <!--[if mso]><table width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="max-width:560px;border-radius:12px;overflow:hidden;border:1px solid ${C.border}">

    <!-- WORDMARK HEADER -->
    <tr>
      <td style="background-color:${C.card};padding:20px 32px;border-bottom:1px solid ${C.border}">
        <span style="font-family:Georgia,serif;font-size:13px;letter-spacing:3px;
          text-transform:uppercase;color:${C.copper};font-style:italic">Apoteósicas</span>
      </td>
    </tr>

    <!-- BODY -->
    <tr>
      <td style="background-color:${C.card};padding:32px 32px 24px">
        ${body}
      </td>
    </tr>

    <!-- FOOTER -->
    <tr>
      <td style="background-color:${C.cardAlt};padding:16px 32px;
        border-top:1px solid ${C.border}">
        <span style="font-family:Arial,sans-serif;font-size:12px;color:${C.ivoryDim}">
          ${footerNote}
        </span>
      </td>
    </tr>

  </table>
  <!--[if mso]></td></tr></table><![endif]-->

</td></tr>
</table>
</body>
</html>`;
}

// Reusable sub-components ────────────────────────────────────

function emailTitle(text: string) {
  return `<h1 style="font-family:Georgia,serif;font-size:24px;font-weight:normal;
    color:${C.ivory};margin:0 0 24px;line-height:1.3">${text}</h1>`;
}

function para(text: string, muted = false) {
  return `<p style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;
    color:${muted ? C.ivoryMid : C.ivory};margin:0 0 16px">${text}</p>`;
}

function dataTable(rows: Array<[string, string]>) {
  const cells = rows.map(([label, value]) => `
    <tr>
      <td style="font-family:Arial,sans-serif;font-size:13px;color:${C.ivoryDim};
        padding:8px 12px;white-space:nowrap;border-bottom:1px solid ${C.border}">${label}</td>
      <td style="font-family:Arial,sans-serif;font-size:14px;color:${C.ivory};
        padding:8px 12px;font-weight:bold;border-bottom:1px solid ${C.border}">${value}</td>
    </tr>`).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" border="0"
    style="border-radius:8px;overflow:hidden;border:1px solid ${C.border};margin:0 0 20px">
    ${cells}
  </table>`;
}

function ctaButton(label: string, href: string, secondary = false) {
  return `<a href="${href}"
    style="display:inline-block;font-family:Arial,sans-serif;font-size:14px;
      font-weight:bold;text-decoration:none;padding:12px 24px;border-radius:6px;
      background-color:${secondary ? "transparent" : C.copper};
      color:${secondary ? C.copper : C.ivory};
      border:1px solid ${C.copper}">${label}</a>`;
}

function divider() {
  return `<div style="border-top:1px solid ${C.border};margin:24px 0"></div>`;
}

function insetBlock(content: string) {
  return `<div style="background-color:${C.cardAlt};border:1px solid ${C.border};
    border-radius:8px;padding:16px 20px;margin:0 0 20px">${content}</div>`;
}

// ─── Mail helpers ───────────────────────────────────────────

function warn(fn: string, params: unknown) {
  console.warn(`[mail] GMAIL_USER or GMAIL_REFRESH_TOKEN missing — skipping ${fn}`, params);
}

function isGmailConfigured() {
  return Boolean(env.GMAIL_USER && env.GMAIL_REFRESH_TOKEN);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteInternalActionUrl(actionUrl: string) {
  if (!actionUrl.startsWith("/") || actionUrl.startsWith("//")) {
    throw new Error("Notification email action URL must be an internal relative URL");
  }

  return new URL(actionUrl, env.NEXT_PUBLIC_APP_URL).toString();
}

export type NotificationEmailParams = {
  to: string;
  title: string;
  message: string;
  actionUrl?: string | null;
};

/**
 * Generic, durable-outbox email for transactional notifications. Password-reset
 * emails retain their dedicated template because their sensitive token payload
 * must not be serialized into NotificationDelivery.
 */
export async function sendNotificationEmail(params: NotificationEmailParams) {
  if (!isGmailConfigured()) {
    throw new Error("Gmail notification delivery is not configured");
  }

  const title = escapeHtml(params.title);
  const message = escapeHtml(params.message).replace(/\n/g, "<br/>");
  const actionUrl = params.actionUrl
    ? toAbsoluteInternalActionUrl(params.actionUrl)
    : undefined;
  const action = actionUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td>${ctaButton("Ver detalle", actionUrl)}</td></tr></table>`
    : "";

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: params.title,
    html: shell(
      title,
      `${emailTitle(title)}${para(message)}${action}${divider()}${para("Este mensaje fue generado automáticamente por la plataforma.", true)}`,
    ),
  });
}

type PaymentFailedEmailParams = {
  to: string;
  customerName?: string;
  concept: string;
  amountCents?: number;
  currency?: string;
  failureReason?: string;
  retryUrl?: string;
};

export async function sendPaymentFailedEmail(params: PaymentFailedEmailParams) {
  if (!isGmailConfigured()) { warn("sendPaymentFailedEmail", params); return; }

  const rows: Array<[string, string]> = [["Concepto", params.concept]];
  if (typeof params.amountCents === "number" && params.currency) {
    const amount = (params.amountCents / 100).toFixed(2);
    const symbol = params.currency === "EUR" ? "€" : params.currency;
    rows.push(["Monto", `${symbol}${amount}`]);
  }
  if (params.failureReason) {
    rows.push(["Motivo", params.failureReason]);
  }

  const cta = params.retryUrl
    ? `<table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr><td>${ctaButton("Reintentar pago", params.retryUrl)}</td></tr></table>`
    : "";

  const body = `
    ${emailTitle("No pudimos completar tu pago")}
    ${para(`Hola <strong>${params.customerName ?? "cliente"}</strong>, tu intento de pago no se completó.`)}
    ${dataTable(rows)}
    ${cta}
    ${divider()}
    ${para("Puedes intentarlo nuevamente cuando quieras. Si el problema persiste, responde a este correo para ayudarte.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Pago fallido — ${params.concept}`,
    html: shell(`Pago fallido — ${params.concept}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 2. Confirmación de cita
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
  if (!isGmailConfigured()) { warn("sendAppointmentConfirmationEmail", params); return; }

  const dateStr = params.startAt.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = params.startAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime   = params.endAt.toLocaleTimeString("es-ES",   { hour: "2-digit", minute: "2-digit" });

  const rows: Array<[string, string]> = [
    ["Servicio",    params.serviceName],
    ["Especialista", params.staffName],
    ["Fecha",       dateStr.charAt(0).toUpperCase() + dateStr.slice(1)],
    ["Horario",     `${startTime} – ${endTime}`],
  ];
  if (params.notes) rows.push(["Notas", params.notes]);

  const body = `
    ${emailTitle("Tu cita está confirmada")}
    ${para(`Hola <strong>${params.customerName}</strong>, estos son los detalles de tu cita.`)}
    ${dataTable(rows)}
    ${divider()}
    ${para("¿Necesitas cancelar o reprogramar? Responde a este correo.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Cita confirmada — ${params.serviceName}`,
    html: shell(`Cita confirmada — ${params.serviceName}`, body),
  });
}

type AppointmentCancelledEmailParams = {
  to: string;
  customerName: string;
  serviceName: string;
  staffName: string;
  startAt: Date;
  endAt: Date;
  reason?: string;
};

export async function sendAppointmentCancelledEmail(params: AppointmentCancelledEmailParams) {
  if (!isGmailConfigured()) { warn("sendAppointmentCancelledEmail", params); return; }

  const dateStr = params.startAt.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = params.startAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime = params.endAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const rows: Array<[string, string]> = [
    ["Servicio", params.serviceName],
    ["Especialista", params.staffName],
    ["Fecha", dateStr.charAt(0).toUpperCase() + dateStr.slice(1)],
    ["Horario", `${startTime} – ${endTime}`],
  ];
  if (params.reason) {
    rows.push(["Motivo", params.reason]);
  }

  const body = `
    ${emailTitle("Tu cita fue cancelada")}
    ${para(`Hola <strong>${params.customerName}</strong>, la cita asociada a este pago fue cancelada.`)}
    ${dataTable(rows)}
    ${divider()}
    ${para("Si deseas agendar una nueva cita, puedes responder a este correo y te ayudaremos con el siguiente paso.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Cita cancelada — ${params.serviceName}`,
    html: shell(`Cita cancelada — ${params.serviceName}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 2b. Notificación de nueva cita (para staff y admins)
// ──────────────────────────────────────────────────────────
type PasswordResetEmailParams = {
  to: string;
  resetUrl: string;
};

export async function sendPasswordResetEmail(params: PasswordResetEmailParams) {
  if (!isGmailConfigured()) { warn("sendPasswordResetEmail", params); return; }

  const body = `
    ${emailTitle("Restablece tu contrasena")}
    ${para("Recibimos una solicitud para actualizar la contrasena de tu cuenta.")}
    ${para("Si fuiste tu, usa este enlace para crear una nueva contrasena. Vence en 1 hora y solo puede usarse una vez.")}
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px">
      <tr>
        <td>${ctaButton("Restablecer contrasena", params.resetUrl)}</td>
      </tr>
    </table>
    ${para("Si el boton no funciona, copia y pega este enlace en tu navegador:", true)}
    ${insetBlock(`
      <p style="font-family:Arial,sans-serif;font-size:13px;line-height:1.6;color:${C.ivoryMid};margin:0;word-break:break-all">
        ${params.resetUrl}
      </p>
    `)}
    ${divider()}
    ${para("Si no solicitaste este cambio, puedes ignorar este correo con seguridad.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: "Restablece tu contrasena",
    html: shell("Restablece tu contrasena", body),
  });
}

type AppointmentNotificationParams = {
  to: string | string[];
  customerName: string;
  customerEmail: string;
  serviceName: string;
  staffName: string;
  startAt: Date;
  endAt: Date;
  notes?: string;
};

export async function sendAppointmentNotificationEmail(params: AppointmentNotificationParams) {
  if (!isGmailConfigured()) { warn("sendAppointmentNotificationEmail", params); return; }

  const dateStr = params.startAt.toLocaleDateString("es-ES", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const startTime = params.startAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const endTime   = params.endAt.toLocaleTimeString("es-ES",   { hour: "2-digit", minute: "2-digit" });

  const rows: Array<[string, string]> = [
    ["Cliente",     `${params.customerName} (${params.customerEmail})`],
    ["Servicio",    params.serviceName],
    ["Especialista", params.staffName],
    ["Fecha",       dateStr.charAt(0).toUpperCase() + dateStr.slice(1)],
    ["Horario",     `${startTime} – ${endTime}`],
  ];
  if (params.notes) rows.push(["Notas", params.notes]);

  const body = `
    ${emailTitle("Nueva cita reservada")}
    ${para(`<strong>${params.customerName}</strong> confirmó una cita. Estos son los detalles:`)}
    ${dataTable(rows)}
    ${divider()}
    ${para("Responde a este correo para contactar directamente con el cliente.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: `${params.customerName} <${params.customerEmail}>`,
    subject: `Nueva cita — ${params.customerName} × ${params.serviceName}`,
    html: shell(`Nueva cita — ${params.serviceName}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 3. Nuevo curso publicado
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
  if (!isGmailConfigured()) { warn("sendNewCourseNotificationEmail", params); return; }

  const price  = (params.priceCents / 100).toFixed(2);
  const symbol = params.currency === "EUR" ? "€" : params.currency;
  const coursesUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/courses`;

  const courseCard = insetBlock(`
    <p style="font-family:Georgia,serif;font-size:18px;color:${C.ivory};margin:0 0 8px;
      font-weight:normal">${params.courseTitle}</p>
    ${params.courseDescription
      ? `<p style="font-family:Arial,sans-serif;font-size:13px;color:${C.ivoryMid};margin:0 0 12px;line-height:1.5">${params.courseDescription}</p>`
      : ""}
    <p style="font-family:Georgia,serif;font-size:22px;color:${C.copper};margin:0;font-weight:bold">${symbol}${price}</p>
  `);

  const body = `
    ${emailTitle("Nuevo curso disponible")}
    ${para(`Hola <strong>${params.studentName}</strong>, hay un nuevo curso esperándote en la plataforma.`)}
    ${courseCard}
    <table cellpadding="0" cellspacing="0" border="0"><tr><td>
      ${ctaButton("Ver curso →", coursesUrl)}
    </td></tr></table>
    ${divider()}
    ${para("Recibes este correo porque estás registrado/a en Apoteósicas.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Nuevo curso disponible — ${params.courseTitle}`,
    html: shell(`Nuevo curso — ${params.courseTitle}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 4. Reporte de bug (para administradores)
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
  if (!isGmailConfigured()) { warn("sendBugReportEmail", params); return; }

  const typeLabel = params.bugType === "FUNCTIONALITY" ? "Funcionalidad" : "Contenido";
  const typeIcon  = params.bugType === "FUNCTIONALITY" ? "&#9881;" : "&#128221;"; // ⚙️ 📝

  // Image grid — email-safe 2-column table, images constrained to cell width
  let imagesHtml = "";
  if (params.imageUrls && params.imageUrls.length > 0) {
    // Group images into pairs for a 2-column grid
    const pairs: string[][] = [];
    for (let i = 0; i < params.imageUrls.length; i += 2) {
      pairs.push(params.imageUrls.slice(i, i + 2));
    }

    const rows = pairs.map((pair) => {
      const cells = pair.map((url, idx) => `
        <td width="50%" style="padding:${idx === 1 ? "0 0 8px 4px" : "0 4px 8px 0"}">
          <a href="${url}" target="_blank"
            style="display:block;border-radius:6px;overflow:hidden;line-height:0">
            <img src="${url}" alt="Screenshot"
              width="100%"
              style="width:100%;max-width:100%;height:auto;display:block;
                border-radius:6px;border:1px solid ${C.border}"/>
          </a>
        </td>`).join("");

      // Pad to 2 columns if odd image
      const padded = pair.length < 2
        ? cells + `<td width="50%" style="padding:0 0 8px 4px"></td>`
        : cells;

      return `<tr>${padded}</tr>`;
    }).join("");

    imagesHtml = `
      ${divider()}
      <p style="font-family:Arial,sans-serif;font-size:13px;color:${C.ivoryDim};
        margin:0 0 10px;letter-spacing:0.5px;text-transform:uppercase">
        Capturas adjuntas (${params.imageUrls.length})
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows}
      </table>
    `;
  }

  const descBlock = insetBlock(`
    <p style="font-family:Arial,sans-serif;font-size:12px;color:${C.ivoryDim};
      margin:0 0 8px;letter-spacing:0.8px;text-transform:uppercase">Descripción</p>
    <p style="font-family:Arial,sans-serif;font-size:14px;color:${C.ivory};
      margin:0;line-height:1.6;white-space:pre-wrap">${params.description}</p>
  `);

  const body = `
    ${emailTitle(`${typeIcon}&nbsp; Reporte de ${typeLabel}`)}
    ${dataTable([
      ["Tipo",          typeLabel],
      ["Reportado por", `${params.reporterName} &lt;${params.reporterEmail}&gt;`],
      ["Título",        params.title],
    ])}
    ${descBlock}
    ${imagesHtml}
    ${divider()}
    ${para("Este mensaje fue generado automáticamente por la plataforma.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: `${params.reporterName} <${params.reporterEmail}>`,
    subject: `[Bug] ${typeLabel} — ${params.title}`,
    html: shell(`Bug Report — ${params.title}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 5. Certificado emitido
// ──────────────────────────────────────────────────────────
type CertificateEmailParams = {
  to: string;
  studentName: string;
  courseName: string;
  certificateCode: string;
  pdfUrl: string;
};

export async function sendCertificateEmail(params: CertificateEmailParams) {
  if (!isGmailConfigured()) { warn("sendCertificateEmail", params); return; }

  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const verifyUrl = `${appUrl}/verify/certificate/${params.certificateCode}`;

  const codeBlock = `
    <div style="background-color:${C.cardAlt};border:1px solid ${C.copperMid};
      border-radius:8px;padding:20px;text-align:center;margin:0 0 24px">
      <p style="font-family:Arial,sans-serif;font-size:11px;color:${C.ivoryDim};
        margin:0 0 6px;letter-spacing:1.5px;text-transform:uppercase">Código de certificado</p>
      <p style="font-family:'Courier New',Courier,monospace;font-size:18px;
        color:${C.copper};margin:0;font-weight:bold;letter-spacing:2px">${params.certificateCode}</p>
    </div>
  `;

  // Buttons side by side using table (email-safe, no flex)
  const buttons = `
    <table cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">
      <tr>
        <td style="padding-right:8px">
          ${ctaButton("Descargar certificado", params.pdfUrl)}
        </td>
        <td>
          ${ctaButton("Verificar", verifyUrl, true)}
        </td>
      </tr>
    </table>
  `;

  const body = `
    ${emailTitle("&#127891;&nbsp; ¡Felicitaciones!")}
    ${para(`Hola <strong>${params.studentName}</strong>,`)}
    ${para(`Tu examen fue revisado y aprobado. Has completado exitosamente el curso <strong style="color:${C.copper}">${params.courseName}</strong>.`)}
    ${codeBlock}
    ${buttons}
    ${divider()}
    ${para("Puedes descargar el certificado con el botón de arriba o verificarlo en la plataforma con el código.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Tu certificado de "${params.courseName}" está listo`,
    html: shell(`Certificado — ${params.courseName}`, body),
  });
}

// ──────────────────────────────────────────────────────────
// 6. Alerta de administrador (notificaciones para admins)
// ──────────────────────────────────────────────────────────
type AdminAlertEmailParams = {
  to: string | string[];
  subject: string;
  title: string;
  rows: Array<[string, string]>;
  note?: string;
};

export async function sendAdminAlertEmail(params: AdminAlertEmailParams) {
  if (!isGmailConfigured()) { warn("sendAdminAlertEmail", params); return; }

  const body = `
    ${emailTitle(params.title)}
    ${dataTable(params.rows)}
    ${divider()}
    ${para(params.note ?? "Este mensaje fue generado automáticamente por la plataforma.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    subject: params.subject,
    html: shell(params.title, body),
  });
}

type AccountDeletionVerificationEmailParams = {
  to: string;
  name?: string | null;
  confirmUrl: string;
  expiresAt: Date;
};

export async function sendAccountDeletionVerificationEmail(
  params: AccountDeletionVerificationEmailParams
) {
  if (!isGmailConfigured()) {
    warn("sendAccountDeletionVerificationEmail", params);
    return;
  }

  const expiry = params.expiresAt.toLocaleString("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const body = `
    ${emailTitle("Confirma la eliminacion de tu cuenta")}
    ${para(`Hola <strong>${params.name ?? "usuario"}</strong>, recibimos una solicitud para eliminar tu cuenta de Apoteosicas.`)}
    ${para("Para continuar, confirma la solicitud desde el enlace seguro de abajo. Si no fuiste tu, puedes ignorar este correo.")}
    ${insetBlock(`
      <p style="font-family:Arial,sans-serif;font-size:13px;color:${C.ivoryDim};margin:0 0 8px">Este enlace vence el</p>
      <p style="font-family:Arial,sans-serif;font-size:15px;color:${C.ivory};margin:0;font-weight:bold">${expiry}</p>
    `)}
    <table cellpadding="0" cellspacing="0" border="0"><tr><td>
      ${ctaButton("Confirmar eliminacion", params.confirmUrl)}
    </td></tr></table>
    ${divider()}
    ${para("Seguiran conservandose solo los registros que la ley exige retener, como ciertos datos contables anonimizados.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: "Confirma la eliminacion de tu cuenta",
    html: shell("Confirma la eliminacion de tu cuenta", body),
  });
}

type AccountDeletionConfirmationEmailParams = {
  to: string;
  name?: string | null;
};

export async function sendAccountDeletionConfirmationEmail(
  params: AccountDeletionConfirmationEmailParams
) {
  if (!isGmailConfigured()) {
    warn("sendAccountDeletionConfirmationEmail", params);
    return;
  }

  const body = `
    ${emailTitle("Tu solicitud de eliminacion fue procesada")}
    ${para(`Hola <strong>${params.name ?? "usuario"}</strong>, confirmamos que tu cuenta y los datos personales asociados fueron anonimizados.`)}
    ${para("Los registros que debamos conservar por obligaciones fiscales o contables permanecen guardados de forma minimizada y desvinculada de tu identidad.")}
    ${divider()}
    ${para("Si necesitas constancia adicional de este proceso, responde a este correo y te ayudaremos.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: "Confirmacion de eliminacion de cuenta",
    html: shell("Confirmacion de eliminacion de cuenta", body),
  });
}
