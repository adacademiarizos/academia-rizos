# Especificación: Robustecimiento y Completitud del Sistema de Pagos (Stripe)

> **Objetivo del documento:** auditar en profundidad el subsistema de pagos actual (Stripe Checkout) e implementar las piezas faltantes para que "todo lo relativo a pagos esté cubierto": depósitos con saldo pendiente, reembolsos gestionables, reconciliación fiable, idempotencia, consistencia de comisiones y endurecimiento de seguridad.
>
> Este spec es transversal y **consolida/depende** del `specs/03-stripe-webhook-lifecycle.md` (ciclo de vida de eventos). Donde haya solapamiento, este documento manda sobre la visión global de pagos y el 03 sobre el detalle de cada evento del webhook.

---

## 0. Estado actual (auditoría del código)

Análisis de: `src/lib/stripe.ts`, `src/lib/fees.ts`, `src/app/api/stripe/checkout/route.ts`, `src/app/api/courses/[courseId]/checkout/route.ts`, `src/app/api/pay/[id]/checkout/route.ts`, `src/app/api/admin/payment-links/route.ts`, `src/app/api/staff/payment-links/route.ts`, `src/app/api/stripe/webhook/route.ts`, y modelos `Payment`, `PaymentLink`, `Settings`, enums `BillingRule` / `PaymentStatus` / `PaymentType` en `prisma/schema.prisma`.

**Lo que funciona hoy:**
- Tres flujos de Checkout Session (`mode: "payment"`): cita (`APPOINTMENT`), curso (`COURSE`) y link de pago (`PAYMENT_LINK`).
- Cada flujo crea un `Payment` con estado `PROCESSING` clavado por `stripeCheckoutSessionId`.
- El webhook verifica firma (`stripe.webhooks.constructEvent`) y, en `checkout.session.completed`, hace `upsert` del `Payment` a `PAID`, confirma la cita / otorga acceso al curso / marca el link como pagado, y dispara emails + notificaciones.
- Comisión de pasarela repercutida al cliente vía `addStripeFees()` (base + % + fijo) en curso y link de pago.

**Huecos y riesgos detectados (motivan este spec):**

