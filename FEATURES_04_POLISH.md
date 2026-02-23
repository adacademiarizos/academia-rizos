# FASE 4: Polish, Analytics & Advanced Features

**Prioridad**: 🟢 OPCIONAL (Post-Launch)
**Estimación**: ~2-3 semanas
**Dependencias**: Completar FASE 1-3

---

## 1️⃣ Descripción General

Mejora de experiencia general, analytics, y features avanzadas (no críticas para MVP).

**Áreas:**
- Dashboards de usuario (perfil, mis cursos, mis reservas)
- Analytics para admin (conversiones, revenue, engagement)
- Mejora en disponibilidad de staff (calendario visual)
- Notifications y reminders
- Refinements UI/UX
- Tests automatizados

---

## 2️⃣ Historias de Usuario

### HU-ADV1: Estudiante Ve su Perfil y Progreso

```
COMO ESTUDIANTE AUTENTICADO
QUIERO: Ver mi perfil y mis cursos
PARA QUE: Administre mi aprendizaje y datos personales

CRITERIOS DE ACEPTACIÓN:
✓ Página /profile accesible desde menu o botón perfil
✓ Secciones:
  1) Mi información
     - Nombre, email, foto (editable)
     - Botón "Editar perfil"
     - Botón "Cambiar contraseña" (si login por creds)
  2) Mis cursos
     - Lista de cursos comprados/alquilados
     - Para cada curso:
       § Thumbnail
       § Título
       § Progreso (% completado)
       § Fecha de compra / acceso expire
       § Botón "Continuar aprendiendo"
     - Filtros: activos, completados, expirados
  3) Mis certificados
     - List de certificados emitidos
     - Botón descargar PDF
     - Link compartible
  4) Mis reservas
     - Próximas citas
     - Citas pasadas (historial)
     - Para cada:
       § Fecha/hora, servicio, profesional
       § Estado (confirmada, completada, cancelada)
       § Botón "Reprogramar" (si aplica)
✓ Responsive
✓ Fácil navegación

DISEÑO:
- Layout sidebar (desktop) o tabs (mobile)
- Cards para cada sección
- Status badges visibles
```

---

### HU-ADV2: Admin Ve Dashboard de Analytics

```
COMO ADMIN EN DASHBOARD
QUIERO: Ver métricas de negocio y performance
PARA QUE: Entienda salud del negocio

CRITERIOS DE ACEPTACIÓN:
✓ Página /admin/analytics con:
  1) Revenue
     - Total revenue (mes, trimestre, año)
     - Desglose: reservas vs cursos vs payment links
     - Gráfico línea histórico
     - Top cursos por revenue
  2) Conversión
     - Visitantes web → Compras (funnel)
     - Tasa conversión reservas
     - Tasa conversión academia
     - Cart abandonment (si aplica)
  3) Customers
     - Total clientes únicos
     - Clientes nuevos (mes)
     - Repeat customers
     - Churn rate (cursos alquiler)
     - Lifetime value
  4) Product
     - Top 5 servicios
     - Top 5 cursos
     - Módulos más vistos
     - Engagement (likes, comments, chat)
     - Test completion rate
  5) Staff Performance
     - Citas por profesional (mes)
     - Rating/reviews (si implementa)
     - Availability utilization
  6) Learnings
     - Estudiantes activos
     - Progress stats
     - Certificate issuance
     - Submission completion
✓ Filtros temporales: week, month, quarter, year
✓ Exportar a CSV (opcional)
✓ Dashboard overview (/admin) muestra KPIs principales

GRÁFICOS:
- Línea: Revenue over time
- Barras: Revenue por categoría
- Pastel: Desglose cursos vs reservas
- KPI cards: números grandes + cambio %
```

---

### HU-ADV3: Admin Ve Calendario de Disponibilidad

```
COMO ADMIN
QUIERO: Ver disponibilidad de staff en calendario visual
PARA QUE: Pueda gestionar schedules fácilmente

CRITERIOS DE ACEPTACIÓN:
✓ Página /admin/staff/[staffId]/schedule
✓ Calendario:
  - Vista mensual (default) o semanal
  - Grid: horarios (eje Y) vs días (eje X)
  - Celdas coloreadas:
    - Verde: disponible
    - Rojo: no disponible
    - Azul: booked
    - Gris: fuera de horario
✓ Interacción:
  - Click celda → abre modal para marcar disponible/no disponible
  - Drag-select para marcar rangos de disponibilidad
  - Bulk actions: "Marcar semana como disponible"
✓ Recurring rules (opcional):
  - "Cada lunes-viernes 9am-6pm disponible"
  - "Sabados no disponible"
- Data se guarda en StaffProfile.availabilityJson

ALTERNATIVA MVP:
- Simple form con input ranges:
  "Disponibilidad: Lunes-Viernes, 9am-6pm"
  "Days off: [lista fechas]"
```

