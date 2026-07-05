# Especificación: Corrección de Condición de Carrera en Reservas (Doble Booking)

## 1. Requerimientos de Usuario (Spec Writer)

### Historia de usuario
Como negocio, quiero que dos clientes nunca puedan reservar el mismo horario con el mismo profesional, incluso bajo solicitudes simultáneas, para evitar conflictos de agenda.

### Contexto del problema
En `src/app/api/bookings/draft/route.ts` (líneas ~88-104), la validación de disponibilidad se implementa como:

1. Un `findFirst` que busca una `Appointment` con el mismo `staffId` y `startAt` exacto, en estado `PENDING` o `CONFIRMED`.
2. Si no encuentra nada, un `create` posterior que inserta la nueva cita.

El propio código lo admite en su comentario: `// evitar doble booking (simple)`. Esto presenta dos fallos independientes:

- **Condición de carrera (TOCTOU — Time Of Check to Time Of Use):** el `findFirst` y el `create` no están envueltos en una transacción con aislamiento adecuado ni protegidos por una restricción única a nivel de base de datos. Dos requests concurrentes para el mismo `staffId` + `startAt` pueden ambas pasar el `findFirst` (porque ninguna ha hecho aún el `create`) y ambas ejecutar el `create`, generando dos citas activas para el mismo profesional en el mismo horario.
- **Detección incompleta por igualdad exacta de `startAt`:** la comparación solo detecta colisión cuando el `startAt` de ambas citas coincide exactamente. No se comparan rangos `[startAt, endAt)`. Ejemplo: una cita de 90 minutos a las 10:00 (bloquea hasta las 11:30) no es detectada como conflicto frente a una segunda cita de 30 minutos que arranca a las 10:30, aunque ambas se solapan en el tiempo real y comparten el mismo `staffId`.

### Criterios de aceptación
- [ ] Dado que dos solicitudes de reserva llegan simultáneamente (o dentro de una ventana de milisegundos) para el mismo `staffId` y un rango horario que se solapa, el sistema garantiza que **como máximo una** de ellas resulte en una `Appointment` con estado `PENDING` o `CONFIRMED`. La otra debe fallar de forma controlada, sin crear una cita huérfana ni un registro de pago asociado a una cita inválida.
- [ ] La detección de conflicto se basa en el **solapamiento de rangos de tiempo** `[startAt, endAt)` por `staffId`, no en la igualdad exacta de `startAt`. Dos citas se consideran en conflicto si `nuevo.startAt < existente.endAt AND nuevo.endAt > existente.startAt`.
- [ ] Solo se consideran citas en estado `PENDING` o `CONFIRMED` como bloqueantes (`CANCELLED`, `NO_SHOW`, `COMPLETED` no deben impedir una nueva reserva sobre ese horario).
- [ ] La garantía de exclusividad se sostiene incluso ante fallos del proceso Node.js a mitad de la operación (p. ej. si el servidor se reinicia entre el `findFirst` y el `create`), porque la garantía vive en la base de datos, no solo en la capa de aplicación.
- [ ] El cliente que pierde la carrera recibe una respuesta HTTP clara y distinguible de otros errores (ver sección de UX), permitiéndole reintentar con otro horario sin fricción.
- [ ] La corrección no introduce deadlocks ni degradación perceptible de latencia en el flujo normal (sin concurrencia) de creación de citas.
- [ ] La corrección es compatible con Neon (Postgres serverless) y con el pool de conexiones usado por Prisma en este proyecto.

## 2. Diseño y Arquitectura (Designer)

### 2.1 Modelos de datos afectados
- `Appointment` (`prisma/schema.prisma`, líneas 212-238): modelo central del conflicto. Campos relevantes: `staffId`, `startAt`, `endAt`, `status` (`AppointmentStatus`: `PENDING`, `CONFIRMED`, `CANCELLED`, `NO_SHOW`, `COMPLETED`).
- `Service` / `ServiceVariant`: se usan únicamente para resolver `durationMin` (y de ahí `endAt`); no requieren cambios de esquema.
- Índice existente `@@index([staffId, startAt])`: útil para lecturas ordenadas, pero **no impide** duplicados ni detecta solapamiento de rangos.