| # | Hallazgo | Severidad | Evidencia |
|---|---|---|---|
| H1 | **DEPÓSITO sin saldo pendiente.** En `billingRule = DEPOSIT` solo se cobra el % online; el webhook marca el `Payment` como `PAID` (no `PARTIAL`), y **no existe mecanismo para cobrar el resto**. No se registra "total adeudado vs pagado". | 🔴 Crítica | `stripe/checkout/route.ts` (cálculo `chargeAmount`); webhook fija `status: "PAID"` |
| H2 | **AUTHORIZE es un nombre engañoso.** El enum sugiere una autorización/retención de tarjeta (hold), pero la implementación real es "pagar en persona / sin cobro". El estado `PaymentStatus.AUTHORIZED` nunca se usa. No hay retención real con captura manual. | 🟠 Alta | `checkout/route.ts` rechaza AUTHORIZE con `NO_CHARGE`; `bookings/draft` solo notifica |
| H3 | **Reembolsos fuera de la app.** No hay acción de "reembolsar" en el panel admin; y el webhook no escucha `charge.refunded`. Un reembolso hecho en el Dashboard de Stripe no revierte cita/acceso ni actualiza `Payment.status`. | 🔴 Crítica | Ausencia de endpoint; webhook solo escucha `checkout.session.completed` |
| H4 | **`stripeChargeId` nunca se persiste.** El campo existe en el modelo pero el webhook solo guarda `stripePaymentIntentId`. Sin el charge no se puede reembolsar ni reconciliar de forma fiable. | 🟠 Alta | `Payment.stripeChargeId` sin asignación en todo el código |
| H5 | **Sin claves de idempotencia** en `checkout.sessions.create`. Doble submit genera sesiones y `Payment` duplicados (mitigado parcialmente por el `upsert` por sessionId, pero no en la creación). | 🟠 Alta | Ninguna llamada pasa `{ idempotencyKey }` |
| H6 | **Comisión inconsistente.** Curso y link de pago **añaden** fee al cliente; la cita **no** aplica fee. Además, repercutir la comisión de tarjeta al consumidor (surcharging) está restringido en la UE para tarjetas de consumo (Reg. UE 2015/751 / PSD2). | 🟠 Alta | `courses/checkout` y `payment-links` usan `addStripeFees`; `stripe/checkout` (cita) no |
| H7 | **Pagos asíncronos no contemplados.** Solo se maneja `checkout.session.completed` (síncrono, tarjeta). Métodos comunes en la UE (SEPA, transferencias) completan de forma diferida vía `async_payment_succeeded/failed`. | 🟠 Alta | Webhook sin esos eventos |
| H8 | **Cliente de Stripe sin `apiVersion` fijada** y clave secreta única (no restringida). Riesgo de rupturas por cambios de versión y mayor blast radius ante fuga. | 🟡 Media | `new Stripe(env.STRIPE_SECRET_KEY)` sin opciones |
| H9 | **Mínimos y moneda solo validados en la cita.** `courses/checkout` y `pay/[id]/checkout` no validan el mínimo de Stripe (~50 cts) ni normalizan la moneda de forma centralizada. | 🟡 Media | Validación `< 50` solo en `stripe/checkout` |
| H10 | **Endpoints de checkout de cita y link sin autenticación.** `POST /api/stripe/checkout` y `POST /api/pay/[id]/checkout` son públicos; permiten enumerar/generar sesiones para `appointmentId`/`linkId` arbitrarios. | 🟡 Media | Sin `getServerSession` en esos handlers |
| H11 | **La página de éxito no debe otorgar nada.** Debe confirmarse que `booking/success`, `courses/[id]?session_id` y `pay/[id]/success` son solo informativas y que **el webhook es la única fuente de verdad** para otorgar acceso/confirmar. | 🟡 Media | A verificar en las páginas de success |
| H12 | **Sin reconciliación de neto real.** `Payment.amountCents` guarda lo cobrado (`amount_total`), pero no se guarda la comisión real de Stripe ni el `balance_transaction`. Imposible cuadrar ingresos netos. | 🟡 Media | Webhook no lee `balance_transaction` |

---

## 1. Requerimientos de Usuario (Spec Writer)

- [ ] **Historia principal:** Como negocio, quiero que el ciclo completo de cada pago (cobro, depósito + saldo, reembolso, fallo, disputa, expiración) quede reflejado con precisión en la plataforma, para no depender del Dashboard de Stripe ni perder trazabilidad contable.
- [ ] **HU-1 (Depósitos):** Como cliente que reservó con depósito, quiero que quede claro cuánto pagué y cuánto debo; y como negocio, quiero poder cobrar el saldo restante (online o marcarlo como cobrado en persona) antes o durante la cita.
  - Criterio: un `Appointment` con `DEPOSIT` refleja `montoTotal`, `montoPagado` y `saldoPendiente`; el `Payment` del depósito queda en `PARTIAL`, no en `PAID`.
- [ ] **HU-2 (Reembolsos):** Como admin, quiero reembolsar total o parcialmente un pago desde el panel; el reembolso debe revertir el efecto de negocio (cancelar cita / revocar acceso al curso según política) y quedar registrado.
  - Criterio: reembolso disparado desde la app crea el refund en Stripe con `idempotencyKey`, y el webhook `charge.refunded` deja `Payment.status = REFUNDED` (o `PARTIAL` si es parcial).
- [ ] **HU-3 (Idempotencia y duplicados):** Como negocio, quiero que doble clic o reintentos de red no generen cobros ni registros duplicados.
- [ ] **HU-4 (Consistencia de comisiones):** Como negocio, quiero una política de comisión única y legalmente conforme, aplicada de forma idéntica en cita, curso y link de pago.
- [ ] **HU-5 (Pagos diferidos):** Como negocio en la UE, quiero soportar métodos de pago no inmediatos sin otorgar acceso hasta que el pago realmente se confirme.
- [ ] **HU-6 (Reconciliación):** Como admin, quiero ver por cada pago el bruto, la comisión real de Stripe y el neto liquidado.
- [ ] **HU-7 (Seguridad):** Como responsable técnico, quiero que las llaves, versiones de API y endpoints de pago sigan las mejores prácticas de Stripe (ver `.agents/skills/stripe-best-practices/references/security.md`).