---

### HU-ADV4: Email Reminders de Citas

```
COMO ADMIN O SISTEMA
QUIERO: Enviar email 24h antes de la cita al cliente
PARA QUE: Reduzca no-shows

CRITERIOS DE ACEPTACIÓN:
✓ Sistema automático (cron job o similar):
  - Cada día, 9am: buscar citas en 24h
  - Para cada cita:
    § Enviar email al cliente
    § Asunto: "Recordatorio: Tu cita mañana"
    § Body:
      - Servicio, fecha/hora, profesional
      - Ubicación (si aplica)
      - Link para "Confirmar asistencia" (optional)
      - Link para "Cambiar/Cancelar"
✓ Email se envía solo si:
  - Cita está CONFIRMED
  - No es NON_SHOW o CANCELLED
  - appointment.reminderSentAt es null
✓ Se marca: appointment.reminderSentAt = now()

IMPLEMENTACIÓN:
- Server action o API route
- Llamado por CRON (Vercel Crons, easy)
- Manejo de errores (retry logic)

ARCHIVO:
- src/server/jobs/send-appointment-reminders.ts
```

---

### HU-ADV5: SMS Notification (Bonus)

```
COMO CLIENTE
QUIERO: Recibir SMS de confirmación y recordatorio
PARA QUE: No se olvide de la cita

CRITERIOS DE ACEPTACIÓN:
✓ SMS enviado al confirmar cita:
  "Hola [name]! Confirmamos tu cita el [date] a las [time]
  con [staff] para [service]. Ubicación: [address]"
✓ SMS enviado 24h antes:
  "Recordatorio: Tu cita mañana [date] a [time] con [staff].
  Confirma aquí: [link]"
✓ SMS enviado si cancela:
  "Tu cita ha sido cancelada."

IMPLEMENTACIÓN:
- Twilio API (SMS provider)
- .env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE
- function sendSMS(phone, message)

NOTA: Costo extra, puede saltarse para MVP
```

---

### HU-ADV6: Staff Dashboard (Portal Staff)

```
COMO MIEMBRO DEL STAFF
QUIERO: Ver mis citas próximas y mi performance
PARA QUE: Pueda auto-gestionar mi agenda

CRITERIOS DE ACEPTACIÓN:
✓ Login staff (mismo auth, role = STAFF)
✓ Dashboard /dashboard/staff:
  - Hoy:
    § Citas de hoy (horarios, clientes)
    § Botones marcar "Completed" si aplica
  - Semana:
    § Calendario semanal
    § Todas las citas visibles
    § Click en cita → detalles
  - Historial:
    § Citas pasadas
    § Stats: total citas mes, ingresos generados (opcional)
  - Disponibilidad:
    § Editar mi horario (ver HU-ADV3)

PERMISOS:
- Staff solo ve sus propias citas
- Admin ve todas
```

---

### HU-ADV7: Tests y Coverage

```
COMO DESARROLLADOR / QA
QUIERO: Tests automatizados para componentes críticos
PARA QUE: Reduzca bugs y facilite refactoring

CRITERIOS DE ACEPTACIÓN:
✓ Tests unitarios:
  - Funciones de library (fees.ts, validation, etc)
  - Componentes simples (Button, Card, etc)
  - Coverage > 70%
✓ Tests integración:
  - APIs críticas (booking, payments, courses)
  - Flujos de usuario (compra curso, reservar cita)
✓ Tests E2E (opcional):
  - Flujo compra completo
  - Login y acceso a curso
  - Admin CRUD de servicios

SETUP:
- Jest + Testing Library (ya compatible con Next.js)
- Vitest alternativa (más rápido)
- Playwright para E2E

COMMANDS:
- npm test (jest)
- npm run test:e2e (cypress/playwright)

ARCHIVOS:
- __tests__/ carpeta en src/
- *.test.ts files
- cypress/ para E2E
```

