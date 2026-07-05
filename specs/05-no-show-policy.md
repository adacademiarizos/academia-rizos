# Especificación: Política Anti No-Show para Reservas con `AUTHORIZE`

## 1. Requerimientos de Usuario (Spec Writer)

### Historia de usuario
Como negocio, quiero limitar el riesgo de reservas fantasma (no-show) de clientes que abusan de citas sin pago online por adelantado, para proteger la agenda real de citas que sí generan ingreso o que bloquean a otros clientes.

### Contexto del problema
Actualmente, cualquier servicio con `billingRule = AUTHORIZE` permite reservar una cita (`Appointment`, estado inicial `PENDING`) sin ningún cobro ni garantía online: no se exige depósito, no hay límite de citas simultáneas sin pagar por cliente, y no existe penalización para clientes que ya han sido marcados `NO_SHOW` en el pasado. Esto permite que un mismo cliente (identificado por email, con o sin cuenta) reserve repetidamente y no se presente, bloqueando horarios que podrían haberse asignado a clientes reales.

### Regla de negocio propuesta
Un cliente identificado por `customerEmail` que acumule **2 o más citas con `status = NO_SHOW` en los últimos 90 días** pierde temporalmente la posibilidad de reservar servicios con `billingRule = AUTHORIZE`. En su lugar, el sistema debe:
- Si el servicio solicitado tiene `billingRule = AUTHORIZE`, forzar el flujo de pago online exigiendo como mínimo un **`DEPOSIT`** (usando el `depositPct` ya configurado en el servicio, o un porcentaje mínimo de garantía definido por configuración si el servicio no tiene `depositPct`).
- El bloqueo se reevalúa en cada intento de reserva (no es una marca permanente): si el conteo de `NO_SHOW` en los últimos 90 días vuelve a estar por debajo de 2 (por ejemplo, porque una cita antigua sale de la ventana de 90 días), el cliente recupera la opción de `AUTHORIZE` de forma automática.
- El umbral (2 no-shows), la ventana temporal (90 días) y la regla de sustitución (forzar `DEPOSIT` en vez de `AUTHORIZE`) deben ser valores centralizados y fácilmente ajustables (constantes o configuración), no cableados en múltiples lugares.

Nota de refinamiento sobre el schema: no existe una tabla de "clientes" única cuando la reserva se hace sin cuenta (`customerId` es `null`), por lo que la identidad del cliente para efectos de esta política se define exclusivamente por `Appointment.customerEmail` (normalizado a minúsculas, tal como ya se hace en `src/app/api/bookings/draft/route.ts`). Si en el futuro el cliente crea una cuenta, el historial de no-shows debería poder unificarse por `customerId` además de por email, pero eso queda fuera de este spec (ver sección de fuera de alcance).

### Criterios de aceptación
- [ ] Dado un email con 0 o 1 citas `NO_SHOW` en los últimos 90 días, al reservar un servicio `AUTHORIZE` el flujo continúa sin cambios (comportamiento actual).
- [ ] Dado un email con 2 o más citas `NO_SHOW` en los últimos 90 días, al intentar reservar un servicio `AUTHORIZE`, la API de creación de la cita responde indicando que se requiere pago adelantado (`DEPOSIT`) en lugar de permitir `AUTHORIZE` directo.
- [ ] El conteo de no-shows solo contempla citas cuyo `customerEmail` (normalizado) coincida exactamente y cuya `startAt` esté dentro de los últimos 90 días respecto al momento de la nueva reserva.
- [ ] Si el servicio solicitado ya tiene `billingRule = FULL` o `DEPOSIT`, la política no tiene ningún efecto (no hay downgrade adicional).
- [ ] El resultado del chequeo se puede auditar: debe quedar claro en logs o en la respuesta de la API por qué se forzó el depósito (para soporte al cliente y al staff).
- [ ] La política no bloquea permanentemente al cliente: es una condición reevaluada en cada solicitud de reserva, basada en una ventana móvil de 90 días.

