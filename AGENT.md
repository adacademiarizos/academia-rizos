# Orquestador del Proyecto: Elizabeth Rizos Platform (Apoteósicas)

Eres el agente principal. NUNCA ejecutes código sin antes elaborar un plan (Plan Mode) y pedir mi aprobación (Human in the Loop). Protege tu ventana de contexto: no leas archivos que no necesites, no cargues skills que la tarea actual no requiere, y evita la amnesia guardando aprendizajes relevantes en `engram.json`.

## Flujo de Trabajo y Control de Versiones (Git)
- El repositorio SIEMPRE debe mantener 3 ramas base: `main` (producción), `staging` (pre-producción) y `dev` (desarrollo integrativo).
- **Regla estricta de Features:** cada nueva funcionalidad o modificación DEBE trabajarse en una rama aislada con la nomenclatura `feature/[nombre-de-la-feature]`.
- El flujo de trabajo implica hacer todos los commits y push sobre la rama `feature/*` correspondiente. NUNCA se hace push directo a `dev` ni a `main`.
- Al terminar la feature, el código se sube y se aprueba vía Pull Request/Merge hacia `dev`. De `dev` a `staging` y de `staging` a `main` solo vía PR revisado.
- Ningún PR hacia `main` o `dev` se mergea sin pasar el pipeline de `/.github/workflows/ci-cd-pipeline.yml` (tests + security review).

## Human in the Loop (obligatorio)
- Ningún agente escribe código de producción sin antes: 1) entrar en Plan Mode, 2) presentar el plan, 3) recibir mi aprobación explícita.
- Excepciones permitidas sin plan previo: lectura/exploración de código, redacción de specs, documentación posterior a una feature ya aprobada.

## Skills Registry (Carga de contexto bajo demanda — Progressive Disclosure)
Regla general: NO leas ninguna skill "por si acaso". Lee únicamente la que corresponda a la tarea puntual que vas a ejecutar, y solo en el momento en que la necesites.

- Modificaciones en la Interfaz (Frontend / Next.js / Tailwind) -> Lee `/skills/frontend-rules.md`
- Modificaciones en Lógica, API Routes o Base de Datos (Backend / Prisma) -> Lee `/skills/backend-rules.md`
- Creación de Nuevas Features -> Lee `/specs/00-template-sdd.md`
- Actualización de Documentación (obligatoria post-implementación) -> Lee `/skills/documentation-rules.md`
- Integraciones o cambios relacionados con Stripe (checkout, webhooks, billing, conexión, tax, treasury) -> Lee `.agents/skills/stripe-best-practices/SKILL.md` (referencias detalladas en `.agents/skills/stripe-best-practices/references/`)

## Matriz de Testing Obligatoria
No todo requiere test automatizado, pero lo crítico SIEMPRE sí:

| Área | Obligatorio | Tipo de test |
|---|---|---|
| Autenticación (NextAuth, roles ADMIN/STAFF/STUDENT) | Sí | Unitario + integración |
| Pagos (Stripe Checkout, webhooks, comisiones) | Sí | Unitario + integración |
| Lógica core de reservas (disponibilidad, billing rules) | Sí | Unitario + integración |
| Emisión y verificación de certificados | Sí | Unitario |
| Endpoints de API (`/src/app/api`) que mutan datos | Sí | Integración |
| Componentes puramente visuales / marketing | No (verificación manual con `/verify` o `/run`) | - |
| Contenido estático / copy | No | - |

Los tests viven en `/tests` o junto al código en `__tests__`. Ningún PR hacia `dev` se aprueba si rompe la suite existente.

## Documentación Obligatoria (Spec Anchored)
Al terminar de implementar CUALQUIER funcionalidad es OBLIGATORIO:
1. Leer `/skills/documentation-rules.md`.
2. Generar/actualizar el documento correspondiente en `/docs`.
3. Registrar la decisión relevante en `engram.json`.

No se considera una feature "terminada" hasta que este paso se cumple.

## Criterios para crear y gestionar nuevas Skills
- **Cuándo crearla:** si introduces un nuevo dominio técnico, framework, herramienta externa (ej. un nuevo proveedor de pagos, un nuevo servicio de IA) o patrón arquitectónico que supere las responsabilidades del enrutador base.
- **Cómo crearla:** crea un archivo `[nombre-skill]-rules.md` en `/skills`. Toda skill debe contener estrictamente: 1. Stack Tecnológico, 2. Convenciones de Código, 3. Patrones, y 4. Prohibiciones/Límites. Actualiza este `AGENT.md` añadiendo la referencia al nuevo archivo en la sección Skills Registry.

## Reglas Multi-Agente
Si debes spawnear sub-agentes en paralelo, utiliza `Git Worktrees` para aislar el entorno de cada uno y evitar colisiones de archivos. Al finalizar, cada agente debe:
1. Archivar su aprendizaje en `engram.json`.
2. Actualizar `/docs` si tocó una funcionalidad.
3. Dejar su rama `feature/*` lista para PR hacia `dev`, nunca mergeada directamente.
