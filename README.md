# Proyecto Integral: Elizabeth Rizos — Website + Reservas + Academia de Rizos + Dashboard
**Nombre del producto (working name):** Apoteósicas by Elizabeth Rizos  
**Ámbito:** Belleza / Curly Hair / Educación (Academia orientada a rizos)  
**Stack base:** Next.js (App Router) + TypeScript + Stripe + Auth (Google + credenciales)  
**Estado del documento:** Especificación funcional + técnica (versión extensa)  
**Propósito:** Dejar por escrito, con alto detalle, **qué se construye**, **cómo funciona**, **qué módulos existen**, **qué rutas/pantallas**, **qué datos**, **qué integraciones**, **qué eventos disparan emails**, y **cómo se estructura el repo** para arrancar.

---

## 0) Contexto y norte del proyecto

### 0.1 Qué se está construyendo
Se construirá una solución completa compuesta por:

1) **Website de marca (Marketing)**
- Presentación de Elizabeth y su marca.
- Presentación del trabajo (servicios, resultados, comunidad).
- Captación y conversión: CTA hacia reservas + CTA hacia cursos.
- Diseño interactivo (se definirá con referencias posteriores), pero **alineado al Manual de Marca**.

2) **Sistema de reservas (Booking + pagos)**
- Servicios como cards.
- Selección de profesional (miembros del equipo).
- Cada profesional puede tener precio diferente.
- Selección de fecha y hora con disponibilidad real.
- Pago obligatorio/condicional según reglas configurables por servicio.
- Confirmación por email y registro operativo en dashboard.

3) **Plataforma de estudio (Academia de rizos)**
- Catálogo de cursos.
- Compra (pago único) y modalidad **alquiler** (acceso por tiempo).
- Contenido dividido en etapas: módulos audiovisuales → recursos → test + evidencias.
- Interacción: likes y comentarios (solo usuarios autenticados).
- Comunidad: chat exclusivo por curso (solo compradores).
- IA: chat por curso que responde dudas basado en el contenido por módulo.
- Evaluación: formulario con selección múltiple + texto + subida de evidencias.
- Revisión manual (admin): aprobar o solicitar revisión.
- Certificado PDF + QR verificable en plataforma.

4) **Dashboard Admin**
- Operación total del sistema: servicios, staff, agenda, cursos, módulos, recursos, tests, revisiones, certificados, links de pago, configuración.

---

## 1) Identidad de marca (del manual) aplicada a UI/UX

### 1.1 Fundamento de marca (cómo se traduce a diseño)
La marca se apoya en conceptos como:
- **Autenticidad**: cada rizo es único.
- **Empoderamiento femenino**: transformación, confianza y autoestima.
- **Comunidad**: acompañamiento, tribu, cercanía.
- **Transformación**: cambios visibles y emocionales.

**Implicación UI:**
- La plataforma debe sentirse **premium + orgánica + cálida**, no “dashboard frío”.
- Texturas suaves, curvas, transiciones elegantes, elementos visuales relacionados a “movimiento” (rizo/onda).
- El sitio debe ser **más llamativo**: mayor contraste controlado, sección hero con impacto, módulos animados, micro-interacciones.

### 1.2 Logos y uso
- Logotipo: “APOTEÓSICAS by Elizabeth Rizos”
- Isotipo: monograma “ER”
- Tamaños mínimos digitales:
  - Isotipo: mínimo ~100px
  - Logotipo: mínimo ~250px

**Reglas UI:**
- Navbar desktop: logotipo completo si cabe.
- Mobile, favicon y app icon: isotipo ER.
- Nunca deformar, rotar, agregar sombras agresivas ni alterar proporción.

### 1.3 Paleta de colores (tokens)
- **Cobre Apoteósico:** #B16E34
- **Beige Suave:** #F0D7B8
- **Verde Oliva Natural:** #646A40

**Traducción UX:**
- Fondo base: Beige suave (limpieza/premium).
- CTA principal: Cobre (compra, reservar, continuar).
- Accentos, chips, estados y detalles: Verde oliva.
- Tip: elevar “llamativo” usando:
  - degradados sutiles cobre→beige,
  - secciones con fondos alternados,
  - contraste tipográfico fuerte,
  - imágenes “hero” con framing editorial.