### 2.2 Opciones evaluadas

**Opción A — Transacción `SERIALIZABLE` de Prisma envolviendo `findFirst` (con condición de rango) + `create`.**
Se ejecuta la lectura y la escritura dentro de `db.$transaction([...], { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })`. Postgres detectará el conflicto de serialización si dos transacciones concurrentes intentan escribir citas que se solapan, y una de ellas fallará con un error de serialización (`40001`) que la aplicación debe capturar y traducir a un 409.

- Ventajas: no requiere migración de esquema; usa mecanismos nativos de Prisma; la lógica de solapamiento de rangos se expresa en SQL/Prisma de forma legible.
- Desventajas: requiere reintentos explícitos en la capa de aplicación (el patrón estándar de `SERIALIZABLE` en Postgres es "detectar y reintentar"); bajo alta contención en un mismo `staffId`, puede generar varios reintentos; el nivel `SERIALIZABLE` tiene mayor coste que `READ COMMITTED`, aunque a la escala de este proyecto (reservas de un salón) es marginal.

**Opción B — Exclusion constraint a nivel de base de datos sobre rango de tiempo por `staffId` (extensión `btree_gist`).**
Se añade a nivel de migración SQL (fuera del DSL declarativo de Prisma, vía `prisma migrate` con SQL manual o un bloque `sql` en la migración) una restricción tipo:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Appointment"
  ADD COLUMN "timeRange" tstzrange
  GENERATED ALWAYS AS (tstzrange("startAt", "endAt", '[)')) STORED;

ALTER TABLE "Appointment"
  ADD CONSTRAINT "appointment_no_overlap_per_staff"
  EXCLUDE USING gist (
    "staffId" WITH =,
    "timeRange" WITH &&
  )
  WHERE (status IN ('PENDING', 'CONFIRMED'));
```

- Ventajas: la garantía de exclusividad la impone Postgres de forma absoluta e independiente de la capa de aplicación (protege incluso contra scripts, migraciones de datos, o futuras rutas de API que inserten citas sin pasar por este endpoint). Detecta solapamiento de rangos de forma nativa, sin lógica adicional en el backend.
- Desventajas: requiere la extensión `btree_gist` (hay que confirmar que Neon la permite habilitar — es una extensión estándar de PostgreSQL y Neon la soporta); Prisma no modela `EXCLUDE USING gist` de forma declarativa, por lo que la restricción debe mantenerse como SQL manual dentro de una migración (`prisma migrate dev --create-only` + edición manual, documentado en el `schema.prisma` con un comentario `// @db` explicando que la constraint vive fuera del DSL); el error que lanza Postgres al violar la exclusion constraint (`23P01`) debe mapearse explícitamente a un 409 en el `catch` del endpoint.

**Opción C — Unique constraint parcial simple sobre `(staffId, startAt)` filtrado por status.**
Únicamente resolvería el caso de igualdad exacta de `startAt`, no el solapamiento de rangos de distinta duración. Se descarta porque no cumple el criterio de aceptación de detección de solapamiento (ej. 90 min vs. 30 min desfasado).

### 2.3 Opción elegida y justificación

Se elige una **combinación pragmática de A + B**, con B como mecanismo de defensa (la garantía "dura") y A como mecanismo de UX (la validación "amable" que evita, en el caso normal, siquiera llegar a golpear la constraint):

