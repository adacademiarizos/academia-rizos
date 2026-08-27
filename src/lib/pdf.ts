// @ts-expect-error qrcode has no declarations available in this compiler setup.
import QRCode from 'qrcode'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export interface CertificatePdfParams {
  userName: string
  courseName: string
  certificateSlogan: string
  code: string
  issuedAt: Date
}

type CertificateAssets = {
  background: string
  logo: string
  seal: string
  cormorant: string
  greatVibes: string
  manrope: string
}

const certificateAssetDirectory = join(process.cwd(), 'public', 'certificates')

function toDataUri(buffer: Buffer, mimeType: string) {
  return `data:${mimeType};base64,${buffer.toString('base64')}`
}

const certificateAssetsPromise: Promise<CertificateAssets> = Promise.all([
  readFile(join(certificateAssetDirectory, 'certificate-background.png')),
  readFile(join(certificateAssetDirectory, 'er-logo.png')),
  readFile(join(certificateAssetDirectory, 'seal-badge.png')),
  readFile(join(certificateAssetDirectory, 'cormorant-garamond-latin-ext.woff2')),
  readFile(join(certificateAssetDirectory, 'great-vibes-latin-ext.woff2')),
  readFile(join(certificateAssetDirectory, 'manrope-latin-ext.woff2')),
]).then(([background, logo, seal, cormorant, greatVibes, manrope]) => ({
  background: toDataUri(background, 'image/png'),
  logo: toDataUri(logo, 'image/png'),
  seal: toDataUri(seal, 'image/png'),
  cormorant: toDataUri(cormorant, 'font/woff2'),
  greatVibes: toDataUri(greatVibes, 'font/woff2'),
  manrope: toDataUri(manrope, 'font/woff2'),
}))

