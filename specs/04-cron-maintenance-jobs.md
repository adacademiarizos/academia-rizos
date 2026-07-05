# Especificación: Automatización de Tareas de Mantenimiento (Cron Jobs)

## 1. Requerimientos de Usuario (Spec Writer)

### Historia de usuario
> Como negocio, quiero que las tareas de mantenimiento (expiración de acceso, emisión de certificados, envío de recibos) se ejecuten automáticamente sin intervención manual, para que el acceso a la Academia respete las reglas de renta (`Course.rentalDays`), los certificados se emitan sin demora tras aprobar el examen final, y los recibos lleguen a los clientes sin depender de que un administrador dispare el proceso a mano.

### Contexto del gap (auditoría)
Actualmente existen tres jobs con lógica de negocio ya implementada en `src/server/jobs/`:

- `expireAccess.job.ts` — revoca/marca como expirado el acceso a cursos cuya `accessUntil` (derivada de `Course.rentalDays`) ya venció.
- `issueCertificate.job.ts` — emite el certificado PDF verificable por QR cuando corresponde.
- `sendReceipt.job.ts` — envía el recibo transaccional por email (Nodemailer) tras una compra/pago.

Ninguno de los tres está conectado a un disparador real:
- No existe `vercel.json` en la raíz del repo (sin `crons` configurados).
- No existe un GitHub Action programado (`schedule:`) en `.github/workflows/`.
- No son invocados desde ningún endpoint HTTP ni desde webhooks existentes.

**Consecuencia de negocio:** un alumno con acceso de renta temporal (`rentalDays` no nulo) puede conservar acceso a los videos del curso indefinidamente después de vencido, porque `canWatchVideos` en `course-service.ts` depende de que exista un proceso que marque la expiración; si nadie lo invoca manualmente, el estado nunca se actualiza. Certificados y recibos quedan sujetos al mismo riesgo de "ejecución manual olvidada".

### Criterios de aceptación
- [ ] Los tres jobs se ejecutan de forma automática y periódica sin acción humana, en producción (Vercel).
- [ ] Existe un mecanismo de autenticación que impide que cualquier persona con la URL del endpoint pueda disparar los jobs.
- [ ] Si un job falla, queda registrado (log) y se genera algún tipo de alerta visible para el equipo (mínimo: log estructurado consultable en Vercel; idealmente notificación a admin).
- [ ] La frecuencia de cada job es adecuada a su naturaleza de negocio (ver sección 2.3).
- [ ] El diseño no introduce un nuevo servicio de infraestructura (no se agrega un worker externo, cola, ni servidor adicional) — se apoya en lo que el stack actual (Vercel + GitHub) ya ofrece.
- [ ] Un mismo endpoint reutilizable permite invocar cualquiera de los tres jobs por nombre, evitando duplicar lógica de autenticación/logging.

---

## 2. Diseño y Arquitectura (Designer)

### 2.1 Modelos de datos afectados

No se requieren nuevas tablas para el MVP de esta spec. Se apoya en los modelos ya existentes:

- `Course.rentalDays` (Prisma) — determina si el acceso es "de por vida" (`null`) o temporal (entero, días).
- Entidad de acceso/matrícula del alumno (la que contiene `accessUntil` / estado de acceso, consumida por `course-service.ts`) — el job `expireAccess.job.ts` la actualiza.
- Entidad de certificado — consumida/creada por `issueCertificate.job.ts`.
- Entidad de pago/orden — consumida por `sendReceipt.job.ts`.

**Recomendación de mejora futura (fuera de alcance de esta spec, solo se deja anotado):** agregar una tabla ligera `CronJobRun` (o `MaintenanceLog`) con `jobName`, `startedAt`, `finishedAt`, `status`, `errorMessage`, `itemsProcessed` para tener trazabilidad histórica en base de datos además de los logs de Vercel. No se implementa en esta iteración para no ampliar el alcance; se documenta como tarea opcional (ver 3.9).

### 2.2 Comparación de opciones de disparo

| Criterio | Vercel Cron Jobs (`vercel.json`) | GitHub Actions programado (`schedule:`) |
|---|---|---|
| Integración con el stack actual | Nativa: el proyecto ya se despliega en Vercel, cero infraestructura nueva | Requiere secret adicional (`CRON_SECRET`) y un workflow separado del pipeline de CI/CD existente |
| Latencia/fiabilidad del disparo | Alta; Vercel garantiza el disparo dentro de la ventana del plan contratado | GitHub Actions puede retrasar el disparo varios minutos en horas pico (limitación conocida de `schedule:` en GitHub) |
| Límites del plan | En plan Hobby: 1 ejecución/día por cron y máximo 2 crons; en plan Pro: hasta 40 crons y frecuencia por minuto | Sin límite de cantidad de workflows, pero el repo ya usa Actions para CI/CD (namespace compartido) |
| Autenticación del endpoint | Vercel firma la petición y además se puede exigir `Authorization: Bearer CRON_SECRET` | Debe configurarse manualmente el header `Authorization` en el step de `curl`/`fetch` del workflow |
| Observabilidad | Logs centralizados en el mismo dashboard de Vercel donde ya se opera el proyecto | Logs en la pestaña Actions de GitHub, separados del runtime de la app |
| Complejidad de mantenimiento | Un solo archivo de config (`vercel.json`) versionado junto al código | Un workflow YAML adicional, con su propio secret y su propio historial de ejecuciones |
| Acoplamiento al proveedor | Alto (si algún día se migra de Vercel, hay que rehacer los crons) | Bajo (GitHub Actions es independiente del hosting) |