**Fuera de alcance de este spec (se anota como backlog):** suscripciones/recurrencia, Stripe Connect (marketplace multi-profesional con payouts separados), Stripe Tax automático, guardado de métodos de pago (SetupIntents) para clientes recurrentes.

---

## 2. Diseño y Arquitectura (Designer)

### 2.1 Principios rectores (alineados con la skill de Stripe)

1. **El webhook es la única fuente de verdad.** Ninguna página de `success` otorga acceso ni confirma citas (verificar H11). Todo efecto de negocio ocurre en el handler del webhook.
2. **Checkout Sessions para todo cobro on-session** (ya se cumple). No introducir Card Element ni `payment_method_types` manuales — dejar **métodos de pago dinámicos** (omitir `payment_method_types`), gestionados desde el Dashboard.
3. **Idempotencia en toda mutación hacia Stripe** (`checkout.sessions.create`, `refunds.create`, captura de holds).
4. **Least privilege en llaves**: migrar a Restricted API Key (`rk_`) con permisos mínimos; fijar `apiVersion`.
5. **Dinero siempre en enteros de céntimos** y con moneda explícita; validación central de mínimos.

### 2.2 Cambios en el modelo de datos (Prisma) — diseño, no implementación

**a) `Payment` — nuevos campos de trazabilidad y reembolso**

```
model Payment {
  ...
  stripeChargeId          String? @unique   // ya existe: PERSISTIRLO desde el webhook (H4)

  // Reembolsos (H3)
  refundedAmountCents     Int      @default(0)
  refundedAt              DateTime?
  refundReason            String?

  // Reconciliación (H12)
  stripeFeeCents          Int?              // comisión real de Stripe (balance_transaction.fee)
  netAmountCents          Int?              // neto liquidado (amount - fee)
  stripeBalanceTxnId      String?

  // Depósito / saldo (H1)
  isDeposit               Boolean  @default(false)
  totalDueCents           Int?              // total del servicio cuando es depósito
}
```

**b) `Appointment` — estado económico del depósito (H1)**

```
model Appointment {
  ...
  totalPriceCents   Int?     // precio total resuelto al reservar
  amountPaidCents   Int      @default(0)   // suma de pagos PAID/PARTIAL confirmados
  // saldoPendiente = totalPriceCents - amountPaidCents (derivado, no se persiste)
  balanceSettled    Boolean  @default(false) // saldo cobrado (online o en persona)
}
```

**c) `WebhookEvent` — idempotencia de eventos entrantes (compartido con spec 03)**

```
model WebhookEvent {
  id            String   @id            // event.id de Stripe
  type          String
  processedAt   DateTime @default(now())
  @@index([type])
}
```
> Antes de procesar cualquier evento, `INSERT ... ON CONFLICT DO NOTHING` sobre `event.id`; si ya existía, se ignora (Stripe reintenta el mismo evento).

**d) `Settings` — política de comisión explícita (H6)**

```
model Settings {
  ...
  feeMode  String @default("ABSORB")  // "ABSORB" (negocio asume) | "SURCHARGE" (cliente paga)
  // feePercent / feeFixedCents ya existen
}
```

> Nota `PaymentStatus`: el enum ya contempla `PARTIAL`, `AUTHORIZED`, `FAILED`, `REFUNDED`, `CANCELED`. Este spec **activa** su uso real; no se requieren nuevos valores salvo, opcionalmente, `PARTIALLY_REFUNDED` (puede modelarse con `REFUNDED` + `refundedAmountCents < amountCents`).

### 2.3 Decisión sobre `BillingRule.AUTHORIZE` (resolver H2)

Se documenta la ambigüedad y se elige explícitamente una de dos vías (requiere confirmación del negocio en el Human Gate):

