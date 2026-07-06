# Especificación: Página de Cuenta del Usuario (`/account`)

> **Objetivo:** que al pulsar el icono/bloque de usuario del menú (el que está abajo en el drawer móvil y en la sidebar de escritorio) se navegue a una nueva página privada `/account`, donde el usuario autenticado pueda **visualizar y editar** su información relevante (nombre, avatar, contraseña, y datos de cuenta).

---

## 0. Estado actual (auditoría del código)

Análisis de: `src/app/(dashboard)/components/mobile/MobileDrawer.tsx`, `src/app/(dashboard)/components/Sidebar.tsx`, `src/app/profile/[userId]/page.tsx`, `src/app/api/users/[userId]/profile/route.ts`, `src/app/api/me/*`, `src/app/api/uploads/*`, y el modelo `User` en `prisma/schema.prisma`.

- **Existe** un perfil **público de solo lectura** en `/profile/[userId]` (avatar, nombre, stats, logros, progreso de cursos), servido por `GET /api/users/[userId]/profile`.
- **NO existe** ninguna ruta `/account` privada ni ningún flujo de autoedición del propio usuario.
- El bloque de usuario (avatar + nombre + email + botón "Cerrar sesión") aparece al fondo de `MobileDrawer.tsx` y `Sidebar.tsx`, pero **el avatar/bloque no es un enlace**: no navega a ningún sitio.
- Endpoints `me` existentes: `GET /api/me/stats` y `GET /api/me/activity` (solo lectura). **No existe** `GET /api/me` ni `PATCH /api/me`.
- **Modelo `User`** (`prisma/schema.prisma`): `id`, `name?`, `email` (**@unique**, es la clave de autenticación), `image?`, `role` (ADMIN/STAFF/STUDENT), `password?` (**null para usuarios que entraron por Google**), `createdAt`, `updatedAt`. No tiene `phone` ni `bio` (ese `bio` pertenece a `StaffProfile`).
- **Autenticación:** NextAuth con estrategia JWT; proveedores Google OAuth + Credentials (bcrypt). La sesión ya expone `user.id`, `user.role`, `name`, `email`, `image`.
- **Subidas de archivos:** existen `POST /api/uploads/presigned` y `POST /api/uploads/confirm` (flujo R2), reutilizables para el avatar.

**Implicaciones de diseño derivadas:**
1. El `email` es el identificador único de login; cambiarlo es sensible (afecta el acceso, y para usuarios de Google lo gestiona Google). → Se trata aparte (ver §2.4).
2. Los usuarios de Google tienen `password = null`; la UI de "cambiar contraseña" debe adaptarse a ese caso.
3. No hace falta un perfil público nuevo: `/account` es la versión **privada y editable**; puede enlazar al perfil público existente.

---

## 1. Requerimientos de Usuario (Spec Writer)

- [ ] **Historia principal:** Como usuario autenticado, quiero pulsar mi icono en el menú y llegar a una página `/account` donde vea y edite mi información, para mantener mis datos al día sin depender de un administrador.
- [ ] **HU-1 (Navegación):** Al pulsar el bloque/icono de usuario en el drawer móvil y en la sidebar de escritorio, navego a `/account`.
  - Criterio: el bloque es un enlace accesible (teclado + lector de pantalla); el botón "Cerrar sesión" sigue funcionando de forma independiente (no debe dispararse al ir a la cuenta).
- [ ] **HU-2 (Ver datos):** En `/account` veo mi avatar, nombre, email, rol, y fecha de alta ("miembro desde").
- [ ] **HU-3 (Editar perfil):** Puedo editar mi **nombre** y **avatar** (subida de imagen); los cambios se reflejan de inmediato en el menú y en la sesión.
- [ ] **HU-4 (Contraseña):**
  - Si tengo contraseña (usuario de credenciales), puedo **cambiarla** indicando la actual y la nueva.
  - Si entré con Google (`password = null`), veo el mensaje "Tu acceso se gestiona con Google" y, opcionalmente, la acción "Crear una contraseña" para habilitar también login por credenciales.
