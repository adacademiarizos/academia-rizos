# Matriz de notificaciones por rol

## Política de canales

La plataforma usa notificaciones **in-app** para eventos accionables. El correo
se reserva para pagos, citas, seguridad y otros eventos urgentes. No se usan
push, SMS ni WhatsApp.

Los eventos transaccionales, de seguridad y de revisión académica son
obligatorios. Las personas solo pueden desactivar categorías opcionales:
actualizaciones de cursos, comunidad y logros.

## Cobertura implementada

| Rol o audiencia | P0 — crítico | P1 — operación fiable | P2 — experiencia |
| --- | --- | --- | --- |
| ADMIN | Entregas de test/examen pendientes, una alerta por cita pagada y finalización tras certificado | Fallos, reembolsos y disputas; certificados pendientes; agotamiento de entrega | Preferencias, enlaces accionables y base para digest/alertas analíticas posteriores |
| STAFF | Solicitud AUTHORIZE, cita pagada, cambio/cancelación/no-show de su cita y cobro de su link | Recordatorios de su agenda a 24 h y 2 h; pago fallido, reembolso o expiración de su link | Enlaces directos a su agenda y preferencias opcionales |
| STUDENT | Acuse persistente de entrega, resultado de revisión y finalización una vez emitido el certificado | Acceso concedido/revocado, vencimiento a 7 días/24 horas/vencido, pago fallido o reembolso | Actualizaciones publicadas explícitamente, logros y comunidad dirigida |
| Cliente invitado | — | Confirmación, recibo, cancelación/reprogramación/no-show y recordatorios de cita por correo | — |
| Comunidad | — | — | Solo menciones y respuestas directas in-app |

Todos los ADMIN reciben alertas operativas mientras no exista asignación
individual de revisores. Las alertas de una cita pagada se emiten una sola vez
para cada administrador y no se duplican con el aviso genérico de pago.

No se generan avisos unitarios por likes, ediciones rutinarias de FAQ,
landing o testimonios, analítica/pageviews ni CRUD ordinario de precios,
servicios u horarios. Un cambio operativo se comunica únicamente cuando
afecta una cita futura.

## Eventos y destinatarios

Los productores de negocio usan `NotificationEventService`; no eligen canales
ni resuelven destinatarios. Esta capa traduce hechos del dominio al catálogo
tipado de `eventKey` y usa `Appointment.staffId` o `PaymentLink.createdById`
para localizar al responsable correcto.

| Familia | Eventos principales | Destinatarios |
| --- | --- | --- |
| Citas | `appointment.requested`, `appointment.paid`, `appointment.status_changed`, recordatorios | STAFF asignado; cliente con cuenta in-app/correo; cliente invitado por correo; ADMIN en cita pagada, cancelación o no-show |
| Pagos | recibo, fallo, reembolso, disputa, ciclo de link | Pagador/cliente, creador del link y ADMIN para excepciones; un pago normal de link no alerta a ADMIN |
| Academia | entrega recibida/pendiente de revisión, revisión, certificado pendiente/emitido/revocado, curso completado | STUDENT y todos los ADMIN según corresponda; completar un módulo no completa el curso |
| Acceso | concedido, revocado, por vencer o vencido | STUDENT con acceso afectado |
| Cuenta y soporte | registro, cambio de rol, reporte de bug/acuse | Usuario afectado y ADMIN operativo |
| Logros | `achievement.earned` | Solo STUDENT que obtuvo el logro y solo si mantiene activa esa preferencia |
| Comunidad | mención/respuesta de curso, módulo o chat | Solo usuario mencionado o autor de la publicación respondida |

Una mención debe usar el token explícito `@[Nombre](userId)`. Antes de avisar,
se verifica que el destinatario pertenezca al mismo recurso o sala y conserve
acceso activo. Los enlaces llevan al comentario o mensaje concreto.

## Modelo y compatibilidad

`Notification` conserva `type` y `relatedId` para clientes existentes y suma,
cuando existen, `eventKey`, `dedupeKey`, recurso, `actionUrl`, prioridad y
`readAt`. `GET /api/notifications` no añade campos vacíos a filas antiguas;
los consumidores actuales siguen recibiendo su forma previa.

`NotificationDelivery` es la outbox persistente por destinatario y canal.
Incluye estado, fecha programada, bloqueo, número de intentos, error y marcas
de envío. Las claves de deduplicación se amplían por usuario para in-app y por
hash de correo para email, por lo que los reintentos de Stripe o Cron no
producen duplicados.

```text
evento de negocio
  -> NotificationEventService
  -> dispatchNotification(eventKey, recipients, resource, actionUrl, ...)
  -> Notification (in-app inmediato) + NotificationDelivery (outbox)
  -> /api/cron/notifications cada 15 min
  -> envío de correo o materialización in-app programada
```

El fallo de una entrega nunca revierte un pago, una reserva ni una revisión.
La outbox intenta el envío inicial y hasta tres reintentos con backoff de
15 minutos, 1 hora y 4 horas. Al agotar los intentos se conserva el error y
se crea una alerta para ADMIN.

Los recibos también usan esta outbox. El cron histórico de recibos solo
encola el mismo evento idempotente para pagos anteriores; no envía correo
directamente. `receiptEmailSentAt` conserva compatibilidad como marca de que
la entrega ya fue encolada, mientras `NotificationDelivery` es la fuente de
verdad para el resultado del envío.

## Programación y operación

Vercel Cron invoca `GET /api/cron/notifications` cada 15 minutos mediante
`Authorization: Bearer CRON_SECRET`. El job programa recordatorios de citas
confirmadas a 24 h y 2 h, y los hitos de acceso académico a 7 días, 24 horas y
vencimiento. Los recordatorios se cancelan ante cancelación, no-show o cierre
de una cita, y cuando se renueva o revoca el acceso.

Para ponerlo en producción, configurar `CRON_SECRET` y aplicar las migraciones
de Prisma, incluidas:

- `20260809170000_add_notification_delivery_outbox`
- `20260809180000_add_notification_preferences`

La interfaz de preferencias es `GET`/`PATCH /api/notification-preferences`;
solo expone categorías no transaccionales.

## Pruebas de regresión

Las pruebas focalizadas cubren:

- Matriz de destinatarios para AUTHORIZE/FULL/DEPOSIT, cita pagada, cambios de
  estado, links, Stripe repetido, fallos, reembolsos y disputas.
- Entregas modernas de test/examen, revalidación y finalización solo mediante
  certificado.
- Programación, deduplicación, reintentos, agotamiento y cron de la outbox.
- Cliente invitado, aislamiento entre usuarios, enlaces accionables,
  compatibilidad del API de notificaciones y preferencias.
- Menciones/respuestas de comunidad sin broadcast ni likes.