1. **Constraint de exclusión a nivel de base de datos (Opción B)** es la garantía de última línea: es la única que sostiene el criterio de aceptación "la garantía vive en la base de datos, no solo en la capa de aplicación" y protege contra cualquier vía de escritura futura (jobs, scripts de datos, otros endpoints). Es el mecanismo recomendado para este stack porque Postgres soporta `EXCLUDE` de forma nativa y eficiente, y Neon permite extensiones estándar como `btree_gist`.
2. **Validación previa dentro de una transacción (variante simplificada de la Opción A, sin necesidad de `SERIALIZABLE` pleno)**: antes del `create`, se sigue haciendo una lectura de solapamiento por rango (`startAt < endAt_nuevo AND endAt > startAt_nuevo`) dentro de la misma transacción que el `create`, usando el nivel de aislamiento por defecto de Prisma (`READ COMMITTED`) más un `SELECT ... FOR UPDATE`-like sobre las filas relevantes (Prisma no expone `FOR UPDATE` directamente, así que se aplica mediante `$queryRaw` acotado a esa transacción, o se confía en que la constraint de BD actúe como red de seguridad). Esto permite devolver, en el caso común (sin carrera real), un mensaje de negocio limpio (`TAKEN`) en vez de forzar siempre a interpretar un error crudo de Postgres.
3. El `catch` del endpoint se amplía para reconocer el código de error de Postgres `23P01` (exclusion violation) —vía `Prisma.PrismaClientKnownRequestError` con `code "P2010"` (raw query fallida) o inspeccionando `err.meta`/`err.message`— y traducirlo al mismo contrato de error `{ code: "TAKEN", message: "..." }` con status 409, de modo que el frontend no necesite distinguir entre "lo detectamos en la pre-validación" o "lo bloqueó la base de datos en el último instante".

Se descarta usar `SERIALIZABLE` puro en todas las transacciones de reserva porque añade complejidad de reintentos para un beneficio que la exclusion constraint ya cubre de forma más barata y explícita; se reserva `SERIALIZABLE`/reintentos solo si en el futuro se detectan colisiones de serialización no cubiertas por la constraint (por ejemplo, si se añaden reglas de negocio adicionales que dependan de lecturas más amplias que un solo rango por `staffId`).

### 2.4 Detección de solapamiento de rangos

Dado un nuevo intento de reserva con `staffId`, `startAt` y `resolvedDuration` (ya calculado hoy en el endpoint a partir de `Service.durationMin` o `ServiceVariant.durationMin`), se calcula `endAt = startAt + resolvedDuration minutos` (esto ya ocurre en el código actual, línea ~80).

La condición de solapamiento entre el nuevo rango `[startAt, endAt)` y cualquier cita existente `[e.startAt, e.endAt)` del mismo `staffId` es:

```
startAt < e.endAt  AND  endAt > e.startAt
```

Traducido a Prisma (para la pre-validación dentro de la transacción):

```ts
const overlapping = await tx.appointment.findFirst({
  where: {
    staffId,
    status: { in: ["PENDING", "CONFIRMED"] },
    startAt: { lt: end },   // e.startAt < nuevo.endAt
    endAt: { gt: start },   // e.endAt   > nuevo.startAt
  },
  select: { id: true },
});
```

Este reemplaza la condición actual `startAt: start` (igualdad exacta) por la comparación de rango, cubriendo el caso de servicios de distinta duración que se solapan parcialmente.

A nivel de base de datos, el mismo criterio se expresa mediante el operador `&&` de rangos (`tstzrange`) dentro de la exclusion constraint descrita en 2.2-B, que es equivalente matemáticamente a la condición anterior pero evaluado de forma atómica por el motor de Postgres.

### 2.5 Consideraciones de MCP o bases de datos externas
- No aplica un servidor MCP para esta feature; es un cambio de esquema/lógica interno sobre Prisma + Neon.
- Se debe verificar en el plan de Neon del proyecto que la extensión `btree_gist` esté disponible (es parte del conjunto estándar de extensiones soportadas por Neon; no requiere plan superior, pero sí un `CREATE EXTENSION` ejecutado con permisos suficientes, normalmente ya disponibles para el rol de la base de datos gestionada por Neon).
- La migración que añade la columna generada `timeRange` y la exclusion constraint debe ser versionada igual que cualquier otra migración de Prisma (regla de negocio ya establecida en `context.md`: "todo cambio de esquema pasa por migración versionada").

### 2.6 Consideraciones de UX

