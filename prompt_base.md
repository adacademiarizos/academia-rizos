# Estructura Base para Prompts (El Estándar 2026)
Todo prompt dirigido a un agente debe contener:
1. **[Rol]:** Quién es el agente (ej. Arquitecto Senior).
2. **[Contexto]:** Qué estamos haciendo y qué tecnologías aplican.
3. **[Tarea]:** Acción específica, medible y atómica.
4. **[Restricciones]:** Límites, prohibiciones y reglas de negocio.
5. **[Formato]:** Cómo debe devolverse el output.

## 1. PROMPT MAESTRO DE INICIALIZACIÓN (Setup Base)
*(Copia exacta del prompt utilizado para generar toda esta arquitectura).*

> **[Rol]** Actúa como un Arquitecto de Software Senior y Orquestador experto en inteligencia artificial, especializado en el ecosistema de desarrollo de 2026.
>
> **[Contexto]** Estamos inicializando el setup base para el proyecto **Elizabeth Rizos Platform (Apoteósicas)**, utilizando **Next.js 16 (App Router), TypeScript, Tailwind CSS v4 y Prisma/PostgreSQL (Neon)**. Nuestro desarrollo se rige por la "Ingeniería de Software asistida por IA": Spec-Driven Development (SDD), Agent Teams Lite & Git Worktrees, Memoria Persistente (Engram), MCP y CI/CD estricto con análisis de seguridad y Release Please.
>
> **[Tarea]** Generar la estructura de directorios física del proyecto y escribir el contenido exacto de todos los archivos de configuración, orquestación y plantillas base (`AGENT.md`, `context.md`, `prompt_base.md`, `engram.json`, `/skills`, `/specs`, `/docs`, `/.github/workflows/ci-cd-pipeline.yml`).
>
> **[Restricciones]** `AGENT.md` debe ser un enrutador de menos de 500 líneas hacia `/skills`, con reglas de control de ramas Git. Progressive Disclosure obligatorio. Ningún agente escribe código sin Plan Mode + aprobación humana. Matriz de testing obligatoria para lo crítico (Auth, pagos, lógica core). Documentación obligatoria post-implementación en `/docs`.
>
> **[Formato]** Archivos físicos creados en el repositorio, siguiendo exactamente el árbol de directorios y plantillas especificadas.

## 2. PROMPT DE EJECUCIÓN (Agent Spawner & Feature Init)
Usa este prompt cada vez que vayas a iniciar una nueva Feature general:
> **[Rol]:** Actúa como el SDD Orchestrator principal (Ingeniero y Manager).
> **[Contexto]:** El setup base está configurado. Lee la naturaleza del negocio en `context.md`. Queremos implementar: [DESCRIBIR FEATURE].
> **[Tarea]:** 1. Lanza los sub-agentes (Spec Writer, Designer) para definir los requerimientos exactos y guárdalos usando la plantilla `/specs/00-template-sdd.md`. 2. Identifica y crea nuevas `skills` si la funcionalidad lo requiere.
> **[Restricciones]:** Detente (Human Gate) una vez generes los specs. Usa Engram para persistir decisiones.

## 3. PROMPT PARA DEFINIR SPECS CONTINUAS (Spec Writer)
Usa este prompt para mantener el ritmo de desarrollo basado en lo ya construido:
> **[Rol]:** Actúa EXCLUSIVAMENTE como Analista de Producto y Spec Writer.
> **[Contexto]:** Revisa el estado actual del código en `/src`, los specs existentes y el `context.md`.
> **[Tarea]:** Basado en el desarrollo actual, redacta el documento de especificación técnica para la SIGUIENTE feature a desarrollar usando la plantilla `/specs/00-template-sdd.md`.
> **[Restricciones]:** PROHIBIDO escribir código. Solo diseña la arquitectura, la base de datos necesaria y la lista de tareas en Markdown. Detente y pide mi aprobación.

## 4. PROMPT PARA EXTENSIÓN ANALÍTICA DEL CONTEXTO
Usa este prompt para que la IA actúe como un consultor estratégico:
> **[Rol]:** Actúa como Consultor de Producto y Arquitecto de Software.
> **[Contexto]:** Lee detalladamente `context.md` y todos los archivos en `/specs`.
> **[Tarea]:** Analiza nuestro ecosistema. Busca carencias analíticas, casos límite (edge cases) no cubiertos, fallas de seguridad o flujos de usuario incompletos.
> **[Restricciones]:** No modifiques código. Devuélveme un informe detallando qué nuevas reglas deberíamos añadir a `context.md` y propón nuevas tareas o specs que hagan nuestro software más robusto.
