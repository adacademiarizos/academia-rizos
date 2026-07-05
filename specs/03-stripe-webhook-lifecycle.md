# Especificación: Ciclo de Vida Completo de Pagos vía Webhook de Stripe

## 1. Requerimientos de Usuario (Spec Writer)

### Historia de usuario

> Como negocio (Elizabeth Rizos / Apoteósicas), quiero que el estado de mis pagos, citas y accesos a cursos se mantenga sincronizado automáticamente con lo que ocurre en Stripe (reembolsos, fallos, expiraciones, disputas), para no tener que reconciliar manualmente el Dashboard de Stripe con la base de datos de la plataforma y para no dejar accesos o citas activos sobre pagos que ya no son válidos.

### Contexto del problema (gap auditado)

El endpoint `src/app/api/stripe/webhook/route.ts` solo procesa el evento `checkout.session.completed`. El enum `PaymentStatus` en `prisma/schema.prisma` ya define los estados `FAILED`, `REFUNDED` y `CANCELED`, pero ningún flujo del código los asigna jamás. Consecuencias concretas hoy:

- Un reembolso hecho manualmente desde el Dashboard de Stripe **no se refleja** en `Payment.status` ni desencadena ninguna acción en la plataforma.
- Una `Appointment` cuyo pago fue reembolsado **sigue en estado `CONFIRMED`**, ocupando el horario del profesional y apareciendo como válida en el calendario del staff.
- Un `CourseAccess` otorgado por un pago que luego fue reembolsado o disputado **no se revoca**: el alumno conserva acceso al curso, video, certificado, etc.
- Un `checkout.session.expired` (cliente abandona el checkout) deja el `Payment` en `REQUIRES_PAYMENT` indefinidamente, sin marcarlo como `CANCELED`, ensuciando reportes y analítica de conversión.
- Un `payment_intent.payment_failed` (tarjeta rechazada) no se registra en absoluto: el negocio no se entera de que un cliente intentó pagar y falló.
- Una disputa (`charge.dispute.created`) — que implica riesgo financiero y plazos de respuesta ante el banco — no genera ninguna alerta al admin.

### Criterios de aceptación

- [ ] Dado un pago con `checkout.session.completed` ya procesado, cuando Stripe emite `charge.refunded` para ese `PaymentIntent`, el `Payment.status` pasa a `REFUNDED`.
- [ ] Dado un `Payment` tipo `APPOINTMENT` que pasa a `REFUNDED` o `CANCELED`, la `Appointment` asociada cambia su `status` a `CANCELLED` y libera el horario.
- [ ] Dado un `Payment` tipo `COURSE` que pasa a `REFUNDED` o el resultado de una disputa perdida (`charge.dispute.closed` con `status: lost`), el `CourseAccess` del alumno para ese curso se revoca.
- [ ] Dado un `checkout.session.expired`, el `Payment` correspondiente (si existe, creado en estado `REQUIRES_PAYMENT`) pasa a `CANCELED` y no queda huérfano.
- [ ] Dado un `payment_intent.payment_failed`, se crea/actualiza el `Payment` en estado `FAILED` y se notifica al cliente para reintentar.
- [ ] Dado un `charge.dispute.created`, se marca el `Payment` afectado y se notifica al admin por email e in-app con carácter urgente, incluyendo el plazo de respuesta (`evidence_details.due_by`) que envía Stripe.
- [ ] Ningún evento reenviado por Stripe (reintento de webhook) produce efectos duplicados: ni doble email, ni doble notificación in-app, ni transición de estado inconsistente.
- [ ] Todas las nuevas ramas de manejo de eventos respetan el patrón ya existente del proyecto: verificación de firma (`verifyStripeWebhook`), no lanzar excepción si una notificación falla, y responder `200 OK` a Stripe siempre que el evento se haya podido procesar (o encolar) correctamente.

## 2. Diseño y Arquitectura (Designer)

### 2.1. Eventos de Stripe a escuchar (adicionales a `checkout.session.completed`)