### 1.4 Tipografía
- Tipografía de marca (display): Mighty Bagher Demo Regular (para headings/branding).
- Tipografía UI: una sans legible (Inter/Geist/Plus Jakarta) para dashboards y lectura.

---

## 2) Objetivos de negocio

### 2.1 Website
- Aumentar conversiones a reserva.
- Posicionar autoridad y estilo propio.
- Mostrar profesionalismo y resultados.
- Redirigir a la academia para monetización escalable.

### 2.2 Reservas (anti no-show)
- Reducir ausencias con reglas de cobro y autorizaciones.
- Permitir precios diferenciados por miembro del equipo.
- Agilizar el proceso del cliente (wizard simple y moderno).
- Tener trazabilidad: estados de cita y pagos claros para operación diaria.

### 2.3 Academia de rizos
- Monetizar conocimientos (cursos).
- Crear comunidad.
- Proveer acompañamiento con IA (soporte inmediato).
- Validar aprendizaje con test y evidencias.
- Entregar certificados verificables (credibilidad / marketing).

---

## 3) Reglas de negocio — Reservas

### 3.1 Flujo del cliente (wizard de reserva)
1) **Seleccionar servicio** (cards)
2) **Seleccionar profesional** (cards de staff)
3) **Seleccionar fecha/hora** (disponibilidad real)
4) **Datos del cliente** (nombre, email, teléfono, notas)
5) **Pago** (según regla configurada)
6) **Confirmación** (pantalla + email + dashboard)

### 3.2 Precios por profesional
- Cada servicio puede tener precio distinto según el miembro del staff.
- Estructura típica:
  - Service base
  - Staff
  - Price override (ServiceStaffPrice)
- En UI:
  - al seleccionar profesional, se actualiza precio.

### 3.3 Reglas de cobro por servicio (3 opciones)
**A) FULL — Cobro completo online**
- Reservar requiere pagar 100%.
- Estado cita: confirmada / pagada.

**B) DEPOSIT — Cobro parcial (50% o configurable)**
- Se cobra seña online.
- Resto presencial.
- Estado cita: confirmada / parcial.

**C) AUTHORIZE — Cobro sin cobrar al momento (autorizable)**
- Cliente registra método de pago.
- Admin decide si captura el cobro o no (por política anti no-show).
- Estado cita: pendiente/autorizar.
- Nota: hay límites operativos de autorizaciones según método/país.

### 3.4 Estados operativos
**Appointment.status**
- PENDING (creada pero no confirmada)
- CONFIRMED (confirmada)
- CANCELLED
- NO_SHOW (opcional)
- COMPLETED (opcional)

**Payment.status**
- REQUIRES_PAYMENT
- PROCESSING
- PAID
- PARTIAL
- AUTHORIZED (si aplica)
- FAILED
- REFUNDED

### 3.5 Notificaciones
- Email confirmación reserva
- Email comprobante de pago (obligatorio cuando hay pago)
- Recordatorio (opcional): 24h antes
- Notificación de reprogramación/cancelación (opcional)

---

## 4) Reglas de negocio — Pagos (Stripe)

### 4.1 Casos de pago
- Pago de cita (FULL)
- Pago de cita (DEPOSIT)
- Registro/autorización de método (AUTHORIZE)
- Compra de curso
- Payment link creado por admin

### 4.2 Webhooks como fuente de verdad
El backend debe confirmar pagos mediante webhook:
- checkout.session.completed
- payment_intent.succeeded
- payment_intent.payment_failed
- charge.refunded (si se maneja)
- etc.

### 4.3 Recibo / comprobante por correo (requisito obligatorio)
Cada vez que ocurra un evento de pago:
- Se envía correo al cliente con comprobante:
  - concepto (cita/curso/link)
  - monto
  - moneda
  - fecha
  - ID/Referencia
  - estado
- En caso DEPOSIT:
  - recibo de la seña
  - si se cobra restante online: recibo del restante
- En caso AUTHORIZE:
  - notificación de método registrado (si aplica)
  - recibo real solo cuando se capture el pago

