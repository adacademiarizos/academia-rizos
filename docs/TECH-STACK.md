# Stack Técnico

## Framework y runtime

| Tecnología | Versión | Uso |
|------------|---------|-----|
| **Next.js** | 16.1.6 | Framework full-stack (App Router) |
| **React** | 19.2.3 | UI |
| **TypeScript** | 5 | Tipado estático |
| **Node.js** | 20+ LTS | Runtime |

## Base de datos

| Tecnología | Uso |
|------------|-----|
| **PostgreSQL** | Base de datos principal (hosteada en Neon) |
| **Prisma** | ORM + migraciones + tipos generados |

El schema tiene ~30 modelos cubriendo usuarios, reservas, cursos, pagos, certificados y comunidad.

## Autenticación

| Tecnología | Uso |
|------------|-----|
| **NextAuth v4** | Sesiones, OAuth, JWT |
| **Google OAuth 2.0** | Login con Google |
| **bcryptjs** | Hash de contraseñas para login por credenciales |

## Pagos

| Tecnología | Uso |
|------------|-----|
| **Stripe** | Checkout sessions, payment intents, webhooks |
| Stripe Checkout | UI de pago hosteada por Stripe |
| Webhooks | Fuente de verdad para confirmar pagos |

## Almacenamiento de archivos

| Tecnología | Uso |
|------------|-----|
| **Cloudflare R2** | Videos, PDFs, imágenes, certificados (compatible con S3 API) |
| **@aws-sdk/client-s3** | Cliente S3 apuntando a R2 |

## Inteligencia Artificial

| Tecnología | Uso |
|------------|-----|
| **OpenAI API (GPT-4o)** | Chat IA por curso, generación de sinopsis |
| **Whisper (OpenAI)** | Transcripción automática de videos |

## Email

| Tecnología | Uso |
|------------|-----|
| **Nodemailer** | Envío de correos transaccionales |
| **Gmail OAuth2** | Transporte SMTP usando cuenta Gmail |
| **Resend** (fallback) | Alternativa si no se configura Gmail |

Emails que se envían:
- Confirmación de reserva
- Comprobante de pago
- Bienvenida al curso
- Certificado de finalización
- Notificación de nueva lección
- Notificación de revisión de examen

## Generación de PDFs

| Tecnología | Uso |
|------------|-----|
| **Puppeteer** | Renderiza HTML → PDF para certificados |
| **qrcode** | Genera QR de verificación público |

## Procesamiento de video

| Tecnología | Uso |
|------------|-----|
| **ffmpeg** | Extracción de audio para transcripción |
| **fluent-ffmpeg** | Wrapper Node.js para ffmpeg |

> Nota: ffmpeg debe estar disponible en el entorno de ejecución. En Vercel, usar la capa de Lambda apropiada o delegar la transcripción a un servicio externo.

## UI y estilos

| Tecnología | Uso |
|------------|-----|
| **Tailwind CSS v4** | Utilidades CSS + sistema de diseño |
| **GSAP** | Animaciones complejas (marketing) |
| **Framer Motion** | Animaciones React |
| **Lucide React** | Íconos |
| **React Hook Form + Zod** | Formularios con validación |

## Infraestructura de despliegue

| Tecnología | Uso |
|------------|-----|
| **Vercel** | Hosting Next.js (serverless) |
| **Neon** | PostgreSQL serverless (compatible con Vercel) |
| **Cloudflare R2** | Almacenamiento de objetos (evitar egress costs de AWS) |
| **GitHub** | Control de versiones + CI/CD via Vercel |

---

## Por qué estas elecciones

**Next.js App Router**: permite mezclar Server Components (sin JS en cliente, acceso directo a DB) con Client Components donde hace falta interactividad. Simplifica auth, API routes y despliegue.

**Neon**: PostgreSQL serverless con connection pooling nativo para entornos sin estado (Vercel lambdas). Compatible con Prisma sin configuración especial.

**Cloudflare R2**: almacenamiento S3-compatible sin costos de egress. Ideal para videos de cursos y certificados PDF que se sirven a usuarios finales.

**Stripe**: el estándar para pagos en Europa/Latam. Los webhooks permiten confirmar pagos de forma confiable sin depender del redirect del navegador.

**Puppeteer en Vercel**: funciona con `puppeteer-core` + capa de Chromium. Requiere configurar la función como "fluid compute" o usar una capa edge separada si genera timeouts. Ver `DEPLOY.md` para configuración.