- [ ] **HU-5 (Enlaces útiles):** Desde `/account` puedo ir a mi **perfil público** (`/profile/[miId]`), a mis **notificaciones** y (si existe/ se aprueba) a mis reservas/cursos.
- [ ] **HU-6 (Seguridad de acceso):** `/account` solo es accesible autenticado; un visitante no autenticado es redirigido a `/signin`.

**Fuera de alcance de este spec (backlog):** preferencias de notificaciones por canal; borrado de cuenta / descarga de datos (ya cubierto por `specs/06-gdpr-data-retention.md` — solo se enlaza); cambio de email con reverificación (se decide en §2.4, puede quedar como stretch ligado a `specs/01-password-recovery.md`).

---

## 2. Diseño y Arquitectura (Designer)

### 2.1 Rutas y navegación

- **Nueva ruta:** `src/app/account/page.tsx` (Server Component que valida sesión y renderiza el cliente editable). Alternativamente dentro de `(dashboard)` si se quiere heredar su layout; **recomendado**: `/account` a nivel raíz para que sea accesible por cualquier rol sin depender del layout del dashboard.
- **Enlace desde el menú:** convertir el bloque de usuario de `MobileDrawer.tsx` y `Sidebar.tsx` en un `Link href="/account"`, manteniendo el botón "Cerrar sesión" como control separado (evitar anidar `<button>` dentro de `<Link>`).

### 2.2 Modelo de datos (Prisma) — diseño, no implementación

El `User` ya contiene los campos necesarios para el MVP (`name`, `image`, `password`). **No se requieren tablas nuevas.**

Campo **opcional** propuesto (nice-to-have, confirmar en Human Gate):

```
model User {
  ...
  phone String?   // teléfono de contacto del usuario (hoy solo se guarda en Appointment.customerPhone, no en User)
}
```
> **✅ Decisión confirmada: se añade `User.phone`.** Permite mostrarlo/editarlo en `/account` y autocompletarlo en el wizard de reserva (hoy el teléfono solo vive en `Appointment.customerPhone`). Migración trivial. `phone` es editable vía `PATCH /api/me` con validación de formato.

**Modelo nuevo para el cambio de email con reverificación (ver §2.4):**

```
model EmailChangeRequest {
  id         String   @id @default(cuid())
  userId     String
  newEmail   String                 // email destino (aún no aplicado)
  tokenHash  String   @unique       // token de verificación hasheado
  expiresAt  DateTime               // p. ej. 1 hora
  usedAt     DateTime?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}
```
> El email solo se aplica al `User` cuando se confirma el token enviado al **nuevo** correo. Reutiliza la infraestructura de tokens/emails de `specs/01-password-recovery.md`.

### 2.3 Endpoints (contratos)

| Método | Ruta | Auth | Propósito |
|---|---|---|---|
| `GET` | `/api/me` (nuevo) | Sesión requerida | Devuelve datos editables del usuario actual: `id, name, email, image, role, createdAt, hasPassword` (bool = `password != null`), y `phone` si se aprueba. |
| `PATCH` | `/api/me` (nuevo) | Sesión requerida | Actualiza `name`, `image` (y `phone` si aplica). Validación Zod. Solo el propio usuario. |
| `POST` | `/api/me/password` (nuevo) | Sesión requerida | Cambia o **crea** la contraseña. Si el usuario ya tiene contraseña, exige `currentPassword` correcta; si no (Google), permite establecer una nueva sin actual. Hash con bcrypt. |
| `POST` | `/api/me/email` (nuevo) | Sesión requerida | Inicia el cambio de email: valida unicidad, crea `EmailChangeRequest` y envía verificación al **nuevo** email. Bloqueado para cuentas solo-Google (§2.4). |
| `GET`/`POST` | `/api/me/email/confirm` (nuevo) | Token | Confirma el token, aplica `User.email` e invalida sesiones previas. |
| — | Avatar | Sesión requerida | Reutiliza `POST /api/uploads/presigned` + `/api/uploads/confirm` para subir la imagen a R2 y luego `PATCH /api/me { image }`. |