- El cliente que **gana** la carrera recibe la respuesta 200 actual con `appointmentId` y continúa el flujo normal (pago, confirmación).
- El cliente que **pierde** la carrera —ya sea detectado en la pre-validación o rechazado por la constraint de base de datos en el último instante— debe recibir:
  - **Status HTTP 409 Conflict** (ya es el código usado hoy para el caso `TAKEN`, se mantiene por consistencia).
  - **Cuerpo de error uniforme**: `{ ok: false, error: { code: "TAKEN", message: "Ese horario ya no está disponible" } }` (mismo contrato ya existente, para no romper al frontend actual).
  - El frontend (wizard de reserva) debe interpretar este código para: (a) refrescar automáticamente la disponibilidad del profesional/servicio seleccionado, y (b) invitar al usuario a elegir otro horario, en vez de mostrar un error genérico de "algo salió mal". Esto ya podría estar parcialmente resuelto en el cliente actual dado que el código `TAKEN` ya existe; se debe confirmar que el manejo de errores del wizard trata este código de forma amigable y no como un error 500 genérico.
  - No se debe exponer al usuario final ningún detalle técnico de Postgres (nombre de constraint, SQLSTATE, etc.); esos detalles solo van a los logs del servidor (`console.error`) para diagnóstico.

## 3. Lista de Tareas (Task Planner)

- [ ] Tarea 1: Confirmar en el proyecto Neon que la extensión `btree_gist` puede habilitarse con el rol de base de datos usado por Prisma (`CREATE EXTENSION IF NOT EXISTS btree_gist;`), documentando el resultado en el PR de la migración.
- [ ] Tarea 2: Crear una migración de Prisma (`prisma migrate dev --create-only`) que añada: (a) la columna generada `timeRange tstzrange` sobre `Appointment` a partir de `startAt`/`endAt`, y (b) la exclusion constraint `appointment_no_overlap_per_staff` (`EXCLUDE USING gist (staffId WITH =, timeRange WITH &&) WHERE (status IN ('PENDING','CONFIRMED'))`), editando manualmente el SQL generado ya que Prisma no soporta `EXCLUDE` de forma declarativa.
- [ ] Tarea 3: Documentar en `prisma/schema.prisma` (comentario junto al modelo `Appointment`) la existencia de la exclusion constraint gestionada fuera del DSL, para que futuras ediciones del esquema no la eliminen accidentalmente al regenerar migraciones.
- [ ] Tarea 4: Reemplazar en `src/app/api/bookings/draft/route.ts` la validación actual (`findFirst` por `startAt` exacto) por una validación de solapamiento de rango (`startAt: { lt: end }, endAt: { gt: start }`) ejecutada dentro de una transacción Prisma (`db.$transaction`) junto con el `create` de la cita.
- [ ] Tarea 5: Añadir manejo explícito, en el bloque `catch` del endpoint, del error de violación de exclusion constraint de Postgres (SQLSTATE `23P01`), traduciéndolo al mismo contrato de respuesta `{ code: "TAKEN", ... }` con status 409 usado por la pre-validación.
- [ ] Tarea 6: Revisar si existen otras rutas de escritura de `Appointment` en el proyecto (por ejemplo, creación manual de citas desde el dashboard admin/staff) y confirmar que también quedan protegidas por la exclusion constraint de base de datos (no requieren cambio de código si solo dependen de la constraint, pero si tienen su propia lógica de "doble booking" en aplicación, deben alinearse con el mismo manejo de error de la Tarea 5).
- [ ] Tarea 7: Escribir tests de integración que simulen dos requests concurrentes al endpoint `POST /api/bookings/draft` con: (a) mismo `startAt` exacto, mismo `staffId`; (b) rangos solapados con distinta duración (90 min vs. 30 min desfasado); y (c) rangos no solapados para confirmar que no se bloquean falsos positivos. Verificar que en (a) y (b) solo una request resulta en `ok: true` y la otra en 409 `TAKEN`.
- [ ] Tarea 8: Verificar manualmente (o con test) que citas en estado `CANCELLED`, `NO_SHOW` o `COMPLETED` no bloquean la creación de una nueva cita sobre el mismo rango horario, confirmando que la cláusula `WHERE (status IN ('PENDING','CONFIRMED'))` de la constraint y el filtro `status: { in: [...] }` de la pre-validación están alineados.
- [ ] Tarea 9: Confirmar contra la suite de `/tests` que no se introducen regresiones en el flujo normal de creación de citas (caso sin concurrencia) antes de solicitar Merge a `dev`.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/booking-race-condition-fix`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