**Recomendación: Vercel Cron Jobs.**

Justificación:
1. El proyecto ya está desplegado en Vercel; usar `vercel.json` con `crons` no agrega infraestructura ni un nuevo lugar donde vigilar fallos — todo vive en el mismo dashboard donde ya se monitorea la app.
2. La frecuencia requerida por los tres jobs (ver 2.3) es compatible con los límites de un plan Vercel Pro (que se asume dado que el proyecto usa Neon/R2/Stripe en producción); si el proyecto estuviera en plan Hobby, la limitación de "1 ejecución/día" seguiría siendo suficiente para `expireAccess` e `issueCertificate`, pero forzaría a `sendReceipt` a un mecanismo distinto (ver alternativa híbrida abajo).
3. Evita duplicar la superficie de "cosas que disparan HTTP contra el repo" — el `.github/workflows/ci-cd-pipeline.yml` existente está enfocado en tests/seguridad/release, no en operación de runtime; mezclar cron de negocio ahí ensucia su propósito.
4. Menor superficie de secretos: el `CRON_SECRET` se define una sola vez en las variables de entorno de Vercel, en el mismo lugar donde ya viven `DATABASE_URL`, credenciales de Stripe, etc.

**Alternativa híbrida (mencionar, no implementar):** si en el futuro se requiere disparar `sendReceipt.job.ts` de forma inmediata (no periódica) tras un pago, lo correcto es invocarlo directamente desde el webhook de Stripe existente en vez de esperar al cron — el cron para `sendReceipt` en este diseño actúa solo como **red de seguridad** (reintento de recibos no enviados), no como mecanismo primario.

### 2.3 Endpoint protegido de ejecución

**Ruta propuesta:** `src/app/api/cron/[job]/route.ts` → expuesta como `GET /api/cron/[job]` (Vercel Cron solo soporta `GET`/`HEAD` en sus invocaciones).

**Valores válidos de `[job]`:** `expire-access`, `issue-certificates`, `send-receipts` (kebab-case, mapeando 1 a 1 a los archivos en `src/server/jobs/`).

**Autenticación:**
- El endpoint exige el header `Authorization: Bearer <CRON_SECRET>`.
- `CRON_SECRET` se define como variable de entorno en Vercel (Production + Preview) y en GitHub Secrets si en el futuro se dispara manualmente desde un workflow (ej. botón "Run workflow" para reintento manual).
- Vercel Cron añade automáticamente este header cuando se configura `CRON_SECRET` en el proyecto; toda petición sin el header correcto responde `401 Unauthorized` sin ejecutar lógica de negocio.
- Se recomienda además validar el header `x-vercel-cron` cuando esté presente (heurística adicional, no sustituye al secreto) y aplicar rate limiting básico si el endpoint quedara accesible públicamente.

**Contrato de la ruta (diseño, no implementación):**
- Entrada: ninguna (GET sin body).
- Salida esperada: JSON con `{ job, status: "ok" | "error", processed: number, durationMs: number, errors?: string[] }`.
- Códigos de respuesta: `200` (ejecución completada, con o sin errores parciales reportados en el cuerpo), `401` (secreto inválido/ausente), `404` (nombre de job no reconocido), `500` (fallo no controlado del job).

**Snippet de referencia — `vercel.json` (diseño, no código de producción):**
```json
{
  "crons": [
    { "path": "/api/cron/expire-access", "schedule": "0 * * * *" },
    { "path": "/api/cron/issue-certificates", "schedule": "*/15 * * * *" },
    { "path": "/api/cron/send-receipts", "schedule": "0 */6 * * *" }
  ]
}
```

