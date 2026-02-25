# Guía de Despliegue — Vercel

Esta guía cubre el despliegue completo de la plataforma en producción usando:
- **Vercel** — hosting Next.js
- **Neon** — base de datos PostgreSQL serverless
- **Cloudflare R2** — almacenamiento de archivos
- **OpenAI (ChatGPT)** — funciones de IA

---

## Requisitos previos

- Cuenta en [Vercel](https://vercel.com)
- Cuenta en [Neon](https://neon.tech)
- Cuenta en [Cloudflare](https://cloudflare.com)
- Cuenta en [Stripe](https://stripe.com)
- Proyecto en Google Cloud Console (para OAuth + Gmail)
- Clave de API de [OpenAI](https://platform.openai.com)

---

## Paso 1 — Base de datos (Neon)

1. Crear un nuevo proyecto en [Neon Console](https://console.neon.tech).
2. Copiar el **Connection String** (formato `postgresql://user:pass@host/db?sslmode=require`).
3. Guardarlo como `DATABASE_URL` para el Paso 5.

> Neon incluye connection pooling automático. Usar la URL del **pooler** (puerto `5432`) para producción en Vercel lambdas.

```bash
# Aplicar el schema en producción (ejecutar localmente apuntando a Neon)
DATABASE_URL="postgresql://..." npx prisma db push
```

---

## Paso 2 — Almacenamiento (Cloudflare R2)

### 2.1 Crear bucket

1. Dashboard Cloudflare → **R2 Object Storage** → **Create bucket**.
2. Nombre sugerido: `academia-rizos`.
3. En la configuración del bucket, habilitar **Public Access** (necesario para videos y PDFs públicos).
4. El dominio público será algo como `pub-XXXX.r2.dev` o un dominio personalizado.

### 2.2 Crear API token

1. **R2 → Manage R2 API tokens → Create API token**.
2. Permisos: `Object Read & Write` sobre el bucket creado.
3. Guardar `Access Key ID` y `Secret Access Key`.

### 2.3 Variables resultantes

```env
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<access_key_id>
R2_SECRET_ACCESS_KEY=<secret_access_key>
R2_BUCKET_NAME=academia-rizos
R2_PUBLIC_URL=https://pub-XXXX.r2.dev
```

> `R2_ENDPOINT` usa el Account ID de Cloudflare, visible en la URL del dashboard.

---

## Paso 3 — Stripe

1. Crear cuenta/proyecto en [Stripe Dashboard](https://dashboard.stripe.com).
2. Activar modo producción cuando estés listo (en pruebas usar claves `pk_test_` / `sk_test_`).
3. Copiar:
   - **Publishable key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - **Secret key** → `STRIPE_SECRET_KEY`

### 3.1 Webhook

1. En Stripe: **Developers → Webhooks → Add endpoint**.
2. URL: `https://tu-dominio.vercel.app/api/stripe/webhook`
3. Eventos a escuchar:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
4. Copiar el **Signing secret** del webhook → `STRIPE_WEBHOOK_SECRET`

---

## Paso 4 — Google OAuth (autenticación de usuarios)

1. [Google Cloud Console](https://console.cloud.google.com) → Crear proyecto.
2. **APIs & Services → OAuth consent screen** → Configurar pantalla de consentimiento.
3. **Credentials → Create credentials → OAuth 2.0 Client IDs**.
   - Application type: **Web application**
   - Authorized redirect URIs: `https://tu-dominio.vercel.app/api/auth/callback/google`
4. Copiar `Client ID` → `GOOGLE_CLIENT_ID`
5. Copiar `Client Secret` → `GOOGLE_CLIENT_SECRET`

---

## Paso 5 — OpenAI (IA / ChatGPT)

1. Ir a [platform.openai.com/api-keys](https://platform.openai.com/api-keys).
2. **Create new secret key**.
3. Copiar la clave → `OPENAI_API_KEY`.

La plataforma usa GPT-4o para:
- Generación de sinopsis de lecciones
- Respuestas del chat IA por curso

> Las transcripciones de video usan Whisper (también via OpenAI API). Asegurarse de que el tier de la cuenta tenga acceso a `gpt-4o` y `whisper-1`.

---

## Paso 6 — Email (Gmail OAuth2)

La plataforma usa Gmail para enviar correos transaccionales mediante OAuth2 (sin contraseña de aplicación).

### 6.1 Habilitar scope de Gmail en Google Cloud

1. En el proyecto de Google Cloud del Paso 4.
2. **APIs & Services → Library** → Buscar **Gmail API** → Habilitarla.
3. En las credenciales OAuth del Paso 4, no es necesario crear credenciales nuevas; usar las mismas.

### 6.2 Obtener el refresh token

```bash
# Instalar dependencias si no están
npm install

# Ejecutar el helper (requiere GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en .env.local)
node scripts/get-gmail-token.mjs
```

El script:
1. Imprime una URL → abrirla en el navegador con la cuenta de Gmail desde la que se enviarán los correos.
2. Autorizar los permisos de Gmail.
3. Pegar el código que aparece en la URL de redirección.
4. El script imprime el `refresh_token`.

```env
GMAIL_USER=tu-cuenta@gmail.com
GMAIL_REFRESH_TOKEN=<refresh_token_del_script>
```

---

## Paso 7 — Despliegue en Vercel

### 7.1 Conectar repositorio

1. [vercel.com/new](https://vercel.com/new) → importar repo `adacademiarizos/academia-rizos`.
2. Framework: **Next.js** (detectado automáticamente).
3. Build command: `npx prisma generate && next build`
4. Output directory: `.next` (por defecto)

### 7.2 Variables de entorno

En **Settings → Environment Variables** del proyecto en Vercel, agregar todas las siguientes:

```env
# App
NEXT_PUBLIC_APP_URL=https://tu-dominio.vercel.app

# Base de datos (Neon)
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require

# Auth
NEXTAUTH_SECRET=<string_aleatorio_min_32_chars>
NEXTAUTH_URL=https://tu-dominio.vercel.app
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Cloudflare R2
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=academia-rizos
R2_PUBLIC_URL=https://pub-XXXX.r2.dev

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Email (Gmail OAuth2)
EMAIL_FROM=Apoteósicas <tu-cuenta@gmail.com>
GMAIL_USER=tu-cuenta@gmail.com
GMAIL_REFRESH_TOKEN=...
```

> `NEXTAUTH_SECRET`: generar con `openssl rand -base64 32`

### 7.3 Puppeteer en Vercel (generación de certificados PDF)

Puppeteer requiere Chromium. En Vercel, la función que genera PDFs puede alcanzar el límite de 50MB del bundle.

**Opción recomendada**: usar `@sparticuz/chromium` + `puppeteer-core`.

Actualmente el proyecto usa `puppeteer` completo. Si hay errores de timeout o tamaño en producción, reemplazar en `src/lib/pdf.ts`:

```bash
npm install @sparticuz/chromium puppeteer-core
npm uninstall puppeteer
```

Y en `src/lib/pdf.ts`:
```ts
import chromium from '@sparticuz/chromium'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  args: chromium.args,
  defaultViewport: chromium.defaultViewport,
  executablePath: await chromium.executablePath(),
  headless: chromium.headless,
})
```

También configurar en `vercel.json`:
```json
{
  "functions": {
    "src/app/api/admin/certificates/**": {
      "maxDuration": 60
    }
  }
}
```

---

## Paso 8 — Post-despliegue

### 8.1 Aplicar schema en producción

```bash
DATABASE_URL="postgresql://..." npx prisma db push
```

### 8.2 Crear el primer admin

Registrar un usuario en la app, luego via Neon Console o psql:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'tu@email.com';
```

### 8.3 Configurar Settings en el dashboard

1. Ingresar como admin → **Settings**.
2. Configurar porcentaje y monto fijo de comisión de Stripe.

### 8.4 Configurar horarios

1. Admin → **Horarios**.
2. Establecer días y horas de atención.

---

## Checklist de lanzamiento

- [ ] Variables de entorno configuradas en Vercel
- [ ] Schema aplicado en BD Neon
- [ ] Primer usuario ADMIN creado en BD
- [ ] Stripe webhook configurado y activo
- [ ] Dominio personalizado configurado en Vercel (opcional)
- [ ] URL en `NEXT_PUBLIC_APP_URL` y `NEXTAUTH_URL` actualizada al dominio definitivo
- [ ] URL del webhook de Stripe actualizada al dominio definitivo
- [ ] URL de redirect de Google OAuth actualizada al dominio definitivo

---

## Variables de entorno — referencia rápida

| Variable | Requerida | Fuente |
|----------|-----------|--------|
| `NEXT_PUBLIC_APP_URL` | Sí | Tu dominio |
| `DATABASE_URL` | Sí | Neon Console |
| `NEXTAUTH_SECRET` | Sí | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Sí | Tu dominio |
| `GOOGLE_CLIENT_ID` | Sí | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Sí | Google Cloud Console |
| `STRIPE_SECRET_KEY` | Sí | Stripe Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Sí | Stripe → Webhooks |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Sí | Stripe Dashboard |
| `R2_ENDPOINT` | Sí | Cloudflare R2 |
| `R2_ACCESS_KEY_ID` | Sí | Cloudflare R2 |
| `R2_SECRET_ACCESS_KEY` | Sí | Cloudflare R2 |
| `R2_BUCKET_NAME` | Sí | Cloudflare R2 |
| `R2_PUBLIC_URL` | Sí | Cloudflare R2 (public URL) |
| `OPENAI_API_KEY` | Sí (para IA) | platform.openai.com |
| `EMAIL_FROM` | Sí | Tu dirección Gmail |
| `GMAIL_USER` | Sí (email) | Tu dirección Gmail |
| `GMAIL_REFRESH_TOKEN` | Sí (email) | `node scripts/get-gmail-token.mjs` |
