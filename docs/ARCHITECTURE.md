# Arquitectura de la plataforma

## Visión general

La plataforma es un monolito Next.js (App Router) full-stack que sirve tanto el frontend como el backend desde el mismo repositorio. No hay microservicios separados.

```
Browser / Cliente
      │
      ▼
┌─────────────────────────────┐
│        Next.js 16            │
│  ┌──────────┐  ┌──────────┐ │
│  │  Pages   │  │API Routes│ │
│  │(App Dir) │  │ /api/**  │ │
│  └──────────┘  └──────────┘ │
│        │              │      │
│        └──── Prisma ──┘      │
└─────────┬───────────────────┘
          │
    ┌─────┴──────┐
    │ PostgreSQL │  (Neon)
    └────────────┘

Servicios externos:
  Stripe   — pagos y webhooks
  Cloudflare R2 — archivos (videos, PDFs, imágenes, certificados)
  OpenAI   — transcripción, sinopsis, chat IA
  Gmail / Nodemailer — emails transaccionales
  Vercel Cron — mantenimiento periódico /api/cron/*
```

---

## Capas de la aplicación

### 1. Rutas públicas (marketing)
`src/app/(marketing)/`

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page con hero, servicios, testimonios, FAQ, horarios |
| `/horarios` | Página pública de horarios de atención |
| `/booking` | Wizard de reservas (servidor + cliente) |
| `/pay/[id]` | Checkout de link de pago |
| `/verify/certificate/[code]` | Verificación pública de certificado |
| `/learn/[courseId]` | Dashboard del estudiante en un curso |
| `/learn/[courseId]/modules/[moduleId]` | Player de módulo + lección |
| `/learn/[courseId]/tests/[testId]` | Test de módulo |
| `/register`, `/signin` | Autenticación |

### 2. Dashboard admin
`src/app/(dashboard)/admin/`

Todas las rutas están protegidas server-side. Solo usuarios con `role = ADMIN` tienen acceso.

| Ruta | Descripción |
|------|-------------|
| `/admin` | Overview con métricas generales |
| `/admin/services` | CRUD de servicios |
| `/admin/staff` | Staff y precios por servicio |
| `/admin/appointments` | Gestión de citas |
| `/admin/schedule` | Horarios semanales + días libres |
| `/admin/courses` | CRUD cursos, módulos, lecciones |
| `/admin/courses/[id]/edit` | Editor completo de curso |
| `/admin/certificates` | Certificados emitidos |
| `/admin/certificates/review` | Revisión de exámenes pendientes |
| `/admin/payment-links` | Links de pago |
| `/admin/before-after` | Galería antes/después |
| `/admin/faq` | Preguntas frecuentes |
| `/admin/users` | Gestión de usuarios |
| `/admin/settings` | Configuración de comisiones |
| `/admin/manuales` | Hub de manuales (admin + staff) |
| `/admin/manual` | Manual del administrador |

### Rutas compartidas (todos los roles)
`src/app/(dashboard)/`

| Ruta | Descripción |
|------|-------------|
| `/notifications` | Notificaciones in-app (todos los roles) |
| `/community` | Chat de comunidad |
| `/bug-report` | Reportar bugs |

### 3. Dashboard staff
`src/app/(dashboard)/staff/`

Protegido para `role = STAFF` o `ADMIN`.

| Ruta | Descripción |
|------|-------------|
| `/staff/appointments` | Mis citas asignadas |
| `/staff/payment-links` | Mis links de pago |
| `/staff/clients` | Mis clientes |
| `/staff/manual` | Manual del staff |

### 4. API Routes
`src/app/api/`

Todos los endpoints validan autenticación y permisos server-side. Patrón de respuesta uniforme:

```ts
// Éxito
{ success: true, data: T }

// Error
{ success: false, error: string }
```

Además existe un endpoint interno de mantenimiento `GET /api/cron/[job]`, protegido con `Authorization: Bearer CRON_SECRET`, invocado por Vercel Cron para tareas operativas:

