# Especificación: Recuperación de Contraseña (Password Recovery)

## 1. Requerimientos de Usuario (Spec Writer)

**Historia de usuario:**
Como usuario que se registró con email y contraseña (`CredentialsProvider`) y olvidó su contraseña, quiero poder solicitar un enlace de restablecimiento vía email e ingresar una nueva contraseña, para recuperar acceso a mi cuenta sin depender de un administrador.

**Contexto del problema (gap actual):**
- `src/lib/auth-options.ts` define `CredentialsProvider` (email + password con bcrypt) y `GoogleProvider`, con `session: { strategy: "jwt" }`.
- `src/app/api/auth/register/route.ts` crea usuarios `STUDENT` con contraseña hasheada, pero **no existe ningún flujo de "olvidé mi contraseña"** ni de reseteo. Un usuario que olvida su clave y no usó Google OAuth queda bloqueado de forma permanente.
- Tampoco existe verificación de email en el registro (el campo `emailVerified` no existe en el modelo `User` de `prisma/schema.prisma`).
- El proyecto ya cuenta con infraestructura de envío de correo transaccional en `src/lib/mail.ts` (vía Gmail/Nodemailer, con helper `createGmailTransport` en `src/lib/gmail.ts` y guardas `isGmailConfigured()`), que debe reutilizarse para el email de reseteo.

**Criterios de aceptación:**
1. Un usuario no autenticado puede ir a una pantalla "Olvidé mi contraseña" e introducir su email.
2. Al enviar el formulario, el sistema responde **siempre** con un mensaje genérico de éxito (p. ej. "Si el email existe, te enviamos instrucciones"), exista o no una cuenta con credenciales asociada a ese email. No debe revelar si el email está registrado.
3. Si el email corresponde a un usuario con `password` definido (cuenta de credenciales), se genera un token de un solo uso, válido por **1 hora**, y se envía un correo con un enlace de reseteo (`/reset-password?token=...`) usando la plantilla visual existente de `src/lib/mail.ts`.
4. Si el email corresponde a un usuario que solo tiene cuenta de Google (sin `password`), el sistema no envía enlace de reseteo de contraseña (no aplica) pero responde igualmente con el mensaje genérico — no debe filtrar esta distinción al usuario.
5. El usuario abre el enlace, introduce una nueva contraseña (con confirmación) y la envía al endpoint de confirmación junto con el token.
6. El endpoint de confirmación valida que el token exista, no haya expirado y no haya sido usado ya; de lo contrario responde con error genérico ("Enlace inválido o expirado") sin detalles internos.
7. Al confirmar exitosamente, la contraseña del usuario se actualiza (hasheada con bcrypt, igual que en el registro), el token se marca como usado (no puede reutilizarse) y todas las sesiones previas del usuario quedan invalidadas (el usuario debe volver a iniciar sesión).
8. Se aplica rate limiting a las solicitudes de reseteo (por email y por IP) para evitar abuso/spam de correos y enumeración de cuentas.
9. Los tokens nunca se almacenan en texto plano en base de datos (se guarda un hash del token, similar al patrón de `password`).
10. (Relacionado, opcional) Se sienta la base para verificación de email en el registro, reutilizando el mismo modelo de token de un solo uso, ya que pertenece al mismo dominio de "tokens transaccionales de cuenta".

**Fuera de alcance de este spec:**
- Verificación de email obligatoria en el flujo de registro actual (se deja como tarea opcional/futura, no bloqueante).
- Cambio de contraseña estando autenticado desde el perfil de usuario (flujo distinto, no cubierto aquí).
- Recuperación de acceso para cuentas creadas solo vía Google OAuth (no tienen contraseña que resetear).

## 2. Diseño y Arquitectura (Designer)

**Modelo de datos (Prisma):**

Nuevo modelo `PasswordResetToken` en `prisma/schema.prisma`, relacionado con `User`:

```prisma
model PasswordResetToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique   // SHA-256 del token en texto plano enviado por email
  expiresAt DateTime             // now() + 1 hora al crearse
  usedAt    DateTime?            // null hasta que se consume; marca invalidación
  createdAt DateTime  @default(now())
  requestIp String?              // IP de origen de la solicitud, para auditoría/rate limiting

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([expiresAt])
}
```