- **Opción A — "Pago en persona" (mantener comportamiento actual, renombrar semántica):** `AUTHORIZE` = la cita se agenda sin cobro online y se paga en el salón. Es lo que hace hoy el código. Acción: documentarlo claramente en `context.md` y, si se desea, considerar renombrar a `ON_SITE` en un futuro (cambio de enum = migración).
- **Opción B — "Retención real de tarjeta" (implementar hold):** usar PaymentIntent con `capture_method: "manual"` para autorizar (retener) el importe y capturarlo o cancelarlo tras la cita (útil contra no-shows; conecta con `specs/05-no-show-policy.md`). Mayor complejidad; el hold expira a los ~7 días.

Recomendación del Spec Writer: **Opción A para el MVP** (menos riesgo, ya funciona), dejando la Opción B como spec futuro ligado a la política de no-show.

### 2.4 Flujos objetivo

**Flujo depósito (H1):**
1. Checkout cobra el % → `Payment{ type: APPOINTMENT, isDeposit: true, status: PROCESSING, totalDueCents }`.
2. Webhook `completed` → `Payment.status = PARTIAL`; `Appointment.amountPaidCents += amount`; cita `CONFIRMED`.
3. Cobro del saldo: (a) generar automáticamente un `PaymentLink` por el saldo, o (b) el admin marca `balanceSettled = true` (cobrado en persona). Al saldar por link, `Appointment.amountPaidCents` llega al total y `balanceSettled = true`.

**Flujo reembolso (H3):**
1. Admin pulsa "Reembolsar" (total/parcial) en el detalle del pago → endpoint autenticado admin → `stripe.refunds.create({ payment_intent, amount }, { idempotencyKey })`.
2. Webhook `charge.refunded` → actualiza `refundedAmountCents`, `refundedAt`; `status = REFUNDED` (o parcial); aplica política de reversión (cancelar `Appointment` / revocar `CourseAccess` según reglas) y notifica.

**Flujo pago diferido (H7):** en checkout con métodos no inmediatos, el acceso/confirmación se otorga en `checkout.session.async_payment_succeeded`; `async_payment_failed` marca `Payment.status = FAILED` sin otorgar nada.

### 2.5 Endurecimiento de seguridad (H8, H10) — ref. skill Stripe

- Fijar `apiVersion` al inicializar el cliente Stripe.
- Migrar `STRIPE_SECRET_KEY` → Restricted API Key con permisos mínimos (Checkout, PaymentIntents, Refunds, Charges read, Balance transactions read); claves separadas por entorno (prod/staging).
- Autenticar/limitar `POST /api/stripe/checkout` y `POST /api/pay/[id]/checkout`: el de cita debe exigir que el solicitante sea el dueño de la cita o staff/admin; el link de pago es público por diseño pero con rate-limit.
- Confirmar que ningún log imprime llaves ni el `rawBody` con datos sensibles.

### 2.6 Consideraciones MCP / servicios externos

- **Stripe** (pasarela). Requiere configurar en el Dashboard la suscripción de eventos ampliada (ver spec 03) y los métodos de pago dinámicos.
- **Nodemailer** (`src/lib/mail.ts`) y `NotificationService`: reutilizar para avisos de reembolso, saldo pendiente y pago diferido, manteniendo el patrón fire-and-forget existente.
- Sin dependencia de nuevas bases externas.

---

## 3. Lista de Tareas (Task Planner)

> Ejecutar en rama `feature/stripe-payments-hardening`. Auth, pagos y lógica core → **tests obligatorios** (unitarios + integración), según la matriz de `AGENT.md`.

