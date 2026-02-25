// @ts-ignore
import QRCode from 'qrcode'

export interface CertificatePdfParams {
  userName: string
  courseName: string
  code: string
  issuedAt: Date
}

export async function generateCertificatePdf(params: CertificatePdfParams): Promise<Buffer> {
  const { userName, courseName, code, issuedAt } = params

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const verifyUrl = `${appUrl}/verify/certificate/${code}`

  // Generate QR code as base64 PNG (ivory on transparent)
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 140,
    margin: 1,
    color: {
      dark: '#FAF4EA',
      light: '#00000000',
    },
  })

  const dateStr = issuedAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@300;400;600&display=swap');

    body {
      width: 297mm;
      height: 210mm;
      background: #181716;
      font-family: 'Inter', Arial, sans-serif;
      color: #FAF4EA;
      overflow: hidden;
      position: relative;
    }

    /* Subtle grain texture overlay */
    body::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
    }

    .frame {
      position: absolute;
      inset: 16px;
      border: 1px solid rgba(177, 110, 52, 0.35);
      border-radius: 2px;
      pointer-events: none;
    }
    .frame-inner {
      position: absolute;
      inset: 22px;
      border: 1px solid rgba(177, 110, 52, 0.15);
      border-radius: 2px;
      pointer-events: none;
    }

    /* Corner ornaments */
    .corner {
      position: absolute;
      width: 32px;
      height: 32px;
    }
    .corner svg { width: 100%; height: 100%; }
    .corner-tl { top: 12px; left: 12px; }
    .corner-tr { top: 12px; right: 12px; transform: scaleX(-1); }
    .corner-bl { bottom: 12px; left: 12px; transform: scaleY(-1); }
    .corner-br { bottom: 12px; right: 12px; transform: scale(-1); }

    .content {
      position: relative;
      z-index: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 80px;
      text-align: center;
    }

    .kicker {
      font-size: 11px;
      letter-spacing: 5px;
      text-transform: uppercase;
      color: rgba(177, 110, 52, 0.8);
      font-weight: 600;
      margin-bottom: 10px;
    }

    .title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 30px;
      letter-spacing: 4px;
      text-transform: uppercase;
      color: #FAF4EA;
      font-weight: 400;
      margin-bottom: 28px;
    }

    .divider {
      width: 200px;
      height: 18px;
      margin: 0 auto 28px;
      line-height: 0;
    }

    .presented {
      font-size: 12px;
      color: rgba(250, 244, 234, 0.55);
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-bottom: 14px;
    }

    .student-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 52px;
      font-weight: 700;
      font-style: italic;
      color: #B16E34;
      line-height: 1.1;
      margin-bottom: 24px;
      max-width: 500px;
    }

    .completion-text {
      font-size: 13px;
      color: rgba(250, 244, 234, 0.65);
      letter-spacing: 1px;
      margin-bottom: 10px;
    }

    .course-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 22px;
      font-weight: 700;
      color: #FAF4EA;
      margin-bottom: 10px;
      max-width: 420px;
    }

    .issued-date {
      font-size: 12px;
      color: rgba(250, 244, 234, 0.4);
      letter-spacing: 1px;
    }

    /* ── Rizo decoration ─────────────────────────── */
    .rizo-bg {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
      pointer-events: none;
    }
    .curl-side {
      position: absolute;
      top: 0;
      height: 100%;
      width: 88px;
      z-index: 0;
      pointer-events: none;
      overflow: visible;
    }
    .curl-side.left  { left: 0; }
    .curl-side.right { right: 0; transform: scaleX(-1); }

    /* Bottom bar */
    .bottom-bar {
      position: absolute;
      bottom: 32px;
      left: 40px;
      right: 40px;
      z-index: 1;
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
    }

    .brand {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 3px;
    }
    .brand-name {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: #B16E34;
      letter-spacing: 1px;
    }
    .brand-tagline {
      font-size: 9px;
      color: rgba(250, 244, 234, 0.3);
      letter-spacing: 2px;
      text-transform: uppercase;
    }

    .qr-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .qr-block img {
      width: 80px;
      height: 80px;
    }
    .cert-code {
      font-family: 'Courier New', monospace;
      font-size: 8px;
      color: rgba(250, 244, 234, 0.35);
      letter-spacing: 1px;
    }
  </style>
