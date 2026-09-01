# Progreso y evaluaciones de estudiantes

## Fuente de verdad

El progreso académico se registra en `LessonProgress`: una lección cuenta como completada por cada estudiante. El porcentaje de un curso es `lecciones completadas / lecciones totales`; `ModuleProgress` se conserva únicamente como historial de la implementación anterior.

Al migrar, un `ModuleProgress.completed = true` crea progreso para todas las lecciones actuales de ese módulo, conservando su fecha de completado. Esta operación es idempotente.

## Tests de lección

Un administrador puede crear tests de selección múltiple en una lección, con preguntas, opciones, respuesta correcta, nota mínima e intentos permitidos. Cada intento se califica de forma automática.

- Una lección sin tests se puede marcar como terminada directamente.
- Una lección con tests solo se completa cuando todos sus tests publicados han sido aprobados.
- Agregar un test después no revoca una lección que ya estaba completada.
- Si se agotan los intentos de un test, el estudiante ve el bloqueo correspondiente y debe contactar administración.

## Examen final del curso

`FinalExam` pertenece a un curso y puede contener respuestas escritas, fotografías o videos. El estudiante solo puede enviarlo cuando haya completado el 100% de las lecciones.

Cada envío crea un `FinalExamAttempt` en estado `PENDING_REVIEW`. Administración lo corrige como `APPROVED` o `NOT_PASSED`:

- `APPROVED` genera el certificado de manera idempotente.
- `NOT_PASSED` permite el siguiente intento solo si todavía queda uno.
- Si no quedan intentos, se muestra el mensaje para contactar administración.
- Administración puede crear un `FinalExamRevalidation` para conceder intentos adicionales, únicamente tras agotar los disponibles y corregir el último como no aprobado.

## Rutas principales

- Estudiante: `/api/student/lessons/[lessonId]/tests`, `/api/student/lessons/[lessonId]/progress` y `/api/student/courses/[courseId]/final-exam`.
- Administración: `/api/admin/lessons/[lessonId]/tests` y `/api/admin/courses/[courseId]/final-exam`.

Las rutas validan acceso al curso o rol de administración según corresponda. La lógica de dominio está centralizada en `src/server/services/academy-assessment-service.ts`.