---

### HU-ADV8: Environmental Monitoring & Logging

```
COMO DEVOPS / DEVELOPER
QUIERO: Monitoreo de errores y performance
PARA QUE: Detecte problemas rápido

CRITERIOS DE ACEPTACIÓN:
✓ Error tracking:
  - Sentry.io (popular)
  - Logged errors con stack trace
  - Notificaciones en Slack (opcional)
✓ Performance monitoring:
  - Core Web Vitals tracked
  - Database query times
  - API response times
✓ Logs centralizados:
  - Local logs during dev
  - Cloud logs (Google Cloud, Datadog, etc) en prod

SETUP:
- Sentry.io account + SDK
- @sentry/nextjs package
- Privacy: exclude sensitive data (passwords, etc)
```

---

### HU-ADV9: Admin Generador de Reportes

```
COMO ADMIN
QUIERO: Generar reportes en PDF
PARA QUE: Pueda compartir info con team o stakeholders

CRITERIOS DE ACEPTACIÓN:
✓ Página /admin/reports
✓ Tipos de reportes:
  1) Revenue Report
     - Date range
     - Breakdown by service/course
     - PDF descargable
  2) Student Progress Report
     - Curso
     - Estudiantes y su progreso (%)
     - Completed/pending tests
  3) Staff Performance Report
     - Citas por staff
     - Revenue generado
     - Ratings (si existe)
  4) Course Analytics Report
     - Enrolment
     - Completion rate
     - Feedback
✓ Botón "Generate PDF"
✓ Email report (opcional)

IMPLEMENTACIÓN:
- Puppeteer (ya instalado)
- HTML template → PDF
- Scheduled reports (optional)
```

---

### HU-ADV10: Admin Bulk Actions

```
COMO ADMIN
QUIERO: Realizar bulk actions en recursos
PARA QUE: Ahorre tiempo en tareas repetitivas

CRITERIOS DE ACEPTACIÓN:
✓ En tablas (servicios, staff, citas, etc):
  - Checkboxes select
  - Botones bulk actions:
    § Cambiar estado (para citas)
    § Eliminar
    § Exportar (CSV)
✓ Confirmación antes de ejecutar
✓ Success message con count

IMPLEMENTACIÓN:
- Tabla con selección
- Botón submit que envia array de IDs
- API endpoint que procesa bulk
```

---

## 3️⃣ Requerimientos Técnicos

### Nuevas Rutas

```
GET /profile                     User profile + progress
GET /admin/analytics             Analytics dashboard
GET /admin/staff/[staffId]/schedule   Staff calendar
GET /dashboard/staff             Staff portal home
POST /api/appointments/reminders  Cron job para reminders
POST /api/sms                    Twilio SMS (optional)
GET /admin/reports               Report generator
```

### Librerías Adicionales

```bash
# Analytics/Charts
npm install recharts  # React charts library

# Email/Reminders
npm install node-cron  # Scheduled tasks (o Vercel Crons)

# SMS (optional)
npm install twilio

# Error Tracking
npm install @sentry/nextjs

# Testing
npm install --save-dev jest @testing-library/react
npm install --save-dev vitest
npm install --save-dev @testing-library/jest-dom

# PDF Generation (already have puppeteer context)
npm install jspdf html2canvas  # Alternative to puppeteer

# Logging
npm install winston  # Structured logging
```

---

### Base de Datos (New Fields)

```prisma
model Appointment {
  // Existing...
  reminderSentAt  DateTime?     // Track reminder sent
  notes           String?       // Notas cliente/staff
}

model User {
  // Existing...
  phoneNumber     String?       // Para SMS
  preferences     Json?         // Reminders, etc
}

model StaffProfile {
  // Existing...
  availabilityJson Json?        // Schedule rules
  rating          Float?        // Average rating (if reviews)
}

model Submission {
  // Existing...
  feedback        String?       // Admin feedback
}
```

---

## 4️⃣ Checklist de Implementación

### ETAPA 1: User Profile & My Courses (Semana 1)

- [ ] Página `/profile` (student dashboard)
  - [ ] Componentes:
    - [ ] ProfileHeader (foto, nombre, edit button)
    - [ ] MyCoursesSection (list with progress)
    - [ ] MyCertificatesSection
    - [ ] MyAppointmentsSection
  - [ ] Edit modal
  - [ ] Responsive