### 4.4 “Precio + Fee Stripe” en dashboard (estimación)
Requisito:
- cuando admin crea precio (curso o link):
  - introduce “quiero cobrar X”
  - el sistema calcula “precio final = X + fee”
- fee default estimado: percent + fijo (configurable)
- Esto se guarda como configuración:
  - feePercent
  - feeFixed
- Se debe mostrar un aviso de “estimado”.

---

## 5) Academia de rizos — Estructura del curso

### 5.1 Curso: landing
Cada curso tiene:
- Trailer (video)
- Título
- Descripción
- Precio
- CTA: Comprar / Acceder
- Likes
- Comentarios (solo usuarios autenticados)

### 5.2 Acceso por alquiler
- La compra crea un `CourseAccess` con `accessUntil`.
- Expirado el tiempo:
  - se bloquea el acceso al audiovisual (y opcionalmente a todo el curso según decisión).

### 5.3 Etapas internas
**Etapa 1 — Módulos (audiovisual)**
- Un curso es un conjunto de módulos.
- Módulo:
  - título
  - descripción
  - videoUrl
  - transcript (para IA)
  - likes
  - comentarios
- Progreso:
  - al completar un módulo se marca en perfil de estudiante.
  - porcentaje del curso.

**Etapa 2 — Recursos**
- PDFs, imágenes JPG/PNG
- descargables por estudiantes con acceso

**Etapa 3 — Test + Evidencias**
- Habilitado solo si:
  - todos los módulos completados
- Test:
  - selección múltiple
  - respuesta escrita
- Evidencias:
  - imágenes y videos
- Envío:
  - genera un Submission para admin review

### 5.4 Revisión por admin
En dashboard, admin:
- ve submissions pendientes
- revisa respuestas y evidencias
- puede:
  - aprobar
  - solicitar revisión (feedback al estudiante)

### 5.5 Certificado PDF + QR
Cuando admin aprueba:
- muestra modal confirmación (evitar clicks accidentales)
- genera certificado PDF
- incluye QR de validación
- envía email al estudiante:
  - certificado adjunto o link
- URL verificación:
  - `/verify/certificate/[code]`
- verificación:
  - confirma si es válido
  - muestra datos mínimos (según decisión)

---

## 6) Comunidad y engagement

### 6.1 Likes y comentarios
- Target:
  - Course
  - Module
- Reglas:
  - solo usuarios autenticados
  - rate limit básico (opcional)
  - moderación admin (opcional)

### 6.2 Chat exclusivo por curso
- Acceso:
  - solo compradores del curso
- Canales:
  - 1 room por curso
- Features mínimos (MVP):
  - lista de mensajes
  - enviar mensaje
  - indicadores básicos
- Moderación:
  - admin puede borrar/banear (opcional)

### 6.3 Chat con IA por curso
- IA se alimenta del contenido:
  - transcripciones por módulo
  - descripción del curso
  - recursos (si se parsean)
- Respuesta contextual:
  - “basado en el módulo X, etapa Y…”
- Restricciones:
  - solo compradores del curso
- Seguridad:
  - evitar filtrado de contenido privado a no compradores

---

## 7) Dashboard Admin — Funcionalidades

### 7.1 Servicios
- Crear/editar servicio:
  - nombre, descripción
  - duración
  - regla de cobro (FULL/DEPOSIT/AUTHORIZE)
  - asignación staff habilitado
- Gestionar precios por staff

### 7.2 Staff
- Crear/editar miembro:
  - nombre, rol, bio
  - foto
  - precios por servicio
  - horarios/disponibilidad

### 7.3 Agenda / citas
- Listado de citas
- Filtros:
  - fecha, staff, estado, tipo pago
- Detalle:
  - cliente + notas
  - servicio
  - estado de pago
- Acciones:
  - cancelar/reprogramar (según se implemente)

### 7.4 Cursos
- CRUD cursos:
  - título, desc, trailer, precio, duración alquiler
- CRUD módulos:
  - orden, título, video, transcript
- Recursos:
  - subir PDF/imagenes
- Config test:
  - preguntas y reglas