</head>
<body>
  <!-- Decorative frame -->
  <div class="frame"></div>
  <div class="frame-inner"></div>

  <!-- ── Rizo background pattern ───────────────────────────────── -->
  <svg class="rizo-bg" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="rp" x="0" y="0" width="80" height="100" patternUnits="userSpaceOnUse">
        <path d="M40,8 C57,8 65,21 61,35 C57,49 43,52 37,42 C31,32 38,22 46,24
                 C53,26 55,37 50,43 C46,48 39,47 37,40 C35,33 40,28 45,31
                 C48,33 49,39 46,43 C44,46 41,44 40,41"
          fill="none" stroke="#B16E34" stroke-width="1.1"
          stroke-linecap="round" opacity="0.11"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#rp)"/>
  </svg>

  <!-- ── Left curl cluster ──────────────────────────────────────── -->
  <svg class="curl-side left" viewBox="0 0 88 210"
    preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    fill="none" stroke-linecap="round">
    <!-- Focal spiral — large ringlet at top -->
    <path d="M62,16 C81,16 90,31 85,49 C80,67 62,70 54,57
             C46,44 55,29 65,33 C73,36 75,50 68,58
             C62,65 52,62 50,54 C48,46 54,39 60,42
             C64,45 65,52 61,57 C58,61 53,58 52,54"
      stroke="#B16E34" stroke-width="2.2" opacity="0.44"/>
    <!-- Flowing strand 1 (thickest) -->
    <path d="M68,64 C46,80 76,106 52,130 C28,154 62,177 43,207"
      stroke="#B16E34" stroke-width="2.6" opacity="0.19"/>
    <!-- Flowing strand 2 -->
    <path d="M50,68 C30,84 54,108 36,132 C18,157 46,174 30,204"
      stroke="#B16E34" stroke-width="1.5" opacity="0.14"/>
    <!-- Flowing strand 3 (thinnest) -->
    <path d="M80,70 C63,84 83,108 67,132 C51,156 71,172 57,202"
      stroke="#B16E34" stroke-width="0.9" opacity="0.11"/>
    <!-- Small accent spiral at bottom -->
    <path d="M44,172 C59,172 67,183 62,195 C57,207 45,208 41,199
             C37,190 45,181 52,184 C58,186 59,196 55,200
             C52,203 48,201 47,197"
      stroke="#B16E34" stroke-width="1.8" opacity="0.35"/>
  </svg>

  <!-- ── Right curl cluster (CSS-mirrored) ─────────────────────── -->
  <svg class="curl-side right" viewBox="0 0 88 210"
    preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"
    fill="none" stroke-linecap="round">
    <path d="M62,16 C81,16 90,31 85,49 C80,67 62,70 54,57
             C46,44 55,29 65,33 C73,36 75,50 68,58
             C62,65 52,62 50,54 C48,46 54,39 60,42
             C64,45 65,52 61,57 C58,61 53,58 52,54"
      stroke="#B16E34" stroke-width="2.2" opacity="0.44"/>
    <path d="M68,64 C46,80 76,106 52,130 C28,154 62,177 43,207"
      stroke="#B16E34" stroke-width="2.6" opacity="0.19"/>
    <path d="M50,68 C30,84 54,108 36,132 C18,157 46,174 30,204"
      stroke="#B16E34" stroke-width="1.5" opacity="0.14"/>
    <path d="M80,70 C63,84 83,108 67,132 C51,156 71,172 57,202"
      stroke="#B16E34" stroke-width="0.9" opacity="0.11"/>
    <path d="M44,172 C59,172 67,183 62,195 C57,207 45,208 41,199
             C37,190 45,181 52,184 C58,186 59,196 55,200
             C52,203 48,201 47,197"
      stroke="#B16E34" stroke-width="1.8" opacity="0.35"/>
  </svg>

  <!-- Corner ornaments -->
  <div class="corner corner-tl">
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2 30 L2 2 L30 2" stroke="#B16E34" stroke-width="1.5" stroke-opacity="0.7"/>
      <path d="M2 14 L14 2" stroke="#B16E34" stroke-width="0.8" stroke-opacity="0.4"/>
    </svg>
  </div>
  <div class="corner corner-tr">
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2 30 L2 2 L30 2" stroke="#B16E34" stroke-width="1.5" stroke-opacity="0.7"/>
      <path d="M2 14 L14 2" stroke="#B16E34" stroke-width="0.8" stroke-opacity="0.4"/>
    </svg>
  </div>
  <div class="corner corner-bl">
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2 30 L2 2 L30 2" stroke="#B16E34" stroke-width="1.5" stroke-opacity="0.7"/>
      <path d="M2 14 L14 2" stroke="#B16E34" stroke-width="0.8" stroke-opacity="0.4"/>
    </svg>
  </div>
  <div class="corner corner-br">
    <svg viewBox="0 0 32 32" fill="none">
      <path d="M2 30 L2 2 L30 2" stroke="#B16E34" stroke-width="1.5" stroke-opacity="0.7"/>
      <path d="M2 14 L14 2" stroke="#B16E34" stroke-width="0.8" stroke-opacity="0.4"/>
    </svg>
  </div>

  <!-- Main content -->
  <div class="content">
    <div class="kicker">Apoteósicas by Elizabeth Rizos</div>
    <div class="title">Certificado de Finalización</div>
    <div class="divider">
      <svg viewBox="0 0 200 18" style="width:200px;height:18px;display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg" fill="none" stroke-linecap="round">
        <!-- Left fade line -->
        <line x1="0" y1="9" x2="76" y2="9" stroke="url(#dlg)" stroke-width="0.8"/>
        <!-- Right fade line -->
        <line x1="124" y1="9" x2="200" y2="9" stroke="url(#drg)" stroke-width="0.8"/>
        <!-- Left mini-curl -->
        <path d="M86,5 C95,5 99,9 96,14 C93,18 87,17 86,13 C85,9 89,7 92,9 C94,11 93,15 90,14"
          stroke="#B16E34" stroke-width="1.3" opacity="0.9"/>
        <!-- Right mini-curl (mirror) -->
        <path d="M114,5 C105,5 101,9 104,14 C107,18 113,17 114,13 C115,9 111,7 108,9 C106,11 107,15 110,14"
          stroke="#B16E34" stroke-width="1.3" opacity="0.9"/>
        <!-- Center diamond -->
        <circle cx="100" cy="9" r="2" fill="#B16E34" opacity="0.95"/>
        <defs>
          <linearGradient id="dlg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#B16E34" stop-opacity="0"/>
            <stop offset="100%" stop-color="#B16E34" stop-opacity="0.55"/>
          </linearGradient>
          <linearGradient id="drg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#B16E34" stop-opacity="0.55"/>
            <stop offset="100%" stop-color="#B16E34" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
    <div class="presented">Se otorga a</div>
    <div class="student-name">${escapeHtml(userName)}</div>
    <div class="completion-text">por haber completado satisfactoriamente el curso</div>
    <div class="course-name">${escapeHtml(courseName)}</div>
    <div class="issued-date">${dateStr}</div>
  </div>

  <!-- Bottom bar: brand + QR -->
  <div class="bottom-bar">
    <div class="brand">
      <div class="brand-name">Apoteósicas</div>
      <div class="brand-tagline">by Elizabeth Rizos — Academia</div>
    </div>
    <div class="qr-block">
      <img src="${qrDataUrl}" alt="QR verificación" />
      <div class="cert-code">${escapeHtml(code)}</div>
    </div>
  </div>
</body>
</html>`

  // Lazy-load puppeteer so it is only evaluated at runtime (not during build)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const puppeteer = (await import('puppeteer')).default

  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdf = await page.pdf({
      format: 'A4',
      landscape: true,
      printBackground: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