| Evento Stripe | Cuándo ocurre | Efecto en `Payment.status` | Efecto en `Appointment` | Efecto en `CourseAccess` |
|---|---|---|---|---|
| `checkout.session.expired` | El cliente abandona el Checkout y la sesión caduca (24h por defecto) sin completar el pago | `REQUIRES_PAYMENT` → `CANCELED` (solo si el `Payment` ya existía; si nunca se creó, no se crea uno nuevo) | Si existe `Appointment` asociada en `PENDING`, pasa a `CANCELLED` y libera el slot | No aplica (nunca se otorgó acceso) |
| `payment_intent.payment_failed` | La tarjeta es rechazada o el intento de pago falla | Se upsertea `Payment` (por `stripePaymentIntentId`) en estado `FAILED`, guardando el motivo de rechazo (`last_payment_error.message`) en `metadata` | Ninguno (la cita sigue `PENDING`; se le da al cliente oportunidad de reintentar antes de expirar el checkout) | Ninguno |
| `charge.refunded` | Un admin (o el propio Stripe por disputa ganada por el cliente) reembolsa un `Charge`, total o parcial | `PAID`/`PARTIAL` → `REFUNDED` si el reembolso es total; se mantiene `PAID` pero se registra el monto reembolsado en `metadata` si es parcial | Si `Payment.type === APPOINTMENT` y el reembolso es total → `Appointment.status = CANCELLED` | Si `Payment.type === COURSE` y el reembolso es total → se revoca el `CourseAccess` del `payerId` para ese `courseId` |
| `charge.dispute.created` | El titular de la tarjeta impugna el cargo ante su banco | El `Payment` se marca con un indicador de disputa activa en `metadata` (no se cambia `status` todavía: la disputa puede resolverse a favor del negocio) | Ninguno inmediato (se espera resolución) | Ninguno inmediato |
| `charge.dispute.closed` (con `evidence_details.status: lost`) | El banco resuelve la disputa en contra del negocio | `Payment.status → REFUNDED` (el dinero se pierde igual que en un reembolso) | Igual que `charge.refunded` total | Igual que `charge.refunded` total |
| `charge.dispute.closed` (con `status: won`) | El banco resuelve la disputa a favor del negocio | Se limpia el indicador de disputa en `metadata`; `Payment.status` vuelve a `PAID` | Sin cambios | Sin cambios |

> Nota de alcance: `charge.dispute.*` se maneja de forma informativa/administrativa (alertas), no se automatiza ninguna respuesta a la disputa (subir evidencia) — eso permanece como acción manual del admin en el Dashboard de Stripe, tal como indica la guía de seguridad de Stripe (nunca automatizar decisiones financieras sensibles sin revisión humana).

### 2.2. Suscripción del webhook en el Dashboard de Stripe

El endpoint (`https://<dominio>/api/stripe/webhook`) debe tener suscritos, además de `checkout.session.completed`, los siguientes eventos:

- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Esto se configura en Dashboard → Developers → Webhooks → (endpoint existente) → "Listen to" / o vía Stripe CLI en desarrollo (`stripe listen --events checkout.session.completed,checkout.session.expired,payment_intent.payment_failed,charge.refunded,charge.dispute.created,charge.dispute.closed`).

### 2.3. Idempotencia y reintentos de Stripe

Stripe puede reenviar el mismo evento varias veces (mismo `event.id`) si el endpoint no responde `2xx` a tiempo, o incluso en casos excepcionales de entrega duplicada garantizada "at-least-once". El endpoint actual no tiene ningún mecanismo de deduplicación por `event.id`; solo confía en `upsert` por `stripeCheckoutSessionId`, lo cual protege parcialmente `checkout.session.completed` pero **no** protege las nuevas ramas (p. ej. reenviar `charge.refunded` dos veces reintentaría revocar un `CourseAccess` ya revocado, o reenviaría el email de alerta al admin dos veces).

Estrategia a aplicar:

- **Nuevo modelo `WebhookEvent` en Prisma** (o tabla equivalente) que registre `stripeEventId` (único), `type`, `receivedAt` y `processedAt`. Al inicio del handler, antes de procesar la lógica de negocio, se verifica si el `event.id` ya fue procesado; si existe con `processedAt` no nulo, se responde `200 OK` inmediatamente sin repetir efectos secundarios (no se reenvían emails ni se duplican notificaciones).
- Alternativa más ligera (si se prefiere no agregar tabla nueva): usar los campos ya existentes de `Payment` como guarda de idempotencia por transición de estado — por ejemplo, no reenviar el email de reembolso si `Payment.status` ya es `REFUNDED` (comparar estado actual vs. estado destino antes de actuar). Esto cubre el caso más común pero es menos robusto que un registro explícito de eventos, porque no protege operaciones que no cambian de estado (p. ej. un segundo `charge.dispute.created` sobre el mismo cargo).
- Se recomienda la opción del modelo `WebhookEvent` por ser el patrón estándar sugerido por Stripe para "event deduplication" y por dejar rastro auditable de qué se procesó y cuándo (útil para soporte y para depurar incidentes de pago).
- Todas las transiciones de `Payment.status` deben ser **idempotentes por diseño**: usar `updateMany`/`upsert` condicionados al estado actual (p. ej. no revertir un `REFUNDED` a `PAID` si llega un evento fuera de orden) en vez de sobrescribir ciegamente.
- El handler debe seguir respondiendo `200 OK` en menos de lo que Stripe considera timeout, incluso si alguna notificación (email/in-app) falla — igual que ya hace el código actual con los `.catch()` en los envíos de correo. Los fallos de notificación nunca deben provocar que Stripe reintente el evento completo (evitar reprocesar side-effects que sí funcionaron).

