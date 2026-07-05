# Especificación: Cumplimiento RGPD — Borrado de Cuenta y Retención de Datos de Invitados

> **Nota de alcance legal:** este documento es una propuesta técnica razonable para un MVP que opera en España/UE, no asesoría legal certificada. Antes de publicar una política de privacidad definitiva o de operar con datos reales de clientes, el negocio debe validar los plazos y excepciones aquí propuestos con un asesor legal/DPO, especialmente en lo relativo a obligaciones fiscales y contables (Ley General Tributaria, plazo de conservación de facturas de 4-6 años en España).

## 1. Requerimientos de Usuario (Spec Writer)

**Historia de usuario:**
Como usuario (cliente o alumno) de la plataforma, quiero poder solicitar el borrado de mis datos personales, para ejercer mi derecho al olvido bajo el RGPD. Como negocio, quiero cumplir con el RGPD respecto a los datos de clientes invitados (reservas sin cuenta) que hoy se conservan indefinidamente, para reducir el riesgo legal y no almacenar PII más tiempo del necesario.

**Contexto del problema (gap actual, ya auditado):**
- `prisma/schema.prisma` almacena PII en varios modelos: `User` (`email`, `name`, `image`, `password`), `Appointment` (`customerName`, `customerEmail`, `customerPhone` para clientes sin cuenta, vía `customerId` opcional), `Payment` (`payerEmail`, `receiptToEmail`), `ChatMessage` (`body`, `imageUrl`), `BugReport` (`imageUrls`), `Comment` (`body`), `PaymentLink` (`customerEmail`).
- **No existe ningún endpoint ni proceso** para que un usuario con cuenta solicite el borrado de su cuenta y datos ("derecho al olvido", art. 17 RGPD).
- **No existe ninguna política de retención** para los datos de clientes invitados: un `Appointment` creado sin `customerId` (cliente que reservó sin registrarse) conserva `customerName`/`customerEmail`/`customerPhone` en texto plano de forma indefinida, sin fecha de expiración ni proceso de limpieza.
- No hay ningún job (cron u otro) que purgue o anonimice datos vencidos.

**Criterios de aceptación:**
1. Un usuario autenticado (`STUDENT`, `STAFF` o `ADMIN`) puede acceder a una pantalla de su perfil donde solicitar el borrado de su cuenta y datos personales.
2. Al solicitar el borrado, el sistema pide confirmación explícita (p. ej. reintroducir contraseña o confirmar por email) para evitar borrados accidentales o maliciosos (cuenta comprometida).
3. Tras confirmar, el sistema ejecuta un proceso de anonimización/eliminación que:
   - Elimina o anonimiza los datos identificables del usuario según la tabla de retención de la sección 2.
   - Conserva los registros que la ley obliga a retener (p. ej. `Payment`, por motivos fiscales/contables), pero desvinculados de la identidad de la persona en la medida de lo posible.
   - Revoca la sesión activa del usuario y bloquea el inicio de sesión futuro con esas credenciales.
4. El usuario recibe una confirmación (en pantalla y/o por email, enviado *antes* de anonimizar el email) de que su solicitud fue procesada.
5. Un `ADMIN` puede ver en el dashboard el historial de solicitudes de borrado procesadas (auditoría mínima), sin poder revertir manualmente los datos ya anonimizados.
6. Los datos de clientes invitados (`Appointment` sin `customerId`) se anonimizan automáticamente cuando han transcurrido **24 meses** desde la última interacción relevante (la más reciente entre `startAt` de la cita y `updatedAt` del registro), mediante un job de purga programado.
7. La anonimización de un `Appointment` de invitado **no borra la fila** (se conserva por motivos históricos/contables de la relación con `Payment`), pero reemplaza `customerName`, `customerEmail` y `customerPhone` por valores anonimizados no reidentificables.
8. Las imágenes en Cloudflare R2 asociadas a datos personales borrados (mensajes de chat con `imageUrl`, `imageUrls` de `BugReport` del usuario) se eliminan del bucket como parte del proceso de borrado de cuenta, cuando ya no son necesarias para la integridad de un hilo compartido (ver sección 2).
9. El proceso es idempotente: ejecutar la purga o un borrado de cuenta dos veces sobre el mismo registro no debe fallar ni duplicar efectos.