- El token en texto plano (aleatorio, criptográficamente seguro, p. ej. 32 bytes vía `crypto.randomBytes`) solo existe en el enlace del email; en base de datos se guarda su hash (`tokenHash`), igual criterio que las contraseñas nunca se guardan en claro.
- `User` gana la relación inversa `passwordResetTokens PasswordResetToken[]`.
- (Opcional, tarea relacionada) Si se implementa verificación de email, se añade `emailVerified DateTime?` al modelo `User`, reutilizando la misma tabla `PasswordResetToken` no aplica — requeriría un modelo `EmailVerificationToken` análogo, o generalizar a un modelo `VerificationToken` con un campo `purpose` (`PASSWORD_RESET` | `EMAIL_VERIFICATION`). Se deja como decisión de implementación en la tarea correspondiente.

**Invalidación de sesiones previas (consideración crítica de arquitectura):**
- El proyecto usa `session: { strategy: "jwt" }` en NextAuth (`src/lib/auth-options.ts`), es decir, las sesiones son *stateless* (no hay tabla `Session` consultada en cada request). Por lo tanto, "invalidar sesiones previas" no puede lograrse borrando filas en base de datos como en `strategy: "database"`.
- Enfoque propuesto: añadir un campo de versión/sello de tiempo al modelo `User` (p. ej. `passwordChangedAt DateTime?` o `tokenVersion Int @default(0)`), actualizado en cada reseteo exitoso de contraseña. El callback `jwt()` en `authOptions` debe comparar este valor contra el que trae el token JWT (`token.passwordChangedAt` o `token.tokenVersion`); si no coincide, el callback debe forzar la invalidación de esa sesión (devolviendo un token vacío/inválido para que NextAuth cierre la sesión en el próximo request).
- Esto requiere modificar `callbacks.jwt` y `callbacks.session` en `src/lib/auth-options.ts` para incluir y verificar este campo en cada request, sin romper el flujo actual de Google OAuth.

**Endpoints (Next.js App Router, API routes):**

1. `POST /api/auth/forgot-password`
   - Input: `{ email: string }` (validado con Zod, igual patrón que `RegisterSchema`).
   - Lógica: normaliza email (`toLowerCase().trim()`), busca usuario con `password` no nulo; si existe, genera token, lo persiste hasheado con `expiresAt = now + 1h`, envía email vía nueva función en `src/lib/mail.ts` (p. ej. `sendPasswordResetEmail`) reutilizando el `shell()`/`emailTitle()`/`ctaButton()` existentes.
   - Rate limiting: por email (p. ej. máx. 3 solicitudes / hora) y por IP (p. ej. máx. 5 solicitudes / hora), reutilizando o extendiendo utilidades de rate limiting si ya existen en el proyecto, o implementando una tabla/mecanismo simple (in-memory con caché LRU no es viable en serverless; preferible una tabla ligera o Redis/Upstash si el proyecto ya lo usa — a confirmar en la tarea técnica).
   - Respuesta: siempre `200 { success: true, message: "Si el email existe, recibirás instrucciones" }`, salvo errores de validación de payload (400) o error interno (500).

2. `POST /api/auth/reset-password`
   - Input: `{ token: string, password: string }` (Zod: password mínimo 8 caracteres, igual regla que `RegisterSchema`).
   - Lógica: hashea el `token` recibido y busca `PasswordResetToken` por `tokenHash`; valida `usedAt === null` y `expiresAt > now()`. Si es inválido/expirado/usado: `400 { success: false, message: "Enlace inválido o expirado" }`.
   - Si es válido: hashea la nueva contraseña con bcrypt (mismo costo que en registro), actualiza `User.password`, marca `usedAt = now()` en el token, incrementa/actualiza el campo de invalidación de sesión (`passwordChangedAt` o `tokenVersion`), y opcionalmente invalida (marca `usedAt`) cualquier otro `PasswordResetToken` pendiente del mismo usuario.
   - Respuesta: `200 { success: true, message: "Contraseña actualizada" }`.

**UI (páginas, sin implementación aún, solo referencia de rutas):**
- `/forgot-password` — formulario con campo email, consume `POST /api/auth/forgot-password`.
- `/reset-password?token=...` — formulario con nueva contraseña + confirmación, consume `POST /api/auth/reset-password`; debe manejar el caso de token ausente/inválido en la URL.
- Enlace "¿Olvidaste tu contraseña?" visible en la pantalla de login existente (`/signin`).

**Consideraciones de seguridad:**
- No revelar existencia de cuenta: mensaje de respuesta idéntico exista o no el email, y exista o no contraseña asociada (cuenta solo-Google).
- Tokens de un solo uso: `usedAt` se marca de forma atómica (transacción o `updateMany` condicionado a `usedAt: null`) para evitar condiciones de carrera si el enlace se abre dos veces.
- Expiración corta (1 hora) y limpieza: considerar tarea de limpieza periódica (cron/job) de tokens expirados, o simplemente filtrarlos siempre por `expiresAt` en las consultas (no es estrictamente necesario borrar filas viejas para la v1).
- Rate limiting por email y por IP para mitigar spam de correos y enumeración por fuerza bruta de tokens.
- El token en la URL debe ser suficientemente largo/aleatorio (mínimo 32 bytes / 256 bits) para hacer inviable la adivinación.
- Todas las respuestas de error de este flujo deben ser genéricas (sin distinguir "usuario no existe" de "token inválido" de "cuenta sin contraseña") para no filtrar información a un atacante.
- Reutilizar `bcrypt` (ya usado en `register/route.ts` y `auth-options.ts`) para consistencia del hash de contraseña.