### 2.4. Modelos de datos afectados

- **`Payment`** (`prisma/schema.prisma`): no requiere cambios de enum (`FAILED`, `REFUNDED`, `CANCELED` ya existen). Se usará el campo `metadata` (Json) ya existente para guardar detalles de fallo (`failureReason`), de disputa (`disputeId`, `disputeStatus`, `disputeDueBy`) y de reembolso parcial (`refundedAmountCents`), evitando así agregar columnas nuevas para datos que no requieren consulta indexada.
- **`WebhookEvent`** (nuevo modelo, ver 2.3): `id`, `stripeEventId` (`@unique`), `type`, `receivedAt`, `processedAt`, `payload` (Json, opcional para debugging).
- **`Appointment`**: se reutiliza `AppointmentStatus.CANCELLED` (ya existe en el enum). No requiere cambios de schema.
- **`CourseAccess`**: el modelo actual no tiene campo de estado (`status`/`revokedAt`); una fila implica acceso activo. Para poder "revocar" sin perder trazabilidad de que hubo una compra, se debe decidir entre:
  1. Eliminar la fila (`db.courseAccess.delete`) — más simple, consistente con el resto del código actual (que no tiene soft-delete en este modelo), pero pierde el historial de que el alumno alguna vez tuvo acceso.
  2. Agregar un campo `revokedAt DateTime?` al modelo `CourseAccess` — preserva historial y es auditable, pero exige actualizar todas las consultas que listan cursos activos del alumno para filtrar `revokedAt: null`.
  - **Recomendación de este spec**: opción 2 (`revokedAt`), por consistencia con el patrón de auditoría ya usado en `Payment` (createdAt/updatedAt) y porque `CourseAccess` ya se usa en reportes de conversión/analítica donde perder el registro histórico sería una regresión. Esta decisión debe confirmarse con el Designer/Task Planner antes de implementar, ya que implica una migración de schema y tocar las queries de `CourseService` que consultan `courseAccess`.
- **Consideraciones de MCP o bases de datos externas**: no aplica; toda la lógica vive en la base de datos Postgres (Neon) vía Prisma, sin dependencias externas nuevas más allá de la propia API de Stripe (ya integrada).

### 2.5. Notificaciones (consistencia con `src/lib/mail.ts` y `NotificationService`)

El proyecto ya sigue el patrón: email vía funciones dedicadas en `src/lib/mail.ts` (p. ej. `sendPaymentReceiptEmail`, `sendAppointmentConfirmationEmail`, `sendAdminAlertEmail`) + notificación in-app vía `NotificationService.createNotification` / `NotificationService.notifyAllAdmins`. Los nuevos casos deben seguir el mismo patrón, sin introducir un canal nuevo:

| Evento | Notificación a cliente | Notificación a admin/staff |
|---|---|---|
| `checkout.session.expired` | Ninguna obligatoria (opcional: recordatorio, fuera de alcance de este spec) | Ninguna |
| `payment_intent.payment_failed` | Email nuevo tipo "recibo/alerta" reutilizando el estilo de `sendPaymentReceiptEmail`/`sendAdminAlertEmail` (nueva función, p. ej. `sendPaymentFailedEmail`, a definir en tareas) informando que el pago no se completó y cómo reintentar | `NotificationService.notifyAllAdmins` con `type: "PAYMENT"` informativo (no urgente) |
| `charge.refunded` (total, cita) | Email al cliente confirmando el reembolso y la cancelación de la cita (nueva función en `mail.ts`, p. ej. `sendAppointmentCancelledEmail` o extender `sendAppointmentNotificationEmail`) | `sendAdminAlertEmail` (patrón ya usado para "curso adquirido") + `NotificationService.notifyAllAdmins` |
| `charge.refunded` (total, curso) | Notificación in-app al alumno (`NotificationService.createNotification`, `type: "PAYMENT"`) informando que su acceso fue revocado | `sendAdminAlertEmail` + `NotificationService.notifyAllAdmins` |
| `charge.dispute.created` | Ninguna al cliente (el proceso de disputa es entre Stripe/banco y el negocio) | **Alerta urgente**: `sendAdminAlertEmail` con asunto destacando "Disputa de pago" y fila con `evidence_details.due_by`, más `NotificationService.notifyAllAdmins` con `type: "DISPUTE"` |
| `charge.dispute.closed` (lost) | Igual que reembolso total (cita o curso) | `sendAdminAlertEmail` informando resultado desfavorable de la disputa |
| `charge.dispute.closed` (won) | Ninguna | `NotificationService.notifyAllAdmins` informativo, sin urgencia |

