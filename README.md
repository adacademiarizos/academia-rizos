# Apoteósicas — Elizabeth Rizos Platform

Plataforma integral para el negocio de Elizabeth Rizos: sitio de marketing, sistema de reservas con pago online y academia de cursos de rizos con certificación.

---

## ¿Qué es esto?

Una aplicación web full-stack construida con **Next.js 16 (App Router)** que unifica tres productos en un solo sistema:

1. **Sitio de marketing** — presentación de la marca, servicios, galería de resultados, horarios y FAQ.
2. **Sistema de reservas** — los clientes reservan y pagan online; el equipo gestiona citas desde el dashboard.
3. **Academia online (LMS)** — cursos con módulos de video, tests, revisión manual y certificados PDF verificables.

---

## Lo que puedes hacer

| Módulo | Funcionalidades |
|--------|----------------|
| **Marketing** | Página pública con hero, servicios 3D, galería antes/después, FAQ, horarios, bloque de testimonios |
| **Reservas** | Wizard de reserva (servicio → profesional → fecha → pago), disponibilidad en tiempo real, reglas de cobro (completo / depósito / autorización) |
| **Pagos** | Stripe Checkout, webhooks, links de pago personalizados, comisiones configurables |
| **Academia** | Cursos con módulos de video, lecciones, recursos descargables, tests por módulo y examen final |
| **IA** | Transcripción automática de videos, sinopsis de lecciones generada con GPT-4o, chat con IA por curso |
| **Certificados** | PDF con diseño de marca + QR de verificación pública, emitido automáticamente al aprobar |
| **Comunidad** | Comentarios, likes y chat por curso (solo compradores) |
| **Admin** | Dashboard completo: servicios, staff, citas, horarios, cursos, certificados, usuarios, FAQ, antes/después, settings |
| **Staff** | Panel reducido: mis citas, links de pago, historial de clientes |
| **Notificaciones** | Emails transaccionales (confirmación de reserva, comprobante de pago, certificado, novedades) |

---

## Lo que NO hace (por ahora)

- No gestiona pagos presenciales ni en efectivo (solo Stripe online).
- No tiene app móvil nativa (solo web responsive).
- El chat comunitario no es en tiempo real vía WebSocket (es pull-based).
- No hay sistema de cupones ni descuentos.
- No gestiona múltiples negocios / multi-tenant.

---

## Stack resumido

```
Next.js 16 · React 19 · TypeScript · Prisma · PostgreSQL (Neon)
Stripe · NextAuth (Google OAuth) · Cloudflare R2 · OpenAI
Tailwind CSS v4 · GSAP · Framer Motion · Puppeteer · Nodemailer
```

Para el detalle completo ver [`docs/TECH-STACK.md`](docs/TECH-STACK.md).
Para la arquitectura y modelos de datos ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
Para desplegar en Vercel ver [`DEPLOY.md`](DEPLOY.md).

---

## Inicio rápido (desarrollo local)

```bash
# 1. Clonar e instalar
git clone https://github.com/adacademiarizos/academia-rizos.git
cd academia-rizos
npm install

# 2. Variables de entorno
cp .env.example .env.local
# Completar todas las variables (ver DEPLOY.md)

# 3. Base de datos
npx prisma db push
npx prisma generate

# 4. Iniciar servidor
npm run dev
```

La app corre en `http://localhost:3000`.

---

## Estructura de carpetas

```
src/
  app/
    (marketing)/     # Sitio público (home, horarios, cursos)
    (dashboard)/     # Admin y staff (rutas protegidas)
    api/             # 100+ endpoints REST
    booking/         # Wizard de reservas
    pay/             # Páginas de pago
    verify/          # Verificación pública de certificados
  components/        # Componentes reutilizables
  lib/               # Helpers: db, auth, stripe, storage, mail, pdf
  server/services/   # Lógica de negocio del servidor
  types/             # Tipos TypeScript compartidos
prisma/
  schema.prisma      # 30+ modelos de datos
docs/                # Documentación técnica
```

---

## Licencia

Uso comercial exclusivo de Elizabeth Rizos. Todos los derechos reservados.