| Job | Propósito |
|------|-------------|
| `expire-access` | Revisa accesos de cursos con `accessUntil` vencido y deja trazabilidad operativa del backlog expirado |
| `issue-certificates` | Reemite como red de seguridad certificados faltantes para aprobaciones finales ya registradas |
| `send-receipts` | Reintenta recibos pendientes para pagos `PAID` cuyo email no quedó marcado como enviado |

---

## Modelos de datos principales

### Usuarios y roles

```
User
  id, name, email, image
  role: ADMIN | STAFF | STUDENT
  └─ StaffProfile (bio, photoUrl, ...)
```

### Reservas

```
Service
  name, durationMin
  billingRule: FULL | DEPOSIT | AUTHORIZE
  depositPct?
  └─ ServiceStaffPrice (staffId, priceCents, currency)

Appointment
  serviceId, staffId, customerId
  startAt, endAt, status
  customerName, customerEmail (desnormalizado para guests)
  └─ Payment[] (puede haber depósito + resto)

Payment
  type: APPOINTMENT | COURSE | PAYMENT_LINK
  status: REQUIRES_PAYMENT | PROCESSING | PAID | FAILED | ...
  amountCents, currency
  stripeCheckoutSessionId?, stripePaymentIntentId?

WebhookEvent
  stripeEventId (único)
  type
  receivedAt, processedAt
  payload? (debug / auditoría)

BusinessHours  — horarios semanales (dayOfWeek, openTime, closeTime)
BusinessOffDay — días libres globales
```

### Academia

```
Course
  title, description, thumbnailUrl
  priceCents, rentalDays?
  isActive
  └─ Module[]
     └─ Lesson[]        (videoUrl, synopsis)
     └─ ModuleTest[]    (tests por módulo)
     └─ ModuleResource[] (PDFs, docs descargables)
  └─ CourseTest[]       (tests globales, isFinalExam?)
  └─ CourseAccess[]     (userId, expiresAt?, revokedAt?)

ModuleProgress  — userId + moduleId, completed
CourseTestSubmission / ExamSubmission — respuestas del estudiante, status: PENDING | APPROVED | REVISION_REQUESTED

Certificate
  code (único, público)
  pdfUrl (en R2)
  valid
  QR → /verify/certificate/[code]
```

#### Modelo academico actual

La jerarquia academica vigente es:

```
Course
  Module[]              -- secciones del curso
    ModuleStyle[]       -- agrupadores editables por seccion
      Lesson[]          -- contenido reproducible
    ModuleTest[]
    ModuleResource[]
```

`ModuleStyle` permite agrupar lecciones por estilo (`General`, `Rizos`, `Lacio`, etc.) dentro de cada seccion. No es una ruta exclusiva del estudiante. `ModuleProgress`, tests, recursos, likes, comentarios, chat y certificados siguen asociados a `Module`/`Course`.

Durante la transicion, `Lesson.moduleId` se mantiene como columna legacy desnormalizada para endpoints antiguos. La relacion canonica nueva es `Lesson.styleId -> ModuleStyle.id`. Ver [`ACADEMY_CONTENT_MODEL.md`](ACADEMY_CONTENT_MODEL.md) para el detalle de migracion, APIs y reglas.

### Comunidad

```
Comment    — courseId | moduleId
Like       — courseId | moduleId
ChatRoom   — por curso (solo compradores)
ChatMessage
Notification
UserActivity / Achievement
```

### Marketing / Soporte

```
BeforeAfterPair — urlBefore, urlAfter, description
FaqItem         — question, answer, order
BugReport       — type: CONTENT | FUNCTIONALITY
Settings        — feePercent, feeFixedCents, defaultCurrency
```

---

## Flujos clave