## 3. Lista de Tareas (Task Planner)

- [ ] Tarea 1: Agregar el modelo `PasswordResetToken` a `prisma/schema.prisma` (campos `id`, `userId`, `tokenHash` único, `expiresAt`, `usedAt`, `createdAt`, `requestIp`, relación con `User`) y añadir el campo de invalidación de sesión al modelo `User` (p. ej. `passwordChangedAt DateTime?`). Generar y aplicar la migración de Prisma correspondiente.
- [ ] Tarea 2: Crear la función `sendPasswordResetEmail(params: { to: string; resetUrl: string })` en `src/lib/mail.ts`, reutilizando los componentes visuales existentes (`shell`, `emailTitle`, `para`, `ctaButton`, `divider`) y el guard `isGmailConfigured()`, siguiendo el mismo patrón que `sendCertificateEmail` o `sendAppointmentConfirmationEmail`.
- [ ] Tarea 3: Implementar `POST /api/auth/forgot-password` en `src/app/api/auth/forgot-password/route.ts`: validación Zod del email, búsqueda de usuario con `password` no nulo, generación de token aleatorio (`crypto.randomBytes`), hash del token (SHA-256) y persistencia en `PasswordResetToken` con `expiresAt = now + 1h`, envío del email vía la función de la Tarea 2, y respuesta genérica siempre `200`.
- [ ] Tarea 4: Implementar rate limiting para `POST /api/auth/forgot-password` (por email y por IP), definiendo el mecanismo de persistencia del contador (reutilizar infraestructura existente si el proyecto ya tiene rate limiting en algún otro endpoint, o crear una tabla/estrategia simple basada en `PasswordResetToken.createdAt` + `requestIp` como fuente de conteo).
- [ ] Tarea 5: Implementar `POST /api/auth/reset-password` en `src/app/api/auth/reset-password/route.ts`: validación Zod del payload (`token`, `password` mínimo 8 caracteres), verificación de `tokenHash` + `expiresAt` + `usedAt`, actualización atómica de `User.password` (bcrypt) y `User.passwordChangedAt`, marcado de `usedAt` en el token usado, e invalidación de cualquier otro token pendiente del mismo usuario.
- [ ] Tarea 6: Modificar `callbacks.jwt` y `callbacks.session` en `src/lib/auth-options.ts` para incluir `passwordChangedAt` en el JWT y compararlo contra el valor actual en base de datos en cada request, forzando cierre de sesión si no coincide (invalidación de sesiones previas tras un reseteo).
- [ ] Tarea 7: Crear la página `/forgot-password` (formulario de email) que consuma `POST /api/auth/forgot-password` y muestre siempre el mensaje genérico de éxito.
- [ ] Tarea 8: Crear la página `/reset-password` (lee `token` desde query string, formulario de nueva contraseña + confirmación) que consuma `POST /api/auth/reset-password`, maneje el caso de token ausente/inválido/expirado y redirija a `/signin` tras éxito.
- [ ] Tarea 9: Añadir enlace "¿Olvidaste tu contraseña?" en la pantalla de login existente (`/signin`) apuntando a `/forgot-password`.
- [ ] Tarea 10 (opcional, relacionada): Evaluar generalizar `PasswordResetToken` a un modelo `VerificationToken` con campo `purpose` (`PASSWORD_RESET` | `EMAIL_VERIFICATION`) y añadir `emailVerified DateTime?` a `User`, para sentar la base de verificación de email en `src/app/api/auth/register/route.ts` en un spec futuro. No implementar el flujo completo de verificación en este ciclo, solo dejar la decisión de esquema documentada si se aborda junto con esta feature.
- [ ] Tarea 11: Escribir pruebas (unitarias/integración) para ambos endpoints cubriendo: email inexistente (respuesta genérica), cuenta solo-Google (respuesta genérica, sin envío de reseteo), token expirado, token ya usado, token válido con reseteo exitoso, invalidación de sesión previa tras el reseteo.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/password-recovery`. Al finalizar, verifica contra la suite de /tests antes de solicitar Merge a `dev`).*
