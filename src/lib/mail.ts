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

// ──────────────────────────────────────────────────────────
// 1. Recibo de pago
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
  if (!isGmailConfigured()) { warn("sendPaymentReceiptEmail", params); return; }

  const amount = (params.amountCents / 100).toFixed(2);
  const symbol = params.currency === "EUR" ? "€" : params.currency;

  const rows: Array<[string, string]> = [
    ["Concepto", params.concept],
    ["Monto",    `${symbol}${amount}`],
    ["Referencia", params.paymentId],
  ];
  if (params.stripePaymentIntentId) {
    rows.push(["Stripe ID", params.stripePaymentIntentId]);
  }

  const body = `
    ${emailTitle("Pago confirmado")}
    ${para("Tu pago fue procesado correctamente.")}
    ${dataTable(rows)}
    ${divider()}
    ${para("¿Necesitás ayuda? Respondé a este correo.", true)}
  `;

  const transport = await createGmailTransport();
  await transport.sendMail({
    from: env.EMAIL_FROM,
    to: params.to,
    replyTo: params.to,
    subject: `Comprobante de pago — ${params.concept}`,
    html: shell(`Comprobante de pago — ${params.concept}`, body),
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
    ${para("¿Necesitás cancelar o reprogramar? Respondé a este correo.", true)}
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

// ──────────────────────────────────────────────────────────
// 2b. Notificación de nueva cita (para staff y admins)
// ──────────────────────────────────────────────────────────
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
    ${para("Respondé este correo para contactar directamente al cliente.", true)}
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
    ${para("Recibís este correo porque estás registrada/o en Apoteósicas.", true)}
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
    ${para("Podés descargar el certificado con el botón de arriba o verificarlo en la plataforma con el código.", true)}
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