**Fuera de alcance de este spec:**
- Exportación de datos personales en formato portable (art. 20 RGPD, derecho a la portabilidad) — se documenta como trabajo futuro relacionado, no se diseña aquí.
- Gestión de consentimiento de cookies/analítica (`PageView`, `ConversionEvent`) — se asume que esos modelos ya son pseudo-anónimos (`sessionId`, sin PII directa) y quedan fuera de este spec.
- Diseño detallado del sistema de cron jobs genérico de la plataforma (si no existe aún) — este spec solo declara una **dependencia** sobre la existencia de un mecanismo de ejecución programada (cron/Vercel Cron/queue), sin asumir su implementación.
- Revisión legal certificada de plazos fiscales exactos (se usa un plazo conservador de referencia, a validar con asesoría legal antes de producción).

## 2. Diseño y Arquitectura (Designer)

### 2.1 Política de retención — resumen por modelo

| Modelo | PII almacenada | Disparador de retención | Acción tras vencimiento / borrado solicitado |
|---|---|---|---|
| `Appointment` (invitado, `customerId = null`) | `customerName`, `customerEmail`, `customerPhone` | 24 meses desde `max(startAt, updatedAt)` sin nueva interacción | Anonimizar los 3 campos in-place (job automático). No se borra la fila. |
| `Appointment` (con cuenta, `customerId` set) | Igual, pero vinculado a `User` | Borrado de cuenta del `User` asociado | Anonimizar los 3 campos como invitado; `customerId` puede conservarse o ponerse a `null` según se decida mantener o no la FK tras anonimizar el `User`. |
| `User` | `name`, `email`, `image`, `password` | Solicitud explícita de borrado de cuenta | Anonimizar `name`, `email` (a valor único no reversible), `image = null`, `password = null`; marcar cuenta como no accesible. |
| `Payment` | `payerEmail`, `receiptToEmail` | Borrado de cuenta del `payer` asociado | **No se borra el registro** (obligación fiscal/contable). Se anonimiza `payerEmail`/`receiptToEmail` si no son ya el email de contacto fiscal del negocio; `payerId` puede pasar a `null` (relación opcional) para desvincular de la identidad, dejando el importe/fecha/estado intactos. |
| `PaymentLink` | `customerEmail` | Borrado de cuenta del cliente asociado (si coincide) | Anonimizar `customerEmail` si el link ya fue usado y no está pendiente de cobro activo. |
| `ChatMessage` | `body`, `imageUrl` | Borrado de cuenta del `user` autor | `onDelete: Cascade` ya existe en el esquema — al borrar el `User` se borrarían los mensajes. **Decisión de producto:** para no romper el hilo de conversación de un curso (contexto de otros alumnos), se prefiere anonimizar (`body = "[mensaje eliminado]"`, `imageUrl = null`) en vez de dejar el cascade borrar la fila. Esto requiere ajustar la lógica de aplicación (no depender solo del cascade de Prisma) o migrar la relación a `onDelete: SetNull`/manejo explícito. |
| `BugReport` | `imageUrls`, `title`, `description` | Borrado de cuenta del `user` autor | Igual disyuntiva: el cascade actual (`onDelete: Cascade`) borraría el reporte completo. Si se quiere conservar el reporte para el equipo de soporte, anonimizar `userId`-derivado en vez de borrar; si no aporta valor de negocio, dejar que el cascade lo elimine. Se propone **conservar y anonimizar** para no perder trazabilidad de bugs reales. |
| `Comment` | `body` | Borrado de cuenta del `user` autor | Igual que `ChatMessage`: anonimizar contenido (`body = "[comentario eliminado]"`) para no romper hilos de comunidad, en vez de depender del cascade actual. |
| `Certificate`, `Submission`, `ModuleProgress`, etc. | Ninguna PII directa (solo IDs) | N/A | Sin cambios; se conservan vinculados por `userId` aunque el `User` esté anonimizado (el `id` no cambia). |

**Regla general de diseño:** anonimizar **no es sinónimo de borrar la fila**. Se prefiere anonimizar (reemplazar campos identificables por valores no reversibles) sobre `DELETE`, salvo cuando el registro no tiene ningún valor histórico/operativo sin su PII (p. ej. un `Appointment` de invitado sin pagos asociados podría evaluarse para borrado duro, pero se opta por anonimizar siempre para mantener consistencia y simplicidad de la v1).