### Fuera de alcance (explícito para este spec)
- Unificación de historial de no-shows entre email y `customerId` cuando el cliente tiene múltiples emails o crea una cuenta después de reservar como invitado.
- Lista negra permanente o expulsión total del sistema de reservas.
- Notificación proactiva al cliente explicando por qué perdió `AUTHORIZE` fuera del propio flujo de reserva (p. ej. email informativo aparte).
- Cambios a la lógica de marcado de `NO_SHOW` en el dashboard (se asume que ya existe y funciona).

## 2. Diseño y Arquitectura (Designer)

### Modelos de datos afectados
No se requieren cambios de esquema (sin nuevas columnas ni migraciones). La política se implementa como una **consulta agregada en tiempo de reserva** sobre los modelos existentes:

- `Appointment.customerEmail` — clave de identidad del cliente sin cuenta.
- `Appointment.status` — se filtra por `NO_SHOW`.
- `Appointment.startAt` — se usa para acotar la ventana de 90 días (se recomienda usar `startAt`, la fecha de la cita, no `createdAt`, ya que representa el momento en que el cliente efectivamente faltó).
- `Service.billingRule` y `Service.depositPct` — se leen para decidir si aplica el downgrade y con qué porcentaje de depósito.

Se evalúa deliberadamente **no** añadir una columna tipo `noShowCount` en un modelo de "cliente", porque:
1. No existe un modelo `Customer` unificado; el dato vive disperso en `Appointment`.
2. Una columna acumulada requeriría lógica de sincronización adicional (incrementar/decrementar al marcar o desmarcar `NO_SHOW`, expiración por ventana de 90 días) que introduce más superficie de bugs que un `count()` calculado al vuelo.
3. El volumen esperado de citas por cliente es bajo, por lo que un `COUNT` indexado es barato.

### Consulta agregada propuesta (descripción funcional, no código)
Al recibir una solicitud de reserva en `POST /api/bookings/draft`, si `service.billingRule === "AUTHORIZE"`:
1. Normalizar el email del cliente entrante (`toLowerCase()`, igual que ya se hace).
2. Contar registros de `Appointment` donde:
   - `customerEmail` = email normalizado.
   - `status` = `NO_SHOW`.
   - `startAt >= (ahora - 90 días)`.
3. Si el conteo es `>= 2`, tratar la reserva como si el servicio tuviera `billingRule = DEPOSIT` en lugar de `AUTHORIZE` para el resto del flujo (cálculo de importe a cobrar, redirección a Stripe Checkout, etc.), en vez de continuar por el camino de "cobro en persona / notificar y ya".
4. Registrar en el log del servidor (o en un campo de auditoría ligero, ver Tareas) que se aplicó el downgrade y por qué (email + conteo de no-shows), para trazabilidad de soporte.

### Índices recomendados
El modelo `Appointment` ya tiene `@@index([customerId, startAt])`, pero **no** existe índice sobre `customerEmail`. Dado que la consulta de esta política filtra por `customerEmail` + `status` + `startAt`, se recomienda añadir un índice compuesto `@@index([customerEmail, status, startAt])` para que el conteo sea eficiente incluso cuando la tabla de citas crezca. Esto sí implica una migración de Prisma (solo índice, sin cambio de forma de datos).

### Dónde se aplica la validación
Punto único de aplicación: `src/app/api/bookings/draft/route.ts`, específicamente:
- Después de obtener `service` (línea donde ya se valida `service.isActive`) y antes de construir la respuesta final que informa `billingRule` al frontend (bloque que hoy retorna `billingRule: service.billingRule` en la respuesta `ok: true`).
- El bloque `if (service.billingRule === "AUTHORIZE") { ... }` que hoy solo dispara notificaciones a staff/admins es el lugar natural para insertar el chequeo de no-shows *antes* de decidir el flujo de notificación/pago, ya que ambos dependen del valor efectivo de `billingRule` para esa reserva.
- La `billingRule` "efectiva" (posiblemente degradada a `DEPOSIT`) debe ser la que se devuelve en el campo `data.billingRule` de la respuesta, para que el wizard de reserva en el frontend redirija correctamente al flujo de pago con depósito en vez de al flujo de "cobro en persona".

### Consideraciones de MCP o bases de datos externas
No aplica: no se requiere ningún servicio externo ni MCP adicional. La política se resuelve enteramente con Prisma contra PostgreSQL (Neon), reutilizando el cliente `db` ya importado en la ruta.

## 3. Consideraciones de UX