### 7.5 Revisiones (tests)
- Bandeja:
  - PENDING
  - REVISION_REQUESTED
  - APPROVED
- Ver submission:
  - respuestas
  - evidencias
- Acciones:
  - aprobar (genera certificado)
  - solicitar revisión

### 7.6 Certificados
- listado certificados emitidos
- ver estado válido/no válido
- reemitir / revocar (opcional)
- verificación QR

### 7.7 Links de pago
- Form:
  - monto deseado
  - sistema calcula fee estimado
  - genera link
- Historial links

### 7.8 Settings
- Fee percent + fixed
- textos/políticas (si se decide)
- configuración emails (si se decide)
- configuración expiración cursos (si se decide)

---

## 8) Estructura de rutas (Next.js App Router)

### 8.1 Marketing routes
- `/` Home
- `/about` Sobre
- `/services` Servicios
- `/team` Equipo
- `/booking` Wizard reservas
- `/booking/success` Confirmación reserva
- `/contact` Contacto

### 8.2 Academy routes
- `/courses` Catálogo
- `/courses/[courseId]` Landing del curso
- `/learn/[courseId]` Área del curso (módulos)
- `/learn/[courseId]/modules/[moduleId]` Player + detalle módulo
- `/learn/[courseId]/resources` Recursos
- `/learn/[courseId]/test` Test
- `/learn/[courseId]/certificate` Certificado (si aplica)
- `/chat/[courseId]` Chat exclusivo

### 8.3 Dashboard routes
- `/admin` Overview
- `/admin/services`
- `/admin/staff`
- `/admin/appointments`
- `/admin/courses`
- `/admin/reviews`
- `/admin/certificates`
- `/admin/payment-links`
- `/admin/settings`

### 8.4 Public verify
- `/verify/certificate/[code]`

### 8.5 API routes
- `/api/auth/[...nextauth]`
- `/api/stripe/checkout`
- `/api/stripe/webhook`
- `/api/uploads`
- `/api/ai`
- `/api/chat`

---

## 9) Estructura del repositorio (para arrancar)

```txt
src/
  app/
    (marketing)/
    (academy)/
    (dashboard)/
    api/
  components/
    ui/
    marketing/
    booking/
    academy/
    dashboard/
    common/
  features/
    auth/
    billing/
    bookings/
    courses/
    progress/
    resources/
    tests/
    certificates/
    comments/
    chat/
    ai/
  server/
    actions/
    services/
    jobs/
  lib/
    db.ts
    env.ts
    auth.ts
    stripe.ts
    mail.ts
    storage.ts
    pdf.ts
    qr.ts
  validators/
  types/
  config/
prisma/
  schema.prisma
```

# Especificación técnica hardcore — Elizabeth Rizos (Website + Reservas + Academia de Rizos + Dashboard)
**Versión:** 1.0 (extensa)  
**Stack:** Next.js (App Router) + TypeScript + PostgreSQL + Prisma + Stripe + Auth (Google + Credenciales)  
**Arquitectura:** Monorepo Next (fullstack) con API Routes / Server Actions + Webhooks Stripe + Storage S3/R2  
**Requisito crítico:** Por cada pago (cita, curso, link) el cliente recibe **comprobante/recibo por email**.

---

## 0) Principios del sistema

### 0.1 Fuente de verdad de pagos
- **Stripe Webhook** es la fuente de verdad.
- La app puede “iniciar” el pago (crear session/intents), pero confirma la operación cuando Stripe notifica por webhook.

### 0.2 Diseño orientado a eventos
Eventos típicos:
- `PAYMENT_SUCCEEDED`
- `PAYMENT_FAILED`
- `ACCESS_GRANTED`
- `APPOINTMENT_CONFIRMED`
- `SUBMISSION_RECEIVED`
- `SUBMISSION_APPROVED`
- `CERTIFICATE_ISSUED`

Cada evento puede disparar:
- actualización de DB
- email transaccional
- logs/auditoría

### 0.3 Seguridad y permisos
- `ADMIN`: dashboard completo
- `STAFF`: agenda propia (si habilitado)
- `STUDENT`: cursos y reservas

**Regla oro:** toda ruta sensible y toda API valida permisos desde servidor.