**Valores de anonimización propuestos (convención):**
- Email: `deleted-<id>@anon.apoteosicas.local` (determinístico por `id`, garantiza unicidad para no chocar con el `@unique` de `User.email`).
- Nombre: `"Usuario eliminado"`.
- Teléfono: `null`.
- Imagen/avatar: `null`.

### 2.2 Modelos de datos afectados

**Nuevo modelo `AccountDeletionRequest`** (auditoría de solicitudes de borrado, para trazabilidad ante una eventual reclamación o auditoría de cumplimiento):

```prisma
enum DeletionRequestStatus {
  PENDING
  CONFIRMED
  COMPLETED
  FAILED
}

model AccountDeletionRequest {
  id            String                 @id @default(cuid())
  userId        String
  requestedAt   DateTime               @default(now())
  confirmedAt   DateTime?
  completedAt   DateTime?
  status        DeletionRequestStatus  @default(PENDING)
  reason        String?                // motivo opcional indicado por el usuario
  originalEmail String?                // email original guardado solo aquí para el registro de auditoría (no en User tras anonimizar)
  errorDetail   String?                // si status = FAILED

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([status])
}
```

- `User` gana la relación inversa `deletionRequests AccountDeletionRequest[]`.
- Se conserva esta tabla de auditoría **incluso después** de anonimizar al `User`, ya que es la evidencia de que la solicitud se atendió (relevante para demostrar cumplimiento ante una autoridad de control).

**Campos nuevos en `User`:**
- `deletedAt DateTime?` — marca cuándo la cuenta fue anonimizada; si no es `null`, el login debe rechazarse y la cuenta se considera inactiva.
- (Opcional) `isAnonymized Boolean @default(false)` como bandera explícita, si se prefiere no sobrecargar semánticamente `deletedAt`.

**Campos nuevos en `Appointment`** (para soportar la purga de invitados):
- No se requieren campos nuevos: el disparador de 24 meses se calcula con `startAt`/`updatedAt` ya existentes. Opcionalmente, añadir `anonymizedAt DateTime?` para idempotencia explícita del job (evita reprocesar filas ya anonimizadas y permite auditoría de cuándo ocurrió).

### 2.3 Endpoint: solicitud de borrado de cuenta (usuarios con `User`)

`POST /api/account/delete`
- Requiere sesión activa (NextAuth). Solo el propio usuario puede solicitar el borrado de su cuenta (no un `ADMIN` en nombre de otro, al menos no en esta v1 — un `ADMIN` gestionando bajas de terceros queda fuera de alcance).
- Input: `{ confirmation: string }` — se exige reintroducir la contraseña (si la cuenta es de credenciales) o un flujo de doble confirmación por email (si la cuenta es solo Google OAuth, donde no hay contraseña que verificar).
- Lógica:
  1. Verifica la confirmación (contraseña con bcrypt, o token de confirmación enviado por email previamente vía un paso intermedio `POST /api/account/delete/request` que dispara el correo).
  2. Crea un `AccountDeletionRequest` con `status = CONFIRMED` y `originalEmail = user.email` (para el registro de auditoría, antes de anonimizar).
  3. Envía un email de confirmación final **al email original** (antes de anonimizarlo) informando que la solicitud fue procesada y qué se conservó por obligación legal (p. ej. registros de pago).
  4. Ejecuta en una transacción de Prisma:
     - Anonimiza `User` (`name`, `email`, `image`, `password` → valores de la sección 2.1) y marca `deletedAt = now()`.
     - Para cada `Appointment` donde `customerId = user.id`: anonimiza `customerName`/`customerEmail`/`customerPhone`.
     - Para cada `Payment` donde `payerId = user.id`: anonimiza `payerEmail`/`receiptToEmail`; evalúa si desvincular `payerId` a `null` (columna ya opcional en el esquema).
     - Para `ChatMessage`/`Comment`/`BugReport` del usuario: aplica la estrategia de anonimización de contenido descrita en 2.1 (en vez de dejar actuar el `onDelete: Cascade` del esquema, que borraría la fila completa).
     - Elimina de Cloudflare R2 las imágenes que ya no cumplen ninguna función compartida (ver 2.5).
     - Marca `AccountDeletionRequest.status = COMPLETED` y `completedAt = now()`.
  5. Si algún paso falla, la transacción revierte y se marca `status = FAILED` con `errorDetail`, permitiendo reintento manual desde el dashboard admin.
