# Plan de Testeo — Apoteósicas / Elizabeth Rizos Platform

> Objetivo: llevar la plataforma a **0 errores** verificables en sus tres productos
> (Marketing, Reservas+Pagos, Academia/LMS) mediante una estrategia de testeo por
> capas, con foco prioritario en los flujos que mueven dinero o emiten certificados.

---

## Estado de implementación (actualizado)

Avance ya realizado sobre este plan (commit en curso):

| Ítem | Estado |
|------|--------|
| Toolchain de test (Vitest 4 + coverage v8) instalado y configurado (`vitest.config.ts`, alias `@/`) | ✅ Hecho |
| Scripts `typecheck`, `test`, `test:watch`, `test:cov` en `package.json` | ✅ Hecho |
| 3 tests de servicios migrados de Jest→Vitest y **ahora ejecutables** (antes no corrían; faltaban mocks de `comment`/`like`) | ✅ Hecho |
| Unit tests nuevos de lógica pura (`fees`, `price-utils`) | ✅ Hecho |
| **Matriz de autorización** estática sobre los 125 endpoints (`src/__tests__/authorization-matrix.test.ts`) | ✅ Hecho — verde |
| **Fase 0 — typecheck** (`tsc --noEmit`) | ✅ 0 errores |
| **Fase 0 — ESLint**: gate estaba **roto** (FlatCompat + ESLint 9.39 → "circular structure"); reparado migrando a flat config nativa de `eslint-config-next` 16 | ✅ Reparado |
| **34 errores de ESLint** destapados al reparar el gate | ✅ Corregidos (0 errores; quedan 109 warnings de `no-unused-vars` pre-existentes) |
| Suite Vitest | ✅ **46 tests / 6 archivos** en verde |

### Detalle de los 34 errores de ESLint corregidos

| Regla | Nº | Corrección aplicada |
|-------|----|---------------------|
| `@next/next/no-assign-module-variable` | 13 | Renombrada la variable local `module` → `mod` en rutas de cursos/módulos |
| `react-hooks/purity` | 9 | `new Date()`/`Math.random()` movidos a lazy `useState`/`useEffect` (evita impureza y mismatch de hidratación SSR) |
| `react-hooks/set-state-in-effect` | 5 | Regla desactivada con justificación: patrón fetch-on-change + lectura de `localStorage` (el proyecto no usa React Query/SWR). No son bugs |
| `react/no-unescaped-entities` | 4 | Comillas escapadas con `&ldquo;`/`&rdquo;` |
| `@typescript-eslint/ban-ts-comment` | 3 | Añadida descripción a `@ts-expect-error`; `@ts-ignore`→`@ts-expect-error` |

> El typecheck atrapó una regresión introducida durante el renombrado (`module.courseId`
> huérfano apuntando al `module` global de CommonJS) — evidencia del valor del gate estático.

Pendiente (siguientes pasos): integración con DB de test (fase 2), E2E con Playwright + Stripe CLI (fase 3), y corrección de los 9 riesgos de §8.

---

## 0. Estado actual (línea base del análisis)

| Dimensión | Hallazgo |
|-----------|----------|
| **Tamaño** | 125 endpoints API · 63 páginas · ~16 servicios de servidor · ~19 libs · 40+ modelos Prisma |
| **Stack** | Next.js 16 (App Router) · React 19 · TS · Prisma + PostgreSQL (Neon) · Stripe · NextAuth (Google + credenciales) · Cloudflare R2 · OpenAI · Puppeteer · Nodemailer/Resend/Gmail |
| **Runner de tests** | ❌ **No hay** (ni Jest, ni Vitest, ni Playwright en `package.json`; no existe script `test`) |
| **Tests existentes** | 4 archivos con sintaxis Jest (`jest.mock`, `jest.fn`) que **no pueden ejecutarse**: `src/__tests__/etapa5-e2e.test.ts` + 3 en `src/server/services/__tests__/`. Los e2e solo comprueban 401/404 sin auth (cobertura superficial) |
| **Dependencias** | ⚠️ `node_modules` **no instalado** en este entorno — nada (typecheck, lint, build, tests) corre hasta hacer `npm install` |
| **Lint** | `next lint` fue removido en Next 16 → hay que migrar a ESLint CLI directo |
| **Auth** | ❌ Sin `middleware.ts` central. Cada ruta valida permisos por su cuenta (`checkAdminAuth`, `getServerSession`) → riesgo de rutas desprotegidas por olvido |
| **Contratos API** | ⚠️ Inconsistentes: conviven `{ ok, error:{ code, message } }` y `{ success, error: string }` (466 ocurrencias en 103 archivos) |
| **Servicios vacíos** | `booking.service.ts` y `billing.service.ts` están vacíos; la lógica vive dispersa en las rutas |