export async function buildCertificateHtml(params: CertificatePdfParams): Promise<string> {
  const { userName, courseName, certificateSlogan, code, issuedAt } = params
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const verifyUrl = `${appUrl}/verify/certificate/${code}`
  const [assets, qrDataUrl] = await Promise.all([
    certificateAssetsPromise,
    QRCode.toDataURL(verifyUrl, {
      width: 120,
      margin: 0,
      color: {
        dark: '#4f5634',
        light: '#fff9f2',
      },
      errorCorrectionLevel: 'H',
    }),
  ])

  const date = issuedAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <style>
    @font-face { font-family: 'Cormorant Garamond'; src: url('${assets.cormorant}') format('woff2'); font-weight: 400 600; font-style: normal; font-display: block; }
    @font-face { font-family: 'Great Vibes'; src: url('${assets.greatVibes}') format('woff2'); font-weight: 400; font-style: normal; font-display: block; }
    @font-face { font-family: 'Manrope'; src: url('${assets.manrope}') format('woff2'); font-weight: 400 600; font-style: normal; font-display: block; }

    :root { --copper: #b16e34; --olive: #6f7546; --ink: #42433f; --paper: #fff9f2; }
    * { box-sizing: border-box; }
    @page { size: 297mm 210mm; margin: 0; }
    html, body { margin: 0; width: 297mm; height: 210mm; background: white; color: var(--ink); font-family: 'Manrope', Arial, sans-serif; }
    .certificate { --s: 0.7525; position: relative; width: 297mm; height: 210mm; overflow: hidden; }
    .background { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .brand-name, .title, .student, .course { font-family: 'Cormorant Garamond', Georgia, serif; }
    .brand-name { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 103px); transform: translateX(-50%); color: var(--copper); font-size: calc(var(--s) * 73px); line-height: .9; font-weight: 500; letter-spacing: .01em; z-index: 2; }
    .brand-pill { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 174px); transform: translateX(-50%); min-width: calc(var(--s) * 234px); padding: calc(var(--s) * 6px) calc(var(--s) * 20px) calc(var(--s) * 8px); border-radius: 999px; background: var(--copper); color: #fffaf4; font-family: 'Cormorant Garamond', Georgia, serif; font-size: calc(var(--s) * 22px); line-height: 1; text-align: center; z-index: 2; }
    .er-logo { position: absolute; left: calc(var(--s) * 1266px); top: calc(var(--s) * 93px); width: calc(var(--s) * 111px); height: auto; z-index: 2; }
    .title { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 255px); transform: translateX(-50%); margin: 0; color: var(--copper); font-size: calc(var(--s) * 131px); font-weight: 500; line-height: .88; letter-spacing: .01em; z-index: 2; }
    .ornament { position: absolute; display: flex; align-items: center; justify-content: center; gap: calc(var(--s) * 8px); color: #d59b63; z-index: 2; }
    .ornament span { width: calc(var(--s) * 119px); height: 1px; background: currentColor; }
    .ornament b { font-size: calc(var(--s) * 26px); line-height: 1; font-weight: 400; font-family: Georgia, serif; }
    .ornament-top { left: calc(var(--s) * 744px); top: calc(var(--s) * 401px); transform: translateX(-50%); }
    .intro { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 420px); transform: translateX(-50%); color: #3f443c; font-size: calc(var(--s) * 23px); z-index: 2; }
    .student { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 456px); transform: translateX(-50%); color: var(--olive); font-size: calc(var(--s) * 78px); line-height: .94; font-weight: 500; letter-spacing: .01em; white-space: nowrap; max-width: calc(var(--s) * 970px); text-align: center; z-index: 2; }
    .body-copy { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 570px); transform: translateX(-50%); color: #454742; font-size: calc(var(--s) * 21px); z-index: 2; }
    .course-row { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 615px); transform: translateX(-50%); display: flex; align-items: center; gap: calc(var(--s) * 18px); z-index: 2; }
    .course { color: var(--copper); font-size: calc(var(--s) * 67px); line-height: .95; font-weight: 500; letter-spacing: .01em; white-space: nowrap; text-align: center; }
    .leaf { width: calc(var(--s) * 52px); height: auto; color: #f0b37b; flex: 0 0 auto; }
    .leaf path { fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; }
    .ornament-middle { left: calc(var(--s) * 744px); top: calc(var(--s) * 686px); transform: translateX(-50%); }
    .ornament-middle span, .ornament-bottom span { width: calc(var(--s) * 74px); }
    .ornament-middle b, .ornament-bottom b { font-size: calc(var(--s) * 22px); }
    .specialization { position: absolute; left: calc(var(--s) * 744px); top: calc(var(--s) * 724px); transform: translateX(-50%); color: var(--olive); font-size: calc(var(--s) * 18px); white-space: nowrap; z-index: 2; }
    .field { position: absolute; text-align: center; z-index: 2; }
    .line { height: 1px; background: var(--copper); }
    .label { margin-top: calc(var(--s) * 10px); font-size: calc(var(--s) * 14px); color: #474842; }
    .field-date { left: calc(var(--s) * 288px); top: calc(var(--s) * 845px); width: calc(var(--s) * 215px); }
    .date { margin-bottom: calc(var(--s) * 8px); color: #474842; font-size: calc(var(--s) * 14px); line-height: 1; white-space: nowrap; }
    .seal-image { position: absolute; left: calc(var(--s) * 594px); top: calc(var(--s) * 783px); width: calc(var(--s) * 139px); height: auto; z-index: 2; }
    .field-signature { left: calc(var(--s) * 762px); top: calc(var(--s) * 828px); width: calc(var(--s) * 257px); }
    .signature { margin-bottom: calc(var(--s) * 8px); color: var(--olive); font-family: 'Great Vibes', cursive; font-size: calc(var(--s) * 38px); line-height: 1; white-space: nowrap; }
    .field-code { left: calc(var(--s) * 1081px); top: calc(var(--s) * 828px); width: calc(var(--s) * 134px); }
    .code { margin-bottom: calc(var(--s) * 7px); font-size: calc(var(--s) * 16px); color: #4b4d47; }
    .qr-box { position: absolute; left: calc(var(--s) * 1231px); top: calc(var(--s) * 610px); width: calc(var(--s) * 163px); min-height: calc(var(--s) * 244px); padding: calc(var(--s) * 15px) calc(var(--s) * 11px) calc(var(--s) * 14px); border: calc(var(--s) * 2px) solid var(--copper); border-radius: calc(var(--s) * 24px) calc(var(--s) * 24px) calc(var(--s) * 8px) calc(var(--s) * 8px); background: rgba(255,250,243,.88); text-align: center; color: var(--olive); z-index: 2; }
    .qr-box::before { content: ''; position: absolute; inset: calc(var(--s) * 7px); border: 1px solid rgba(177,110,52,.55); border-radius: calc(var(--s) * 17px) calc(var(--s) * 17px) calc(var(--s) * 6px) calc(var(--s) * 6px); pointer-events: none; }
    .qr-title { position: relative; z-index: 1; font-size: calc(var(--s) * 12px); font-weight: 600; margin-bottom: calc(var(--s) * 7px); }
    .qr-code { position: relative; z-index: 1; display: grid; place-items: center; padding: calc(var(--s) * 3px); }
    .qr-code img { width: calc(var(--s) * 118px); height: calc(var(--s) * 118px); image-rendering: pixelated; }
    .qr-caption { position: relative; z-index: 1; margin-top: calc(var(--s) * 7px); font-size: calc(var(--s) * 12px); }
    .qr-orn { position: absolute; left: 50%; transform: translateX(-50%); display: flex; align-items: center; justify-content: center; gap: calc(var(--s) * 3px); width: calc(var(--s) * 46px); color: var(--copper); }
    .qr-orn span { width: calc(var(--s) * 15px); height: 1px; background: currentColor; }
    .qr-orn b { font-size: calc(var(--s) * 10px); line-height: 1; font-weight: 400; font-family: Georgia, serif; }
    .qr-orn.top { top: calc(var(--s) * -8px); }
    .qr-orn.bottom { bottom: calc(var(--s) * -8px); }
    .ornament-bottom { left: calc(var(--s) * 744px); top: calc(var(--s) * 983px); transform: translateX(-50%); }
  </style>
</head>
<body>
  <section class="certificate">
    <img class="background" src="${assets.background}" alt="" />
    <div class="brand-name">APOTEÓSICAS</div>
    <div class="brand-pill">by Elizabeth Rizos</div>
    <img class="er-logo" src="${assets.logo}" alt="" />
    <h1 class="title">CERTIFICADO</h1>
    <div class="ornament ornament-top"><span></span><b>∞</b><span></span></div>
    <div class="intro">Se otorga a</div>
    <div class="student">${escapeHtml(userName)}</div>
    <div class="body-copy">Por haber completado satisfactoriamente el curso</div>
    <div class="course-row">
      <svg class="leaf leaf-left" viewBox="0 0 60 36" aria-hidden="true"><path d="M4 18 C17 18, 27 11, 37 5" /><path d="M4 18 C18 18, 28 24, 39 31" /><path d="M22 10 C19 16, 19 20, 20 27" /></svg>
      <div class="course">${escapeHtml(courseName)}</div>
      <svg class="leaf leaf-right" viewBox="0 0 60 36" aria-hidden="true"><path d="M56 18 C43 18, 33 11, 23 5" /><path d="M56 18 C42 18, 32 24, 21 31" /><path d="M38 10 C41 16, 41 20, 40 27" /></svg>
    </div>
    <div class="ornament ornament-middle"><span></span><b>∞</b><span></span></div>
    <div class="specialization">${escapeHtml(certificateSlogan)}</div>
    <div class="field field-date"><div class="date">${escapeHtml(date)}</div><div class="line"></div><div class="label">Fecha</div></div>
    <img class="seal-image" src="${assets.seal}" alt="" />
    <div class="field field-signature"><div class="signature">Elizabeth Rizos</div><div class="line"></div><div class="label">Firma</div></div>
    <div class="field field-code"><div class="code">${escapeHtml(code)}</div><div class="line"></div><div class="label">Código</div></div>
    <div class="qr-box">
      <div class="qr-orn top"><span></span><b>∞</b><span></span></div>
      <div class="qr-title">Escanea para validar</div>
      <div class="qr-code"><img src="${qrDataUrl}" alt="Código QR de validación" /></div>
      <div class="qr-caption">Validación digital</div>
      <div class="qr-orn bottom"><span></span><b>∞</b><span></span></div>
    </div>
    <div class="ornament ornament-bottom"><span></span><b>∞</b><span></span></div>
  </section>
</body>
</html>`
}

export async function generateCertificatePdf(params: CertificatePdfParams): Promise<Buffer> {
  const html = await buildCertificateHtml(params)

  const chromiumBinaryUrl =
    'https://github.com/Sparticuz/chromium/releases/download/v143.0.0/chromium-v143.0.0-pack.x64.tar'

  let browser: import('puppeteer-core').Browser
  if (process.env.NODE_ENV === 'production') {
    const { default: chromium } = await import('@sparticuz/chromium-min')
    const { default: puppeteerCore } = await import('puppeteer-core')
    browser = await puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(chromiumBinaryUrl),
      headless: true,
    })
  } else {
    const { default: puppeteer } = await import('puppeteer')
    browser = await (puppeteer as unknown as typeof import('puppeteer-core').default).launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
      headless: true,
    })
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 })
    const pdf = await page.pdf({
      width: '297mm',
      height: '210mm',
      printBackground: true,
      preferCSSPageSize: true,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