Todas las llamadas a email/notificación deben mantenerse con `.catch()` no bloqueante, tal como el código actual, para que un fallo de envío no impida responder `200 OK` a Stripe.

## 3. Lista de Tareas (Task Planner)

- [ ] **Tarea 1**: Agregar al Dashboard de Stripe (y a la config de `stripe listen` en desarrollo/CI) la suscripción a los eventos `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed` en el endpoint del webhook existente.
- [ ] **Tarea 2**: Crear migración de Prisma para el nuevo modelo `WebhookEvent` (`stripeEventId` único, `type`, `receivedAt`, `processedAt`, `payload` Json opcional) y aplicarla contra Neon.
- [ ] **Tarea 3**: Decidir e implementar (con aprobación del Designer) la estrategia de revocación de `CourseAccess`: agregar campo `revokedAt DateTime?` al modelo (migración) y actualizar las queries de `CourseService`/vistas de alumno que listan accesos activos para filtrar por `revokedAt: null`.
- [ ] **Tarea 4**: En `route.ts`, al inicio del handler (tras verificar la firma), consultar/crear el registro en `WebhookEvent` por `event.id`; si ya tiene `processedAt`, responder `200 OK` de inmediato sin re-ejecutar efectos secundarios.
- [ ] **Tarea 5**: Implementar el handler de `checkout.session.expired`: si existe `Payment` por `stripeCheckoutSessionId` en estado `REQUIRES_PAYMENT`, actualizarlo a `CANCELED`; si el `type` es `APPOINTMENT`, cancelar la `Appointment` asociada (`status: CANCELLED`) y liberar el horario.
- [ ] **Tarea 6**: Implementar el handler de `payment_intent.payment_failed`: upsert de `Payment` por `stripePaymentIntentId` a `status: FAILED`, guardando `last_payment_error` en `metadata`; disparar notificación in-app a admins.
- [ ] **Tarea 7**: Crear la función `sendPaymentFailedEmail` en `src/lib/mail.ts` siguiendo el patrón visual/estructural de `sendPaymentReceiptEmail`, e integrarla en el handler de la Tarea 6.
- [ ] **Tarea 8**: Implementar el handler de `charge.refunded`: localizar el `Payment` por `stripeChargeId`/`stripePaymentIntentId`; si el reembolso es total, transicionar `status → REFUNDED`; si es parcial, mantener `status` y registrar `refundedAmountCents` en `metadata`.
- [ ] **Tarea 9**: Dentro del handler de reembolso total, si `Payment.type === "APPOINTMENT"`, cancelar la `Appointment` asociada y notificar al cliente y al staff/admin (reutilizando/extender `sendAppointmentNotificationEmail` o creando `sendAppointmentCancelledEmail`).
- [ ] **Tarea 10**: Dentro del handler de reembolso total, si `Payment.type === "COURSE"`, revocar el `CourseAccess` del `payerId` para ese `courseId` (usando el campo `revokedAt` de la Tarea 3) y notificar al alumno vía `NotificationService.createNotification`.
- [ ] **Tarea 11**: Implementar el handler de `charge.dispute.created`: marcar `metadata.disputeId`/`disputeStatus`/`disputeDueBy` en el `Payment` afectado y enviar alerta urgente a admins (`sendAdminAlertEmail` + `NotificationService.notifyAllAdmins` con `type: "DISPUTE"`).
- [ ] **Tarea 12**: Implementar el handler de `charge.dispute.closed`: si `status: lost`, reutilizar la lógica de reembolso total (Tareas 8-10); si `status: won`, limpiar el indicador de disputa en `metadata` y notificar a admins sin urgencia.
- [ ] **Tarea 13**: Tras procesar cada evento, marcar `WebhookEvent.processedAt = now()` para cerrar el ciclo de idempotencia.
- [ ] **Tarea 14**: Añadir pruebas (unitarias/integración, según convención en `/tests` del proyecto) que simulen: evento duplicado (mismo `event.id` dos veces), `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded` total y parcial (cita y curso), y `charge.dispute.created`/`closed` en ambos resultados.
- [ ] **Tarea 15**: Actualizar cualquier dashboard/reporte de admin que liste pagos o accesos de curso para reflejar los nuevos estados (`FAILED`, `REFUNDED`, `CANCELED`) y el campo `revokedAt` de `CourseAccess`, si dichas vistas ya filtran por estado.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/stripe-webhook-lifecycle`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