---

## 1) Modelo de datos (Prisma detallado)

> Nota: este schema es “completo”, podés recortar para MVP y luego expandir.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  ADMIN
  STAFF
  STUDENT
}

enum BillingRule {
  FULL        // 100% online
  DEPOSIT     // seña parcial
  AUTHORIZE   // guardar método y capturar luego (si aplica)
}

enum AppointmentStatus {
  PENDING
  CONFIRMED
  CANCELLED
  NO_SHOW
  COMPLETED
}

enum PaymentStatus {
  REQUIRES_PAYMENT
  PROCESSING
  PAID
  PARTIAL
  AUTHORIZED
  FAILED
  REFUNDED
  CANCELED
}

enum PaymentType {
  APPOINTMENT
  COURSE
  PAYMENT_LINK
}

enum ResourceType {
  PDF
  IMAGE
}

enum LikeTargetType {
  COURSE
  MODULE
}

enum CommentTargetType {
  COURSE
  MODULE
}

enum SubmissionStatus {
  PENDING
  REVISION_REQUESTED
  APPROVED
}

model User {
  id        String   @id @default(cuid())
  name      String?
  email     String   @unique
  image     String?
  role      Role     @default(STUDENT)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  staffProfile StaffProfile?
  appointments Appointment[] @relation("CustomerAppointments")
  taughtAppointments Appointment[] @relation("StaffAppointments")
  courseAccess CourseAccess[]
  comments Comment[]
  likes Like[]
  chatMessages ChatMessage[]
  submissions Submission[]
  certificates Certificate[]
}

model StaffProfile {
  id        String   @id @default(cuid())
  userId    String   @unique
  bio       String?
  photoUrl  String?
  isActive  Boolean  @default(true)

  user User @relation(fields: [userId], references: [id])

  // availability stored as rules/json for now
  availabilityJson Json?
}

model Service {
  id           String      @id @default(cuid())
  name         String
  description  String?
  durationMin  Int         // used to compute slots
  billingRule  BillingRule @default(FULL)
  depositPct   Int?        // e.g. 50 (only if DEPOSIT)
  isActive     Boolean     @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  prices ServiceStaffPrice[]
  appointments Appointment[]
}

model ServiceStaffPrice {
  id        String   @id @default(cuid())
  serviceId String
  staffId   String
  currency  String   @default("USD")
  priceCents Int

  service Service @relation(fields: [serviceId], references: [id])
  staff   User    @relation(fields: [staffId], references: [id])

  @@unique([serviceId, staffId])
  @@index([staffId])
  @@index([serviceId])
}

model Appointment {
  id          String            @id @default(cuid())
  serviceId   String
  staffId     String
  customerId  String
  startAt     DateTime
  endAt       DateTime
  notes       String?
  status      AppointmentStatus @default(PENDING)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  service   Service @relation(fields: [serviceId], references: [id])
  staff     User    @relation("StaffAppointments", fields: [staffId], references: [id])
  customer  User    @relation("CustomerAppointments", fields: [customerId], references: [id])

  payments Payment[] // appointment can have 1..n payments (deposit + remainder)
  @@index([staffId, startAt])
  @@index([customerId, startAt])
}

model Payment {
  id        String        @id @default(cuid())
  type      PaymentType
  status    PaymentStatus @default(REQUIRES_PAYMENT)

  amountCents Int
  currency   String @default("USD")

  // Stripe references (one of these or both depending on flow)
  stripeCheckoutSessionId String?
  stripePaymentIntentId   String?
  stripeChargeId          String?

  // Link to appointment/course/paymentLink internal
  appointmentId String?
  courseId      String?
  paymentLinkId String?

  // Who paid
  payerId String?
  payerEmail String?

  // for receipts
  receiptEmailSentAt DateTime?
  receiptToEmail String? // where we sent the receipt

  metadata Json?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  appointment Appointment? @relation(fields: [appointmentId], references: [id])
  course      Course?      @relation(fields: [courseId], references: [id])
  payer       User?        @relation(fields: [payerId], references: [id])

  @@index([type, status])
  @@index([stripePaymentIntentId])
  @@index([stripeCheckoutSessionId])
}