- Cuando la `billingRule` efectiva se degrada de `AUTHORIZE` a `DEPOSIT`, el cliente debe ver en el wizard de reserva el mismo paso de pago con Stripe que vería para cualquier servicio configurado nativamente como `DEPOSIT` — no debe haber una pantalla distinta que revele explícitamente "tienes historial de no-shows". Es decir, el cambio debe ser transparente en el copy de cara al cliente, mostrando el monto de garantía a pagar como si fuera una condición normal del servicio.
- El mensaje de pago debe seguir usando el copy estándar de depósito/garantía ya existente en el flujo (p. ej. "Se requiere un depósito de garantía para confirmar tu cita"), sin lenguaje acusatorio ni que mencione "no-show" o "penalización" directamente al cliente.
- Internamente (dashboard de staff/admin), si se muestra el detalle de una cita, sería deseable indicar que esa reserva pasó por el downgrade automático (p. ej. una nota o badge informativo), para que el equipo entienda por qué un servicio típicamente `AUTHORIZE` terminó pagándose con depósito. Esto ayuda a resolver dudas de soporte sin exponer la lógica al cliente final.
- Si el cliente cancela el pago del depósito, debe aplicarse el mismo comportamiento ya existente para citas `DEPOSIT` no pagadas (p. ej. expiración de `PENDING` sin confirmar) — este spec no modifica esa lógica de expiración, solo el punto de entrada que decide qué `billingRule` aplica.

## 4. Lista de Tareas (Task Planner)

- [ ] Tarea 1: Definir constantes centralizadas para el umbral de no-shows (`NO_SHOW_THRESHOLD = 2`) y la ventana temporal (`NO_SHOW_WINDOW_DAYS = 90`), en un módulo compartido (p. ej. `src/lib/booking-policy.ts` o equivalente ya existente en `src/server`), para evitar valores mágicos dispersos.
- [ ] Tarea 2: Implementar una función pura de consulta (p. ej. `getRecentNoShowCount(email: string): Promise<number>`) que reciba el email normalizado y devuelva el conteo de `Appointment` con `status = NO_SHOW` y `startAt` dentro de la ventana configurada.
- [ ] Tarea 3: Añadir migración de Prisma para el índice compuesto `@@index([customerEmail, status, startAt])` en el modelo `Appointment`.
- [ ] Tarea 4: Integrar el chequeo en `src/app/api/bookings/draft/route.ts`: cuando `service.billingRule === "AUTHORIZE"`, invocar `getRecentNoShowCount` con `customer.email` normalizado; si el resultado es `>= NO_SHOW_THRESHOLD`, calcular una `billingRule` efectiva de `DEPOSIT` para el resto del flujo de esa solicitud.
- [ ] Tarea 5: Ajustar la rama de notificación a staff/admins (actualmente condicionada a `service.billingRule === "AUTHORIZE"`) para que use la `billingRule` efectiva en vez de la original del servicio, de modo que una cita degradada a `DEPOSIT` siga el flujo de pago/Stripe en vez del flujo de "cobro en persona".
- [ ] Tarea 6: Incluir en la respuesta JSON de la API (`data.billingRule`, `data.depositPct`) los valores efectivos post-downgrade, no los originales del `Service`, para que el frontend calcule correctamente el monto a cobrar.
- [ ] Tarea 7: Agregar un log de servidor (o campo de auditoría ligero, p. ej. en `notes` interno o tabla de eventos si existe) que registre email + conteo de no-shows cuando se aplique el downgrade, para trazabilidad de soporte.
- [ ] Tarea 8: Escribir tests (unitarios para `getRecentNoShowCount` y de integración para la ruta `draft`) que cubran: (a) cliente sin no-shows reserva `AUTHORIZE` normalmente; (b) cliente con exactamente 2 no-shows recientes es forzado a `DEPOSIT`; (c) cliente con no-shows fuera de la ventana de 90 días no es afectado; (d) servicios `FULL`/`DEPOSIT` no se ven alterados por la política.
- [ ] Tarea 9: Actualizar el copy del wizard de reserva (frontend) si es necesario, para asegurar que el mensaje de depósito mostrado sea genérico y no revele la causa del downgrade al cliente.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/no-show-policy`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