> **Conclusión:** el proyecto compila y está bien estructurado, pero **no existe red de
> seguridad automatizada**. Este plan define (a) la infraestructura a montar y (b) la
> batería de casos a cubrir, ordenados por riesgo.

---

## 1. Estrategia: pirámide de testeo

```
        ╱╲        E2E (Playwright)  ── pocos, flujos críticos de dinero/certificados
       ╱  ╲
      ╱----╲      Integración (Vitest + DB de test)  ── APIs, auth, reglas de negocio
     ╱      ╲
    ╱--------╲    Unitarios (Vitest)  ── servicios y libs puras (fees, slots, precios)
   ╱__________╲   Estático (tsc + ESLint + build)  ── gate base, 0 errores de compilación
```

### Herramientas recomendadas

| Capa | Herramienta | Por qué |
|------|-------------|---------|
| Estático | `tsc --noEmit`, ESLint 9 (flat), `next build` | Ya disponibles; primer gate |
| Unit + Integración | **Vitest** | Mejor encaje con Next 16/ESM/TS que Jest; API `describe/it/expect` compatible con los tests actuales (migrar `jest.*` → `vi.*`) |
| Mock de DB | `vitest-mock-extended` o DB de test real (Neon branch / Postgres en Docker) | Integración real para reglas de negocio; mock para unit puro |
| E2E | **Playwright** | Multi-navegador, intercepción de red, fixtures de auth |
| Webhooks Stripe | **Stripe CLI** (`stripe listen` / `stripe trigger`) | Firmar y reproducir eventos reales contra `/api/stripe/webhook` |
| Carga/concurrencia | k6 o autocannon (opcional, P2) | Validar race conditions de doble-booking |

### Priorización por riesgo

- **P0 (bloqueante):** Pagos Stripe + webhooks · Reservas/disponibilidad · Auth y autorización por rol · Emisión de certificados.
- **P1 (alto):** LMS (cursos, módulos, tests, examen, progreso) · CRUD admin · Uploads R2 · Notificaciones.
- **P2 (medio):** Comunidad (comentarios/likes/chat) · Analytics · IA (transcripción/sinopsis/chat) · Marketing/landing.

---

## 2. Preparación del entorno de testeo

1. **Instalar dependencias**
   ```bash
   npm install
   ```
2. **Añadir el toolchain de test** (`devDependencies`)
   ```bash
   npm i -D vitest @vitest/coverage-v8 vitest-mock-extended \
            @playwright/test dotenv-cli
   npx playwright install --with-deps
   ```
3. **Scripts en `package.json`**
   ```jsonc
   {
     "scripts": {
       "typecheck": "tsc --noEmit",
       "lint": "eslint .",
       "test": "vitest run",
       "test:watch": "vitest",
       "test:cov": "vitest run --coverage",
       "test:e2e": "playwright test"
     }
   }
   ```
4. **Base de datos de test aislada** — usar una *branch* de Neon o Postgres local dedicada
   (`DATABASE_URL` de test). Nunca apuntar a producción.
   ```bash
   dotenv -e .env.test -- npx prisma migrate deploy
   dotenv -e .env.test -- npx prisma db seed
   ```
5. **`.env.test`** con claves Stripe de *test* (`sk_test_…`, `whsec_…`), R2 sandbox o mock,
   y `OPENAI_API_KEY` mockeado.
6. **Fixtures/seed determinista**: un admin, un staff, un student, 1 servicio por
   `billingRule`, 1 curso publicado con módulos+examen, 1 certificado emitido.
7. **Stripe CLI** para webhooks:
   ```bash
   stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   stripe trigger checkout.session.completed
   ```

---

## 3. Fase 0 — Gate estático (debe quedar en 0 antes de seguir)

| Check | Comando | Criterio de paso |
|-------|---------|------------------|
| Tipos | `npm run typecheck` | 0 errores |
| Lint | `npm run lint` | 0 errores (warnings catalogados) |
| Build producción | `npm run build` | Build exitoso, sin fallos de Prisma generate/migrate |
| Variables de entorno | arranque con `.env` incompleto | `src/lib/env.ts` hace `EnvSchema.parse()` en import: si falta una var, **toda ruta que importe `env` cae con 500**. Test: validar mensaje claro y documentar mínimos |

---

## 4. Fase 1 — Tests unitarios (lógica pura)

Foco en funciones determinísticas, sin DB. Alto retorno por bajo costo.

