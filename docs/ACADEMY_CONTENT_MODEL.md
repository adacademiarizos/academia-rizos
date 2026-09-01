# Modelo de contenido de la academia

Cada curso define su estructura al crearse y no puede cambiarse después:

- `MODULES`: Curso → módulos → lecciones.
- `STYLES`: Curso → estilos → lecciones.
- `BOTH`: dos secciones independientes: módulos y estilos.

Un módulo puede tener un video propio y sus lecciones directas. Un estilo no contiene módulos: agrupa directamente sus lecciones. Cada lección pertenece exclusivamente a un módulo o a un estilo.

## Videos y recursos

Los videos se cargan desde el editor y se almacenan en Cloudflare R2. La plataforma guarda la referencia interna del archivo subido en `videoFileUrl`; el administrador no pega enlaces de video manualmente.

No hay transcripciones en el modelo de contenido ni en el reproductor.

## Cursos existentes

Los cursos creados con la estructura anterior muestran un asistente de migración la primera vez que se editan. El administrador selecciona si conserva el contenido como módulos, lo convierte a estilos o habilita ambas secciones. Esta elección no publica ni descarta contenido automáticamente.

## Progreso del estudiante

- Los módulos conservan su progreso por módulo.
- Un estilo se completa cuando el estudiante completa sus lecciones directas.
- El panel de aprendizaje presenta módulos y estilos en bloques separados cuando el curso usa ambos.

## Rutas principales

- Editor del curso: `/admin/courses/[courseId]/edit`
- Editor de módulo: `/admin/courses/[courseId]/modules/[moduleId]/edit`
- Editor de estilo: `/admin/courses/[courseId]/styles/[styleId]/edit`
- Reproductor de módulo: `/learn/[courseId]/modules/[moduleId]`
- Reproductor de estilo: `/learn/[courseId]/styles/[styleId]`