**Bloque A — Fundaciones (seguridad y trazabilidad):**
- [ ] T1: Fijar `apiVersion` en `src/lib/stripe.ts` y documentar migración a Restricted API Key + claves por entorno.
- [ ] T2: Migración Prisma: añadir campos a `Payment` (`refundedAmountCents`, `refundedAt`, `refundReason`, `stripeFeeCents`, `netAmountCents`, `stripeBalanceTxnId`, `isDeposit`, `totalDueCents`), a `Appointment` (`totalPriceCents`, `amountPaidCents`, `balanceSettled`), a `Settings` (`feeMode`) y crear modelo `WebhookEvent`.
- [ ] T3: Persistir `stripeChargeId` y `balance_transaction` (fee/net) en el webhook al completar el pago (resuelve H4/H12).
- [ ] T4: Introducir idempotencia de eventos entrantes usando `WebhookEvent` (INSERT-on-conflict) al inicio del handler.

**Bloque B — Idempotencia y consistencia de creación:**
- [ ] T5: Añadir `idempotencyKey` determinista a los tres `checkout.sessions.create` (p. ej. derivado de `appointmentId`/`courseId+userId`/`linkId`).
- [ ] T6: Unificar validación de mínimo de Stripe y normalización de moneda en un helper compartido; aplicarla en los tres flujos (resuelve H9).
- [ ] T7: Definir e implementar la política de comisión única vía `Settings.feeMode`; aplicar el mismo cálculo en cita, curso y link (resuelve H6). Incluir nota de cumplimiento UE sobre surcharging.

**Bloque C — Depósitos con saldo (H1):**
- [ ] T8: Al crear checkout de depósito, guardar `isDeposit`, `totalDueCents` y `Appointment.totalPriceCents`.
- [ ] T9: En el webhook, para depósitos, fijar `Payment.status = PARTIAL` y actualizar `Appointment.amountPaidCents`.
- [ ] T10: Cobro del saldo: acción admin/staff que (a) genera `PaymentLink` por el saldo o (b) marca `balanceSettled = true`; reconciliar `amountPaidCents` al total.
- [ ] T11: Exponer en el detalle de cita (admin/staff) el desglose total / pagado / pendiente.

**Bloque D — Reembolsos y ciclo de vida (coordinar con spec 03):**
- [ ] T12: Endpoint autenticado admin `POST /api/admin/payments/[id]/refund` (total/parcial) usando `refunds.create` con `idempotencyKey`.
- [ ] T13: Manejar en el webhook `charge.refunded` (actualizar montos/estado + reversión de negocio) y `charge.dispute.created/closed`.
- [ ] T14: Manejar `checkout.session.expired`, `payment_intent.payment_failed`, `checkout.session.async_payment_succeeded/failed` (H7) con sus efectos.
- [ ] T15: UI admin: botón "Reembolsar" y visualización de estado de reembolso/disputa en el detalle del pago.

**Bloque E — Seguridad de endpoints y verificación:**
- [ ] T16: Proteger `POST /api/stripe/checkout` (owner/staff/admin) y añadir rate-limit a `POST /api/pay/[id]/checkout`.
- [ ] T17: Verificar y, si hace falta, corregir que las páginas de success (`booking/success`, `courses/[id]`, `pay/[id]/success`) sean puramente informativas (resuelve H11).

**Bloque F — Pruebas y documentación:**
- [ ] T18: Tests de integración con eventos simulados de Stripe (CLI `stripe trigger` / fixtures) para: completado, depósito parcial, expiración, fallo, reembolso total y parcial, disputa, y reintento del mismo `event.id` (idempotencia).
- [ ] T19: Tests unitarios del helper de comisiones y de mínimos/moneda.
- [ ] T20: Documentar el subsistema de pagos en `/docs` (flujo, eventos escuchados, matriz estado→efecto, política de comisión) según `skills/documentation-rules.md`, y registrar decisiones en `engram.json`.

---

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/stripe-payments-hardening`. Antes de tocar cualquier archivo de pagos, lee `.agents/skills/stripe-best-practices/SKILL.md` y sus referencias `payments.md`, `security.md` y `billing.md`. Al finalizar, verifica contra la suite de `/tests` antes de solicitar Merge a `dev`. Detente aquí — Human Gate — hasta recibir aprobación y, en particular, la decisión sobre §2.3 (AUTHORIZE Opción A vs B) y §2.5/T7 (política de comisión ABSORB vs SURCHARGE).)*