### Flujo de reserva
```
1. Cliente selecciona servicio → profesional → fecha/hora
2. POST /api/bookings/draft  — crea Appointment(PENDING) + Payment(REQUIRES_PAYMENT)
3. Redirige a Stripe Checkout
4. Stripe llama al webhook POST /api/stripe/webhook
5. El webhook registra WebhookEvent(stripeEventId) para deduplicación
6. Webhook actualiza Payment(PAID) + Appointment(CONFIRMED)
7. Si Stripe luego envía `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded` o disputas, el mismo webhook sincroniza Payment + Appointment automáticamente
8. Email confirmación al cliente
```

### Flujo de compra de curso
```
1. Cliente va a /learn/[courseId] → clic en Comprar
2. GET /api/courses/[courseId]/checkout — crea Stripe session
3. Stripe webhook → crea o reactiva CourseAccess
4. Stripe webhook intenta enviar recibo inmediatamente
5. Vercel Cron `send-receipts` reintenta cualquier recibo pendiente
6. Si el pago se reembolsa o se pierde una disputa, el webhook marca Payment(REFUNDED) y revoca CourseAccess.revokedAt
```

### Flujo de examen y certificado
```
1. Estudiante completa todos los módulos
2. Envía examen → ExamSubmission(PENDING)
3. Admin revisa en /admin/certificates/review
4. Admin aprueba → generateAndSaveCertificate()
   - Genera PDF con Puppeteer
   - Sube a R2
   - Crea Certificate(valid=true, pdfUrl)
   - Envía email con link al PDF
5. Vercel Cron `issue-certificates` actúa como red de seguridad si una aprobación quedó sin certificado válido
6. Estudiante descarga desde /learn/[courseId]
7. Verificación pública en /verify/certificate/[code]
```

### Flujo de expiración de acceso
```
1. Stripe webhook o checkout crea CourseAccess con accessUntil según Course.rentalDays
2. Las rutas de lectura validan accessUntil directamente para bloquear video al vencer
3. Vercel Cron `expire-access` revisa accesos vencidos y deja logging estructurado centralizado
```

---

## Seguridad

- **Autenticación**: NextAuth con Google OAuth + credenciales (bcrypt).
- **Autorización**: verificada en cada Server Component y API route vía `getServerSession()`.
- **Webhooks Stripe**: verificados con `stripe.webhooks.constructEvent()` y el secret del endpoint.
- **Uploads**: validación de tipo MIME y tamaño antes de subir a R2.
- **Variables sensibles**: nunca en el cliente (prefijo `NEXT_PUBLIC_` solo para las necesarias).

---

## Sistema de Notificaciones

Servicio centralizado en `src/server/services/notification-service.ts` que genera notificaciones in-app para eventos clave:

| Evento | Tipo | Destinatario |
|--------|------|-------------|
| Nuevo comentario | `COMMENT` | Usuarios inscritos en el curso |
| Like en comentario | `LIKE` | Autor del comentario |
| Curso completado | `COURSE_COMPLETION` | Estudiante |
| Inscripción a curso | `PAYMENT` | Estudiante |
| Certificado emitido | `CERTIFICATE` | Estudiante |
| Certificado revocado | `CERTIFICATE` | Estudiante |
| Examen revisado | `EXAM_REVIEW` | Estudiante |
| Estado de cita | `APPOINTMENT` | Cliente |
| Nueva entrega | `SUBMISSION` | Todos los admins |
| Bug report | `BUG_REPORT` | Todos los admins |
| Cambio de rol | `ROLE_CHANGE` | Usuario afectado |
| Nuevo registro | `NEW_USER` | Todos los admins |
| Pago recibido | `PAYMENT` | Todos los admins |

La ruta `/notifications` es accesible para todos los roles autenticados (ADMIN, STAFF, STUDENT).

---

## Variables de entorno

- `.env` — Desarrollo local (PostgreSQL local: `postgres:dark@localhost:5432/elizabeth`)
- `.env.production` — Producción (Neon, Stripe live, etc.)

Ver [`DEPLOY.md`](DEPLOY.md) para la lista completa y cómo configurarlas.
Ver [`DEMO_DATA.md`](DEMO_DATA.md) para datos demo y credenciales de desarrollo.