model Course {
  id          String   @id @default(cuid())
  title       String
  description String?
  trailerUrl  String?
  priceCents  Int
  currency    String @default("USD")
  rentalDays  Int?    // if null => lifetime (or treat as purchase with no expiry)
  isActive    Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  modules Module[]
  resources Resource[]
  access CourseAccess[]
  test Test?
  payments Payment[]

  likes Like[]
  comments Comment[]
  chatRoom ChatRoom?
}

model Module {
  id          String   @id @default(cuid())
  courseId    String
  order       Int
  title       String
  description String?
  videoUrl    String?
  transcript  String?  // for RAG/AI

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course Course @relation(fields: [courseId], references: [id])
  progress ModuleProgress[]

  likes Like[]
  comments Comment[]

  @@unique([courseId, order])
  @@index([courseId])
}

model ModuleProgress {
  id        String   @id @default(cuid())
  userId    String
  moduleId  String
  completed Boolean  @default(false)
  completedAt DateTime?

  user   User   @relation(fields: [userId], references: [id])
  module Module @relation(fields: [moduleId], references: [id])

  @@unique([userId, moduleId])
  @@index([moduleId])
}

model CourseAccess {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  accessUntil DateTime?
  createdAt DateTime @default(now())

  user   User   @relation(fields: [userId], references: [id])
  course Course @relation(fields: [courseId], references: [id])

  @@unique([userId, courseId])
  @@index([courseId])
}

model Resource {
  id        String       @id @default(cuid())
  courseId  String
  type      ResourceType
  fileUrl   String
  fileName  String?
  createdAt DateTime @default(now())

  course Course @relation(fields: [courseId], references: [id])
  @@index([courseId])
}

model Like {
  id        String         @id @default(cuid())
  userId    String
  targetType LikeTargetType
  courseId  String?
  moduleId  String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  course Course? @relation(fields: [courseId], references: [id])
  module Module? @relation(fields: [moduleId], references: [id])

  @@index([targetType])
  @@unique([userId, targetType, courseId, moduleId])
}

model Comment {
  id        String            @id @default(cuid())
  userId    String
  targetType CommentTargetType
  courseId  String?
  moduleId  String?
  body      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  course Course? @relation(fields: [courseId], references: [id])
  module Module? @relation(fields: [moduleId], references: [id])

  @@index([targetType])
  @@index([courseId])
  @@index([moduleId])
}

model Test {
  id        String @id @default(cuid())
  courseId  String @unique
  schemaJson Json   // builder output
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  course Course @relation(fields: [courseId], references: [id])
  submissions Submission[]
}

model Submission {
  id          String           @id @default(cuid())
  testId      String
  userId      String
  answersJson Json
  evidenceJson Json?          // list of files, urls, types
  status      SubmissionStatus @default(PENDING)
  feedback    String?
  reviewedAt  DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  test Test @relation(fields: [testId], references: [id])
  user User @relation(fields: [userId], references: [id])

  certificate Certificate?

  @@index([status])
  @@unique([testId, userId])
}

model Certificate {
  id        String @id @default(cuid())
  code      String @unique
  courseId  String
  userId    String
  submissionId String? @unique
  issuedAt  DateTime @default(now())
  pdfUrl    String?
  valid     Boolean @default(true)

  course Course @relation(fields: [courseId], references: [id])
  user   User   @relation(fields: [userId], references: [id])
  submission Submission? @relation(fields: [submissionId], references: [id])

  @@index([courseId])
  @@index([userId])
}

model ChatRoom {
  id       String @id @default(cuid())
  courseId String @unique
  createdAt DateTime @default(now())

  course Course @relation(fields: [courseId], references: [id])
  messages ChatMessage[]
}

model ChatMessage {
  id       String @id @default(cuid())
  roomId   String
  userId   String
  body     String
  createdAt DateTime @default(now())

  room ChatRoom @relation(fields: [roomId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
}

model Settings {
  id String @id @default("global")
  feePercent Float @default(2.5) // estimate
  feeFixedCents Int @default(25) // estimate
  defaultCurrency String @default("USD")
  updatedAt DateTime @updatedAt
}