- Respuesta: `200 { success: true, message: "Tu cuenta y datos han sido eliminados/anonimizados" }`.
- Efecto colateral: la sesión JWT del usuario debe invalidarse en el siguiente request (mismo mecanismo de invalidación por sello de tiempo propuesto en `specs/01-password-recovery.md`, reutilizando `passwordChangedAt`/`tokenVersion` si ya existe, o comparando contra `deletedAt`).

### 2.4 Job de purga automática de invitados vencidos

- **Dependencia declarada, no asumida:** este spec asume que existe (o existirá) un mecanismo de ejecución programada en la plataforma (p. ej. Vercel Cron Jobs golpeando un endpoint protegido, o un spec futuro dedicado de "cron jobs"). Si dicho mecanismo aún no existe, su diseño debe resolverse como prerrequisito o en paralelo, fuera del alcance de este documento.
- Endpoint objetivo del cron: `POST /api/cron/gdpr-purge-guests` (protegido por un secreto compartido, p. ej. header `Authorization: Bearer <CRON_SECRET>`, patrón habitual en Vercel Cron).
- Lógica:
  1. Consulta `Appointment` donde `customerId IS NULL` y `customerEmail IS NOT NULL` (aún no anonimizado) y `max(startAt, updatedAt) < now() - 24 meses`.
  2. Para cada resultado, anonimiza `customerName`/`customerEmail`/`customerPhone` y marca `anonymizedAt = now()` (si se añade el campo).
  3. Procesa en lotes (paginación) para no bloquear la conexión a la base de datos en negocios con volumen alto de citas históricas.
  4. Registra un resumen de ejecución (cuántas filas se anonimizaron) en logs, para auditoría operativa.
- Frecuencia sugerida: ejecución diaria o semanal (no es una operación sensible al tiempo real).

### 2.5 Consideraciones sobre imágenes en Cloudflare R2

- **`ChatMessage.imageUrl`:** si se opta por anonimizar el mensaje en vez de borrarlo (ver 2.1), la imagen asociada **sí debe eliminarse de R2** aunque el registro de texto se conserve anonimizado, ya que la imagen puede contener información personal identificable (fotos del propio usuario, capturas con datos, etc.) que no se resuelve solo con anonimizar el campo `body`. Se reemplaza `imageUrl` por `null` en el mismo paso.
- **`BugReport.imageUrls`:** al anonimizar un reporte de bug conservado, evaluar si las capturas contienen PII (p. ej. pantallazos con el email del usuario visible en la UI). Por defecto, se eliminan las imágenes de R2 y se limpia el array `imageUrls`, salvo que el equipo de soporte necesite conservarlas para un bug aún abierto (requiere criterio manual/admin antes del borrado — no debe ser automático si hay un bug sin resolver).
- **Huérfanos en R2:** el borrado de referencias en base de datos no implica automáticamente el borrado del objeto en el bucket; se requiere una llamada explícita al SDK de R2 (S3-compatible) como parte de la transacción de borrado de cuenta y del job de purga. Si la llamada a R2 falla tras haber anonimizado la base de datos, debe quedar registrado (log o campo `errorDetail`) para una limpieza manual posterior — no debe bloquear ni revertir la anonimización de datos personales en base de datos, que es la prioridad de cumplimiento.
- Fuera de alcance de este spec: un job de reconciliación que detecte objetos huérfanos en R2 sin referencia en base de datos (limpieza de basura general del bucket) — se sugiere como mejora futura independiente.

## 3. Lista de Tareas (Task Planner)