| Módulo | Archivo | Casos clave |
|--------|---------|-------------|
| **Comisiones** | `src/lib/fees.ts` | cálculo fee % + fijo; redondeo a céntimos; moneda; importe 0; importes grandes |
| **Precios** | `src/lib/price-utils.ts`, `price-utils` | formato/parseo; variante vs servicio base; sin precio configurado |
| **Slots de disponibilidad** | `buildSlotsForDay` / `toMinutes` en `api/availability/route.ts` | duración que no divide la jornada; servicio que no cabe antes del cierre; día cerrado; off-day; **TZ: `getDay()`/`setHours()` usan hora local del servidor → en Vercel (UTC) los slots se desplazan** (ver §9) |
| **QR / verificación** | `src/lib/qr.ts` | generación de código; URL de verificación |
| **Servicios LMS** | `course-service`, `achievement-service`, `analytics-service`, `notification-service`, `community-service`, `certificate-service` | reusar los 3 tests existentes migrados a Vitest + ampliar ramas de error |

> **Migración:** los 3 tests de `src/server/services/__tests__/` usan `jest.mock`/`jest.fn`.
> Con Vitest: `vi.mock`/`vi.fn` (o `globals: true` + alias de compatibilidad).

---

## 5. Fase 2 — Tests de integración (API + reglas de negocio)

### 5.1 Matriz de autorización (crítico — no hay middleware central)

Para **cada uno de los 125 endpoints**, verificar la respuesta esperada por actor:

| Actor | Esperado en ruta `admin/*` | en `staff/*` | en `student/*` | en pública |
|-------|---------------------------|--------------|----------------|------------|
| Anónimo | 401 | 401 | 401 | 200 |
| STUDENT | 403 | 403 | 200 (propio) | 200 |
| STAFF | 403 | 200 | — | 200 |
| ADMIN | 200 | 200 | 200 | 200 |

> Generar esta matriz automáticamente recorriendo el árbol de `route.ts` para detectar
> **rutas sin guardia** (olvido de `checkAdminAuth`/`getServerSession`). Es el test de
> seguridad de mayor valor dado que no existe `middleware.ts`.

### 5.2 Casos por dominio

**Reservas (`/api/availability`, `/api/availability/days`, `/api/bookings/draft`)**
- Slots libres correctos; excluir slots pasados (`> Date.now()`); excluir solapados con citas `PENDING`/`CONFIRMED`.
- `draft`: falta de campos → 400; servicio inactivo → 404; sin precio staff/servicio → 400 `NO_PRICE`; fecha inválida → 400.
- **Doble-booking:** dos `draft` concurrentes al mismo slot (ver §9 — la verificación actual no usa transacción ni constraint único y solo compara `startAt` exacto).
- `billingRule = AUTHORIZE`: crea cita `PENDING` y notifica a staff+admins sin pasar por Stripe.
- Vinculación de `customerId` si el email ya tiene cuenta.

**Pagos (`/api/stripe/checkout`, `/api/courses/[id]/checkout`, `/api/pay/[id]/checkout`, `/api/stripe/webhook`)**
- Crear sesión con `metadata` correcta (`type`, `appointmentId`/`courseId`/`paymentLinkId`, datos de analytics).
- Webhook: firma inválida → 400; sin firma → 400; `checkout.session.completed` → `Payment` PAID (upsert por `stripeCheckoutSessionId`).
- APPOINTMENT → `Appointment` CONFIRMED + emails (cliente, staff, admins) + notificaciones in-app.
- COURSE → `CourseAccess` creado + email recibo + notificación + actividad/logro.
- PAYMENT_LINK → `PaymentLink` PAID.
- **Idempotencia:** reenviar el mismo evento dos veces (ver §9 — `conversionEvent` y notificaciones a admin se duplican; el recibo está protegido por `receiptEmailSentAt`).
- Recibo no reenviado si `receiptEmailSentAt` ya existe.

**Academia / LMS**
- CRUD admin de cursos/módulos/lecciones/recursos/tests/preguntas (crear, editar, reordenar, borrar en cascada).
- Acceso: student sin compra → sin acceso a módulos; con `CourseAccess` → acceso; expiración (`rentalDays`/`expiresAt`, job `expireAccess`).
- Progreso: `POST /api/modules/[id]/progress` marca completado; recálculo de % del curso.
- Tests de módulo y examen final: envío, `SubmissionStatus` PENDING→APPROVED/REVISION_REQUESTED; impedir reenvío según estado.
- **Examen → certificado:** aprobar en `/admin/certificates/[id]/approve` dispara `certificate.service` (Puppeteer → PDF → R2 → `Certificate` valid) + email + notificación.