- [ ] API endpoints:
  - [ ] GET /api/user/profile
  - [ ] PUT /api/user/profile
  - [ ] GET /api/user/courses
  - [ ] GET /api/user/appointments

**Archivos:**
```
src/app/(marketing)/profile/page.tsx
src/components/profile/*
```

---

### ETAPA 2: Admin Analytics Dashboard (Semana 1-2)

- [ ] Página `/admin/analytics`
  - [ ] Componentes:
    - [ ] RevenueCard (total, month)
    - [ ] RevenueChart (línea)
    - [ ] TopCoursesCard
    - [ ] StudentStatsCard
    - [ ] ConversionMetrics
  - [ ] Recharts integration
  - [ ] Filtros time range
- [ ] Queries:
  - [ ] Revenue by date range
  - [ ] Top courses by sales
  - [ ] Student count trends
  - [ ] Completion rates

**Archivos:**
```
src/app/(dashboard)/admin/analytics/page.tsx
src/components/dashboard/analytics/*
src/server/services/analytics-service.ts
```

---

### ETAPA 3: Staff Schedule/Calendar (Semana 1.5)

- [ ] Formulario simple o calendario visual
  - [ ] MVP: form recurring hours + days off list
  - [ ] Advanced: calendar UI (react-calendar, react-big-calendar)
- [ ] Página `/admin/staff/[staffId]/schedule`
- [ ] Update StaffProfile.availabilityJson
- [ ] Validation contra bookings existentes

**Archivos:**
```
src/app/(dashboard)/admin/staff/[staffId]/schedule/page.tsx
src/components/dashboard/StaffScheduleForm.tsx
```

---

### ETAPA 4: Email Reminders (Semana 2)

- [ ] Crear server action/API
  - [ ] Query appointments donde startAt = tomorrow
  - [ ] Enviar emails con Resend
  - [ ] Update reminderSentAt
- [ ] Setup Vercel Crons o node-cron
  - [ ] Schedule para 9am daily
  - [ ] Error handling + retry
- [ ] Email template

**Archivos:**
```
src/server/jobs/send-appointment-reminders.ts
src/server/email/appointment-reminder.tsx
vercel.json (crons config)
```

---

### ETAPA 5: Staff Portal (Semana 2)

- [ ] Página `/dashboard/staff` (layout staff)
  - [ ] Citas de hoy
  - [ ] Calendario semanal
  - [ ] Historial y stats
  - [ ] Edit disponibilidad
- [ ] Componentes:
  - [ ] TodayAppointments
  - [ ] WeeklyCalendar
  - [ ] Stats
- [ ] Permisos: si role=STAFF, solo ve sus datos

**Archivos:**
```
src/app/(dashboard)/staff/page.tsx
src/components/dashboard/StaffDashboard.tsx
```

---

### ETAPA 6: Testing Setup (Semana 2-3)

- [ ] Jest + Testing Library config
  - [ ] jest.config.js
  - [ ] setup file
- [ ] Tests unitarios:
  - [ ] 5-10 tests de componentes
  - [ ] 5-10 tests de funciones
- [ ] Tests integración:
  - [ ] Flujo booking
  - [ ] Flujo course purchase
- [ ] Run coverage check

**Archivos:**
```
jest.config.js
src/**/*.test.ts(x)
src/__tests__/
```

---

### ETAPA 7: SMS Notifications (Week 2 Optional)

- [ ] Twilio setup
  - [ ] Account + API key
  - [ ] Phone number
- [ ] Send SMS en:
  - [ ] Booking confirmation
  - [ ] Appointment reminder
  - [ ] Course purchase confirmation
- [ ] Logs de SMS sent

**Archivos:**
```
src/lib/sms.ts
src/server/services/sms-service.ts
```

---

### ETAPA 8: Sentry Monitoring (Week 3)

- [ ] Sentry account setup
  - [ ] DSN key
- [ ] @sentry/nextjs installation
  - [ ] Instrumentación
  - [ ] Error boundaries
- [ ] Slack integration (optional)
- [ ] Privacy: exclude sensitive data

**Archivos:**
```
sentry.client.config.ts
sentry.server.config.ts
next.config.js (sentry wrapper)
```

---

### ETAPA 9: Reports Generator (Week 3)

