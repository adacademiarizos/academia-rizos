# Skill: Backend

- **Stack:** Next.js 16 API Routes / Server Actions, Prisma ORM, PostgreSQL (Neon), NextAuth (Google OAuth), Stripe, Cloudflare R2, OpenAI (GPT-4o), Nodemailer.
- **Arquitectura:** lógica de negocio en `/src/server` y `/src/lib`; los route handlers de `/src/app/api` son delgados y delegan a esas capas. El esquema de datos vive en `prisma/schema.prisma`.
- **Convenciones de Código:**
  - Todo cambio de esquema de datos pasa por una migración de Prisma versionada (`prisma migrate dev`), nunca edición manual de la base de datos.
  - Validación de entrada en cada endpoint con Zod (`/src/validators`) antes de tocar la base de datos.
  - Autorización explícita por rol (`ADMIN`, `STAFF`, `STUDENT`) en cada endpoint sensible; nunca confiar solo en el middleware de UI.
- **Patrones:**
  - Webhooks de Stripe verifican firma (`stripe.webhooks.constructEvent`) antes de procesar el evento.
  - Operaciones que afectan pagos o certificados son idempotentes (usar claves únicas / upsert donde aplique).
  - Envío de emails transaccionales centralizado vía Nodemailer en `/src/server` o `/src/lib`, nunca inline en el route handler.
- **Prohibiciones/Límites:**
  - No expongas claves de Stripe, OpenAI o R2 en código de cliente ni en respuestas de API.
  - No hagas queries de Prisma directamente desde componentes de UI; siempre a través de la capa de servidor.
  - No proceses pagos ni emitas certificados sin los checks de negocio correspondientes (ver `context.md`, sección Reglas de Negocio Críticas).
  - No modifiques `prisma/schema.prisma` sin generar la migración correspondiente.