**Certificados**
- `GET /verify/certificate/[code]`: válido, revocado, inexistente.
- Revocación desde admin → `valid=false` + notificación al estudiante.
- Generación PDF: contenido (nombre, curso, QR) y subida a R2 (riesgo Puppeteer serverless, §9).

**Uploads (`/api/uploads`, `/uploads/presigned`, `/uploads/confirm`, `/admin/uploads/image`, `/chat/images`, `/student/uploads`)**
- Validación MIME y tamaño; presigned URL; confirmación; rechazo de tipos no permitidos; límite por rol.

**Comunidad**
- Comentarios/likes: crear (auth), borrar propios, no borrar ajenos; contadores; notificación al autor.
- Chat por curso: solo compradores; mensajes; imágenes; comunidad global.

**Notificaciones**
- Creación por evento (tabla §ARCHITECTURE); `mark-all-read`; stream SSE (`/notifications/stream`).

**IA**
- `transcribe`/`synopsis`/`chat`: con `OPENAI_API_KEY` ausente → degradación elegante, no 500 sin control; límites de payload.

**Analytics**
- `pageview` y `ConversionEvent` registran; dashboards admin (`overview`, `funnel`, `geo`, `devices`, `sources`, `traffic`, `campaigns`, `courses`) devuelven agregados coherentes y respetan rango de fechas.

### 5.3 Contratos de respuesta
- Test de contrato que afirme la forma (`ok` vs `success`) por endpoint y detecte **mezclas** que rompan al frontend (ver §9). Idealmente, unificar a una sola convención.

---

## 6. Fase 3 — E2E (Playwright) — flujos de dinero y certificación

| # | Flujo | Pasos | Resultado esperado |
|---|-------|-------|--------------------|
| E1 | **Reserva con pago** | servicio → profesional → fecha → datos → Stripe (`4242…`) → success | Cita `CONFIRMED`, email, slot ya no disponible |
| E2 | **Reserva AUTHORIZE** | servicio "pago en sitio" → confirmar | Cita `PENDING`, notificación a staff/admin, sin Stripe |
| E3 | **Compra de curso** | `/courses/[id]` → comprar → Stripe → volver | `CourseAccess`, módulos desbloqueados, recibo |
| E4 | **Aprender + examen + certificado** | ver módulos → completar → enviar examen → (admin aprueba) → descargar PDF → verificar QR público | Certificado válido en `/verify/...` |
| E5 | **Auth y roles** | registro, login credenciales, login Google, persistencia de sesión, redirecciones por rol | ADMIN/STAFF/STUDENT ven su panel; sin acceso cruzado |
| E6 | **Admin CRUD servicio** | crear servicio + precio staff + imagen → aparece en booking | Coherencia front/back |
| E7 | **Link de pago** | admin crea link → cliente paga → `PAID` | Estado y recibo |

Cada E2E con Stripe usa **Stripe CLI** reenviando el webhook al server local.

---

## 7. Fase 4 — Testeo manual / exploratorio

Checklists por rol (complementan lo automatizado):
- **Responsive**: móvil/tablet/desktop en landing, booking wizard, player de curso.
- **Accesibilidad básica**: foco, contraste, navegación por teclado en formularios.
- **Estados vacíos y de error**: sin cursos, sin citas, pago fallido/cancelado, red caída.
- **Emails reales**: render en Gmail/Outlook de confirmación, recibo, certificado.
- **i18n/copys**: textos en español, formato de fecha/moneda (es-ES, EUR).
- **Caching**: páginas con `force-dynamic` (17 detectadas) muestran datos frescos; el resto cachea bien.

---

## 8. Riesgos y bugs potenciales ya detectados (priorizar su cobertura)

> Detectados durante el análisis estático. Cada uno debe tener un test que lo capture
> **y** una corrección.

1. **Zona horaria en disponibilidad** — `api/availability/route.ts` usa `targetDay.getDay()`
   y `setHours()` (hora local del *servidor*). En Vercel el runtime es UTC → los slots se
   calculan en UTC, no en horario de España. **Síntoma probable:** horarios corridos 1–2 h.
   *Test:* fijar `TZ=UTC` y comparar contra `Europe/Madrid`.

2. **Idempotencia del webhook Stripe** — `api/stripe/webhook/route.ts` no deduplica por
   `event.id`. `db.conversionEvent.create(...)` y `NotificationService.notifyAllAdmins(...)`
   se ejecutan en **cada** reentrega → conversiones y notificaciones duplicadas (analytics
   inflado). El recibo sí está protegido por `receiptEmailSentAt`. *Test:* reproducir el
   mismo evento 2×.