**Snippet de referencia — workflow alternativo/manual en GitHub Actions (para reintento a demanda, no como disparador principal):**
```yaml
name: Manual Cron Retry
on:
  workflow_dispatch:
    inputs:
      job:
        description: "Job a reintentar"
        required: true
        type: choice
        options: [expire-access, issue-certificates, send-receipts]
jobs:
  trigger:
    runs-on: ubuntu-latest
    steps:
      - name: Invocar endpoint de cron
        run: |
          curl -sf -X GET "https://elizabeth-rizos-platform.vercel.app/api/cron/${{ inputs.job }}" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

### 2.4 Frecuencia recomendada por job

| Job | Frecuencia recomendada | Justificación |
|---|---|---|
| `expire-access` (`expireAccess.job.ts`) | Cada hora (`0 * * * *`) | El impacto de negocio es directo: un alumno con `rentalDays` vencido no debe seguir viendo videos. Una ventana de hasta 1 hora de retraso es aceptable y evita sobrecargar la base de datos con revisiones constantes. |
| `issue-certificates` (`issueCertificate.job.ts`) | Cada 15 minutos (`*/15 * * * *`) | La emisión de certificados es la recompensa inmediata tras aprobar el examen final; el alumno espera verlo disponible casi enseguida. Si el flujo de aprobación ya dispara el job de forma síncrona/directa en el futuro, este cron queda como red de seguridad para casos que fallaron. |
| `send-receipts` (`sendReceipt.job.ts`) | Cada 6 horas (`0 */6 * * *`) | El envío de recibos idealmente ocurre de forma síncrona en el webhook de Stripe; este cron actúa como reintento/red de seguridad para recibos que no se enviaron (fallo de SMTP, timeout, etc.), por lo que no requiere alta frecuencia. |

### 2.5 Logging y alertas mínimas ante fallos

Diseño mínimo viable, sin agregar infraestructura nueva:

1. **Logging estructurado:** cada ejecución del endpoint `/api/cron/[job]` registra en consola (capturado por Vercel Logs) un objeto JSON con `{ job, startedAt, finishedAt, status, processed, errors }`. Esto permite filtrar y buscar en el dashboard de Vercel sin herramientas adicionales.
2. **Alerta a admin ante fallo:** si el job termina con `status: "error"` (excepción no controlada) o reporta `errors.length > 0`, se reutiliza el servicio de email transaccional (Nodemailer, ya presente en el proyecto) para notificar a la dirección de correo del ADMIN configurada en variables de entorno, con asunto tipo `[ALERTA] Falló el job de mantenimiento: <job>`.
3. **Umbral de ruido:** para evitar spam de emails si un job falla repetidamente en cada ejecución (ej. `expire-access` cada hora), se recomienda notificar solo en la primera falla consecutiva y luego silenciar hasta que el job vuelva a tener éxito una vez (patrón "notificar en transición de estado", no en cada intento).
4. **Vercel Monitoring (opcional, nativo):** si el plan de Vercel lo permite, configurar una alerta de "Function Error Rate" sobre la ruta `/api/cron/*` como capa adicional independiente del código de la app.

---

## 3. Lista de Tareas (Task Planner)

- [ ] **Tarea 1:** Crear la variable de entorno `CRON_SECRET` en Vercel (Production y Preview) y documentarla en `.env.example`.
- [ ] **Tarea 2:** Implementar el endpoint `src/app/api/cron/[job]/route.ts` que valide el header `Authorization: Bearer CRON_SECRET`, resuelva el nombre de `job` (kebab-case) al archivo correspondiente en `src/server/jobs/`, y devuelva el contrato de respuesta JSON descrito en 2.3.
- [ ] **Tarea 3:** Mapear los tres jobs existentes (`expireAccess.job.ts`, `issueCertificate.job.ts`, `sendReceipt.job.ts`) a las claves `expire-access`, `issue-certificates`, `send-receipts` dentro del endpoint (sin modificar la lógica interna de los jobs salvo lo necesario para exponer un resultado serializable `{ processed, errors }`).
- [ ] **Tarea 4:** Crear `vercel.json` en la raíz del repo con la configuración de `crons` propuesta en 2.3 (frecuencias de 2.4).
- [ ] **Tarea 5:** Añadir logging estructurado (JSON por línea) en cada ejecución del endpoint, incluyendo duración y cantidad de elementos procesados.
- [ ] **Tarea 6:** Implementar el envío de email de alerta al ADMIN cuando un job termine en estado de error, reutilizando el servicio de Nodemailer ya existente, con el patrón de "notificar solo en transición de estado" descrito en 2.5.
- [ ] **Tarea 7:** Escribir pruebas de integración para el endpoint `/api/cron/[job]`: caso sin header (`401`), caso con secreto inválido (`401`), caso con `job` inexistente (`404`), y caso feliz para cada uno de los tres jobs (`200`).
- [ ] **Tarea 8:** Actualizar `docs/ARCHITECTURE.md` (o el documento de arquitectura vigente) para reflejar que la expiración de acceso, emisión de certificados y envío de recibos ahora son procesos automáticos disparados por Vercel Cron, no solo lógica invocable manualmente.
- [ ] **Tarea 9 (opcional, backlog):** Evaluar la creación de la tabla `CronJobRun`/`MaintenanceLog` en el esquema de Prisma para persistir histórico de ejecuciones más allá de la retención de logs de Vercel, incluyendo migración versionada correspondiente.
- [ ] **Tarea 10 (opcional, backlog):** Evaluar invocar `issueCertificate.job.ts` y `sendReceipt.job.ts` de forma síncrona en sus respectivos puntos de origen (aprobación de examen final; webhook de Stripe) dejando el cron únicamente como red de seguridad de reintento, reduciendo la latencia percibida por el usuario.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/cron-maintenance-jobs`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