> `phone` **sí** es editable vía `PATCH /api/me` (decisión confirmada). El `email` **no** se cambia por `PATCH /api/me`: va por su flujo dedicado de reverificación.

**Notas de contrato:**
- `GET/PATCH /api/me` resuelven al usuario por `session.user.email` (patrón ya usado en el resto de endpoints), nunca por un id recibido del cliente.
- `PATCH /api/me` **nunca** permite cambiar `role`, `email` (ver §2.4), ni `password` (eso va por su endpoint dedicado).
- Tras `PATCH`, el cliente debe refrescar la sesión NextAuth (`useSession().update()` o `router.refresh()`) para que el menú muestre el nombre/imagen nuevos (el JWT cachea `name`/`image`).

### 2.4 Cambio de email — **editable con reverificación** (decisión confirmada)

**✅ Decisión de negocio: Opción B — email editable con reverificación.** Flujo:
1. El usuario introduce el nuevo email en `/account` → `POST /api/me/email` valida que no esté en uso (`@unique`), crea un `EmailChangeRequest` con token hasheado (expira ~1 h) y envía un correo de verificación **al nuevo email**.
2. El usuario abre el enlace → `GET/POST /api/me/email/confirm?token=...` valida el token, aplica `User.email = newEmail`, marca `usedAt`, e invalida sesiones previas (el email es parte del JWT/lookup).
3. Mensaje genérico y seguro; no confirmar existencia de emails de terceros.

**Caveat para cuentas de Google** (`account.provider === "google"`): el email lo gestiona Google y el `signIn` callback hace `upsert` por email. Cambiar el email local de un usuario de Google puede **desincronizarlo** de su identidad OAuth (en el siguiente login por Google se volvería a crear/emparejar por el email de Google). Diseño: para cuentas cuyo acceso es **solo Google** (`password = null`), **desactivar el cambio de email** en la UI y mostrar "Tu email está gestionado por Google"; permitir el cambio solo a usuarios con contraseña propia (o que primero creen una vía §HU-4). Confirmar esta restricción en la implementación.

> Depende de la infraestructura de tokens/emails de `specs/01-password-recovery.md`; si ese spec aún no está implementado, este bloque de email lo incorpora como dependencia previa.

### 2.5 Seguridad y validación

- Todas las rutas exigen sesión; `/account` (página) redirige a `/signin` si no hay sesión.
- Autorización estricta: un usuario solo lee/edita **su propio** registro (resolución por email de sesión, no por id de entrada).
- Validación con Zod en `PATCH /api/me` y `POST /api/me/password` (nombre 2–80 chars; imagen = URL válida de nuestro dominio/R2; contraseña nueva ≥ 8, alineado con el registro).
- `POST /api/me/password`: verificar `currentPassword` con bcrypt cuando exista; rate-limit por usuario/IP; al cambiarla, considerar invalidar sesiones previas (coordinar con `specs/01-password-recovery.md`).
- Subida de avatar: validar tipo MIME (imagen) y tamaño máximo en el flujo de `uploads` (reutilizar límites ya existentes).
- No exponer nunca el hash de contraseña en `GET /api/me` (solo el booleano `hasPassword`).

### 2.6 UX / componentes

- Página `/account` con secciones: **Perfil** (avatar + nombre [+ phone]), **Cuenta** (email [solo lectura], rol, miembro desde), **Seguridad** (cambiar/crear contraseña), **Enlaces** (perfil público, notificaciones).
- Formularios con `react-hook-form` + resolver Zod (patrón ya usado en el proyecto).
- Estados de carga/guardado y feedback de éxito/error; el avatar muestra iniciales como fallback (reutilizar la lógica de `MobileDrawer`).
- Consistencia visual con el dashboard (Tailwind, tokens `ap-*`).

### 2.7 Consideraciones MCP / servicios externos

- **Cloudflare R2** para el avatar (vía endpoints de uploads existentes). Sin nuevas dependencias externas.
- Sin cambios en Stripe ni en el modelo de pagos.

---