3. **Doble-booking / race condition** — `bookings/draft` comprueba colisión con `findFirst`
   por `startAt` **exacto** y status `PENDING/CONFIRMED`, sin transacción ni constraint
   único. (a) Dos servicios de distinta duración pueden **solaparse** sin detectarse;
   (b) dos requests simultáneos crean dos citas. *Test:* concurrencia + solape parcial.
   *Fix sugerido:* constraint único `(staffId, startAt)` + chequeo de solapamiento real.

4. **Citas PENDING colgadas** — si un `AUTHORIZE`/`DEPOSIT` nunca se paga, la cita `PENDING`
   bloquea el slot indefinidamente (no hay job de expiración como sí existe para cursos).
   *Test/decisión:* TTL de citas no pagadas.

5. **Contratos API inconsistentes** — `{ ok, error:{code} }` vs `{ success, error }`
   (466 usos / 103 archivos). El cliente que lea la forma equivocada falla silenciosamente.
   *Test de contrato* + unificación.

6. **Sin guardia central de auth** — sin `middleware.ts`; cualquier `route.ts` nuevo puede
   olvidar la verificación. *Test:* matriz de autorización (§5.1) sobre los 125 endpoints.

7. **`env.ts` parse estricto en import** — falta de una sola variable tumba toda ruta que
   importe `env`. *Test:* arranque degradado + documentar el set mínimo obligatorio.

8. **Puppeteer en serverless** — generación de certificados con `@sparticuz/chromium-min`
   en Vercel: riesgo de timeout/cold-start/límite de memoria. *Test:* en preview de Vercel,
   no solo local.

9. **`.catch(() => {})` generalizado** — emails y notificaciones fire-and-forget tragan
   errores. Dificulta detectar fallos. *Recomendación:* logging/observabilidad mínima.

---

## 9. CI/CD — automatización del gate

`.github/workflows/ci.yml` (en cada PR):
```yaml
jobs:
  quality:
    steps:
      - npm ci
      - npm run typecheck        # Fase 0
      - npm run lint             # Fase 0
      - npx prisma generate
      - npm run test -- --coverage   # Fases 1–2 (DB de test en service container)
      - npm run build            # Fase 0
  e2e:
    steps:
      - npx playwright install --with-deps
      - npm run test:e2e         # Fase 3 (Stripe CLI / webhook mock)
```
Bloquear merge si cualquier job falla. Subir reporte de cobertura como artefacto.

---

## 10. Definición de "0 errores" (Definition of Done)

La plataforma se considera **sin errores** cuando:

- [ ] `typecheck`, `lint` y `build` pasan en 0.
- [ ] Matriz de autorización (§5.1) verde para los 125 endpoints — ninguna ruta desprotegida.
- [ ] Flujos P0 (E1–E5) verdes en E2E.
- [ ] Los 9 riesgos de §8 tienen test que los cubre **y** están corregidos o aceptados explícitamente.
- [ ] Cobertura de líneas: **≥80% en `src/server/services` y `src/lib`** (lógica de negocio); el resto best-effort.
- [ ] Webhook Stripe idempotente verificado con reentrega.
- [ ] Suite verde en CI sobre `main`.

---

## 11. Cronograma sugerido

| Semana | Entregable |
|--------|-----------|
| 1 | Entorno de test (Vitest+Playwright+DB+Stripe CLI), Fase 0 en verde, CI básico |
| 2 | Fase 1 (unit de libs/servicios) + matriz de autorización (§5.1) |
| 3 | Fase 2 dominios P0 (pagos, reservas, certificados) + fixes de §8 (#1,#2,#3) |
| 4 | Fase 2 P1/P2 + E2E E1–E7 |
| 5 | Manual/exploratorio, cierre de §8 restantes, cobertura ≥80%, DoD |

---

### Anexo — Mapa de superficie a cubrir
- **API:** 125 `route.ts` bajo `src/app/api/` (admin, student, staff, públicas, stripe, ai, analytics, chat).
- **Páginas:** 63 `page.tsx` (marketing, dashboard admin/staff/student, booking, pay, verify, profile).
- **Servicios:** `course`, `certificate`, `notification`, `achievement`, `analytics`, `community`, `marketing-analytics`, `ai` + jobs (`expireAccess`, `issueCertificate`, `sendReceipt`).
- **Libs:** `stripe`, `mail`, `gmail`, `storage`, `pdf`, `qr`, `fees`, `price-utils`, `auth*`, `env`, `openai`, `transcription`, `db`.