- [ ] Tarea 1: Añadir el modelo `AccountDeletionRequest` (con enum `DeletionRequestStatus`) a `prisma/schema.prisma`, la relación inversa en `User`, y los campos `deletedAt DateTime?` (y opcionalmente `isAnonymized Boolean @default(false)`) en `User`. Generar y aplicar la migración de Prisma.
- [ ] Tarea 2: Añadir el campo `anonymizedAt DateTime?` al modelo `Appointment` para soportar idempotencia del job de purga de invitados. Generar y aplicar la migración correspondiente.
- [ ] Tarea 3: Definir y documentar en código (constantes compartidas, p. ej. `src/lib/gdpr.ts`) los valores de anonimización estándar (email determinístico, nombre genérico, etc.) para reutilizarlos de forma consistente en todos los flujos (borrado de cuenta, purga de invitados).
- [ ] Tarea 4: Implementar `POST /api/account/delete/request` (paso de confirmación previa para cuentas sin contraseña / verificación adicional) y `POST /api/account/delete` (ejecución del borrado), incluyendo la transacción de Prisma que anonimiza `User`, `Appointment`, `Payment`, `PaymentLink`, `ChatMessage`, `Comment` y `BugReport` asociados, según la tabla de la sección 2.1.
- [ ] Tarea 5: Modificar la lógica de aplicación para que el borrado de `ChatMessage`, `Comment` y `BugReport` de un usuario anonimizado **no** dependa del `onDelete: Cascade` actual del esquema (que borraría la fila completa), sino que anonimice el contenido en su lugar; evaluar si es necesario cambiar la relación en Prisma (p. ej. a `onDelete: SetNull` donde aplique) o si basta con anonimizar antes de cualquier operación de borrado del `User`.
- [ ] Tarea 6: Integrar el borrado de objetos en Cloudflare R2 (imágenes de `ChatMessage.imageUrl` y `BugReport.imageUrls`) dentro del flujo de borrado de cuenta, con manejo de errores no bloqueante (logging para limpieza manual si R2 falla).
- [ ] Tarea 7: Añadir el mecanismo de invalidación de sesión tras el borrado de cuenta, reutilizando o extendiendo el campo de invalidación (`passwordChangedAt`/`tokenVersion`) propuesto en `specs/01-password-recovery.md`, o comparando `deletedAt` en los callbacks `jwt`/`session` de `src/lib/auth-options.ts` para forzar cierre de sesión inmediato.
- [ ] Tarea 8: Crear la función de envío de email `sendAccountDeletionConfirmationEmail` en `src/lib/mail.ts` (enviada al email original antes de anonimizarlo), reutilizando los componentes visuales existentes (`shell`, `emailTitle`, `para`).
- [ ] Tarea 9: Crear la pantalla de perfil/ajustes de usuario con la opción "Eliminar mi cuenta", incluyendo el paso de confirmación (contraseña o email) y los mensajes de advertencia sobre qué se conserva por obligación legal.
- [ ] Tarea 10: Implementar el endpoint `POST /api/cron/gdpr-purge-guests`, protegido por secreto compartido (`CRON_SECRET` u homólogo), que anonimiza en lotes los `Appointment` de invitados vencidos (24 meses) según la lógica de la sección 2.4.
- [ ] Tarea 11 (dependencia externa, no implementar aquí): Confirmar o diseñar en un spec aparte el mecanismo de ejecución programada de la plataforma (Vercel Cron u otro) que invocará periódicamente el endpoint de la Tarea 10. Si ya existe infraestructura de cron en el proyecto, solo registrar el nuevo job en su configuración.
- [ ] Tarea 12: Añadir una vista de solo lectura en el dashboard admin (`ADMIN`) que liste `AccountDeletionRequest` (estado, fechas, email original truncado/enmascarado) para trazabilidad y auditoría de cumplimiento, sin permitir revertir anonimizaciones ya completadas.
- [ ] Tarea 13: Escribir pruebas de integración cubriendo: borrado de cuenta con credenciales, borrado de cuenta solo-Google, idempotencia del job de purga (no reprocesa filas ya anonimizadas), preservación de `Payment` tras anonimizar al `payer`, y eliminación efectiva de imágenes en R2 durante el borrado de cuenta (mockeando el SDK de R2).
- [ ] Tarea 14: Actualizar la política de privacidad pública del sitio de marketing (contenido, no código de este spec) para reflejar el nuevo plazo de retención de 24 meses para invitados y el procedimiento de solicitud de borrado de cuenta.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/gdpr-data-retention`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