## 3. Lista de Tareas (Task Planner)

> Ejecutar en rama `feature/user-account-page`. Al tocar autenticación/contraseña → **tests obligatorios** (unitarios + integración), según la matriz de `AGENT.md`. La edición de nombre/avatar es de menor criticidad (test recomendado, no bloqueante).

**Bloque A — Backend (contratos de datos):**
- [ ] T1: Migración Prisma: añadir `User.phone` (confirmado) y crear el modelo `EmailChangeRequest`.
- [ ] T2: Crear `GET /api/me` — devuelve datos editables del usuario actual + `hasPassword` + `canChangeEmail` (false si es cuenta solo-Google).
- [ ] T3: Crear `PATCH /api/me` — actualiza `name`/`image`/`phone` con validación Zod y autorización por sesión (nunca `email`/`role`/`password`).
- [ ] T4: Crear `POST /api/me/password` — cambia o crea contraseña (bcrypt; exige actual si existe; rate-limit).

**Bloque A2 — Cambio de email con reverificación (§2.4, depende de spec 01):**
- [ ] T4a: Crear `POST /api/me/email` — valida unicidad, bloquea cuentas solo-Google, crea `EmailChangeRequest` (token hasheado, expira ~1 h) y envía verificación al nuevo email vía `src/lib/mail.ts`.
- [ ] T4b: Crear `GET/POST /api/me/email/confirm` — valida token, aplica `User.email`, marca `usedAt` e invalida sesiones previas.
- [ ] T4c: Página/handler de confirmación de email y estados de UI (pendiente de verificación / confirmado / token expirado).

**Bloque B — Frontend (página `/account`):**
- [ ] T5: Crear `src/app/account/page.tsx` (guard de sesión → `/signin` si no autenticado).
- [ ] T6: Componente cliente de cuenta con secciones Perfil / Cuenta / Seguridad / Enlaces (react-hook-form + Zod).
- [ ] T7: Integrar subida de avatar reutilizando `uploads/presigned` + `confirm` y luego `PATCH /api/me`.
- [ ] T8: Tras guardar, refrescar la sesión (`update()` / `router.refresh()`) para actualizar nombre/imagen en el menú.

**Bloque C — Navegación (el enlace pedido):**
- [ ] T9: Convertir el bloque de usuario de `MobileDrawer.tsx` en `Link href="/account"` (cerrando el drawer al navegar), sin romper el botón "Cerrar sesión".
- [ ] T10: Hacer lo mismo en `Sidebar.tsx` (escritorio), manteniendo separado el logout.

**Bloque D — Pruebas y documentación:**
- [ ] T11: Tests de integración de `GET/PATCH /api/me` y `POST /api/me/password` (incluyendo: usuario Google sin contraseña que crea una; contraseña actual incorrecta; intento de editar rol/email; acceso no autenticado → 401).
- [ ] T12: Test de que un usuario no puede editar datos de otro (autorización por sesión).
- [ ] T13: Documentar la feature en `/docs` (flujo, endpoints, matriz de campos editables vs. de solo lectura) según `skills/documentation-rules.md` y registrar decisiones en `engram.json`.

---

### Decisiones de negocio resueltas (Human Gate parcial)

- **§2.2 → Se añade `User.phone`** (confirmado). Editable en `/account` y reutilizable en el wizard de reserva.
- **§2.4 → Email editable con reverificación** (confirmado, Opción B). Nuevo modelo `EmailChangeRequest` + flujo de token; **bloqueado para cuentas solo-Google**. Depende de la infraestructura de `specs/01-password-recovery.md`.

**Estado del spec:** en revisión del usuario. La implementación NO ha sido aprobada todavía.

*(Nota para la IA: Ejecuta las tareas mediante sub-agentes en la rama `feature/user-account-page` SOLO tras la aprobación explícita de implementación. Si el spec 01 (tokens/emails de verificación) no está implementado, el Bloque A2 debe incorporarlo como dependencia previa. Al finalizar, verifica contra la suite de `/tests` antes de solicitar Merge a `dev`.)*