- [ ] Página `/admin/reports`
  - [ ] Form: select report type + date range
  - [ ] "Generate PDF" button
  - [ ] PDF preview o download
- [ ] Templates:
  - [ ] Revenue report
  - [ ] Student progress
  - [ ] Staff performance
- [ ] Usar Puppeteer o jsPDF

**Archivos:**
```
src/app/(dashboard)/admin/reports/page.tsx
src/server/services/report-service.ts
src/server/email/report-template.tsx
```

---

### ETAPA 10: Polish & Optimization (Week 3)

- [ ] Performance audit
  - [ ] Lighthouse score > 90
  - [ ] Bundle analyze
  - [ ] Slow queries optimize
- [ ] Responsive final pass
  - [ ] Mobile, tablet, desktop
  - [ ] Animations smoothes
- [ ] Accesibilidad audit (WCAG AA)
- [ ] Browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Copy review final
- [ ] SEO final check

---

## 5️⃣ Optional/Advanced Features

### Post-MVP Enhancements

```
1. Payment Refunds Dashboard
   - View refunds, process refunds, logs

2. Course Batching / Bundles
   - Sell múltiples cursos juntos
   - Pricing rules

3. User Reviews / Ratings
   - Staff ratings
   - Course reviews

4. Advanced Filtering
   - Services por tipo, precio, duración
   - Cursos por categoría, difficulty

5. Student Progression Paths
   - Curso obligatorio A → luego B
   - Prerequisites

6. Affiliates / Referral Program
   - Código referral
   - Comisiones

7. Multi-language Support
   - i18n setup
   - Traducción contenido

8. Mobile App
   - React Native version

9. Video Transcoding
   - Automatizar desde formatos varios

10. Advanced Search
    - Full-text search
    - Elasticsearch integration
```

---

## 6️⃣ Performance Checklist

- [ ] Database queries optimizadas
  - [ ] Indexes correctos
  - [ ] N+1 query problems fixed
  - [ ] Pagination implementada
- [ ] Images optimizadas
  - [ ] WebP format
  - [ ] Lazy loading
  - [ ] Responsive sizes
- [ ] CSS optimizado
  - [ ] Critical CSS inlined
  - [ ] Unused CSS removed
  - [ ] Minified
- [ ] JS optimizado
  - [ ] Code splitting
  - [ ] Dynamic imports
  - [ ] Tree shaking
- [ ] Caching strategy
  - [ ] Browser cache headers
  - [ ] CDN usage
  - [ ] Redis cache (optional)
- [ ] Database connection
  - [ ] Connection pooling
  - [ ] Query timeout management

---

## 7️⃣ Security Enhancements

- [ ] Rate limiting en todos endpoints
- [ ] CORS propiamente configurado
- [ ] CSRF protection
- [ ] XSS prevention (input sanitization)
- [ ] SQL injection prevention (Prisma safe)
- [ ] Secrets management (.env.local no en git)
- [ ] Password hashing (bcrypt, argon2)
- [ ] Session security (secure cookies)
- [ ] Audit logging (quien hizo qué)
- [ ] Data encryption (PII en DB)

---

## ✅ Definition of Done

Proyecto está "completo" si:
- [ ] FASE 1: Academia + cursos + test + certificados ✓
- [ ] FASE 2: Community (likes, comments, chat, IA) ✓
- [ ] FASE 3: Marketing pages (about, services, team, contact) ✓
- [ ] FASE 4: Polish (analytics, staff portal, tests)
- [ ] Performance: Lighthouse > 90
- [ ] Security: Audit passed
- [ ] Accesibilidad: WCAG AA
- [ ] Mobile responsive
- [ ] Testing: >70% coverage
- [ ] Documentation: README actualizado
- [ ] Backup & disaster recovery plan
- [ ] Monitoring en producción
- [ ] Team training completado

---

**Resumen Final:**

Este roadmap completo transforma el proyecto de un booking system + payment integration en una **plataforma educativa y de engagement integral**.

**Timeline aproximado:**
- Fase 1 (Academia): 2-3 semanas
- Fase 2 (Community): 1-2 semanas
- Fase 3 (Marketing): 1 semana
- Fase 4 (Polish): 2-3 semanas

**Total**: ~6-9 semanas de desarrollo full-time.

---

**Listo para empezar?** Comienza por `FEATURES_01_ACADEMY_CORE.md` y sigue paso a paso.

¡Éxito! 🚀
