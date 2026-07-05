# Contexto del Proyecto: Elizabeth Rizos Platform (Apoteósicas)

## 1. Idea Base
Plataforma integral para el negocio de Elizabeth Rizos. Unifica tres productos en una sola aplicación Next.js 16 (App Router):
1. **Sitio de marketing** — presentación de marca, servicios, galería antes/después, horarios, FAQ.
2. **Sistema de reservas** — clientes reservan y pagan online (Stripe); el equipo gestiona citas desde el dashboard.
3. **Academia online (LMS)** — cursos con video, tests, revisión manual y certificados PDF verificables por QR.

## 2. Alcance (Scope)
**Incluye (MVP/versión actual):**
- Marketing público (hero, servicios, galería, FAQ, horarios, testimonios).
- Wizard de reserva (servicio → profesional → fecha → pago) con reglas de cobro (completo / depósito / autorización).
- Pagos vía Stripe Checkout + webhooks + links de pago personalizados.
- Cursos con módulos de video, lecciones, recursos descargables, tests por módulo y examen final.
- IA aplicada: transcripción de videos, sinopsis de lecciones (GPT-4o), chat por curso.
- Certificados PDF con marca + QR de verificación pública, emisión automática al aprobar.
- Comunidad: comentarios, likes y chat por curso (solo compradores).
- Dashboard admin completo y panel reducido para staff.
- Notificaciones transaccionales por email (Nodemailer).

**Fuera de alcance (explícitamente NO):**
- Pagos presenciales o en efectivo (solo Stripe online).
- App móvil nativa (solo web responsive).
- Chat comunitario en tiempo real vía WebSocket (es pull-based).
- Sistema de cupones o descuentos.
- Multi-tenant / múltiples negocios.

## 3. Roles de Usuario
- **ADMIN** — acceso total: servicios, staff, citas, horarios, cursos, certificados, usuarios, FAQ, antes/después, settings.
- **STAFF** — panel reducido: sus citas, links de pago propios, historial de clientes.
- **STUDENT** — clientes/alumnos: reservan servicios, compran y cursan la academia, ven certificados y participan en la comunidad del curso.
- **Visitante (no autenticado)** — solo ve el sitio de marketing público; no accede a dashboard ni academia.

## 4. Reglas de Negocio Críticas
- Todos los pagos se procesan en Stripe (no hay flujo de pago presencial/efectivo en el sistema).
- La disponibilidad de reservas se calcula en tiempo real contra horarios y citas existentes.
- Las reglas de cobro (`FULL` / `DEPOSIT` / `AUTHORIZE`) determinan cómo se cobra cada servicio.
- Los certificados solo se emiten automáticamente cuando el alumno aprueba el examen final del curso.
- El chat y comentarios de un curso están restringidos a compradores de ese curso.
- Autenticación vía NextAuth con Google OAuth; los roles (`ADMIN`, `STAFF`, `STUDENT`) gobiernan el acceso a cada área de la app.
- Base de datos: PostgreSQL (Neon) vía Prisma — todo cambio de esquema pasa por migración versionada.

## 5. Stack Tecnológico
```
Next.js 16 (App Router) · React 19 · TypeScript · Prisma · PostgreSQL (Neon)
Stripe · NextAuth (Google OAuth) · Cloudflare R2 · OpenAI (GPT-4o)
Tailwind CSS v4 · GSAP · Framer Motion · Puppeteer · Nodemailer
```
