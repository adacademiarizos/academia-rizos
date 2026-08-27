# Plan de implementación: progreso por lección y evaluación final

Especificación aprobada: `docs/superpowers/specs/2026-08-07-student-progress-design.md`

## Precondición

No iniciar cambios de producto hasta recibir aprobación explícita de este plan. La implementación se realizará en una rama y worktree propios de la funcionalidad, sin mezclar los cambios locales existentes de `feature/admin-executive-overview`.

## Resultado esperado

El único progreso académico activo será por lección. Los tests de lección serán de selección múltiple, con intentos y nota mínima independientes. Existirá un único examen final manual por curso, con estados de revisión, límite efectivo de intentos y revalidaciones individuales. El certificado solo se emitirá tras la aprobación administrativa de ese examen.

## Plan

### 1. Aislar y preparar la funcionalidad

- Crear la rama `feature/student-lesson-progress` en un worktree limpio basado en la rama de integración acordada.
- Confirmar que no hay migraciones Prisma pendientes y registrar el estado previo de las tablas académicas.
- Leer las reglas de backend, frontend y pruebas del proyecto antes de editar sus respectivas capas.

### 2. Crear el modelo canónico y una migración de datos segura

Modificar `prisma/schema.prisma` y añadir una migración Prisma dedicada.

- Añadir `LessonProgress` con la clave única `userId + lessonId`, fecha de completado y relaciones de usuario/lección.
- Añadir `LessonTest`, `LessonTestQuestion`, `LessonTestSubmission` y sus respuestas. Los tests de lección solo admitirán preguntas de selección múltiple; cada test tendrá `maxAttempts`, `passingScore`, orden y `publishedAt`.
- Añadir un único `FinalExam` por curso, `FinalExamQuestion`, `FinalExamAttempt`, `FinalExamAnswer` y `FinalExamRevalidation`.
  - Las preguntas finales admitirán `WRITTEN`, `PHOTO` y `VIDEO`.
  - Los intentos tendrán número único por estudiante/examen, estado `PENDING_REVIEW`, `APPROVED` o `NOT_PASSED`, revisor, fecha de revisión y observación.
  - Las revalidaciones guardarán estudiante, administrador que autoriza, intentos otorgados, motivo opcional y fecha.
- Mantener `ModuleProgress`, `ModuleTest`, `CourseTest`, `CourseExam` y sus entregas solo como historial durante la transición; no eliminarlos en esta migración.
- Realizar el backfill: cada `ModuleProgress.completed` crea `LessonProgress.completed` para las lecciones actuales de ese módulo, preservando `completedAt` cuando exista. Los módulos incompletos no generan avance de lección.
- Conservar los tests legados sin asociación automática. Añadir marcas de migración para que administración pueda asignar explícitamente cada test reutilizable a una lección antes de volver a publicarlo.

### 3. Centralizar las reglas en servicios de dominio

Crear `src/server/services/lesson-progress-service.ts` y `src/server/services/final-exam-service.ts`; extraer validaciones comunes a `src/lib/academy-assessment.ts` cuando convenga.

- Calcular el estado efectivo de una lección: progreso manual para lecciones sin tests; para lecciones con tests, todos los tests publicados antes de su completado deben estar aprobados. Un test creado después de una completación no revoca el progreso histórico.
- Calcular progreso derivado de módulo y curso, y los estados `IN_PROGRESS`, `READY_FOR_FINAL`, `PENDING_REVIEW`, `EXHAUSTED` y `COMPLETED`.
- Completar manualmente solo una lección sin tests; rechazar los intentos de omitir tests con un código de error estable.
- Corregir automáticamente los tests de lección, respetar el límite individual y registrar un intento inmutable con sus respuestas.
- Resolver la elegibilidad del final: 100% de lecciones completadas, sin examen aprobado, sin intento pendiente y con cupo efectivo disponible.
- Crear intentos finales y procesar revisiones dentro de transacciones. Usar la restricción única de número de intento y control de concurrencia para impedir dobles envíos.
- Permitir revalidaciones exclusivamente a estudiantes agotados, sin envío pendiente y sin examen aprobado. La suma de sus concesiones incrementa el cupo efectivo sin alterar el historial.
- Emitir certificado mediante el servicio existente de forma idempotente solo al aprobar el final. Mover la notificación de “curso completado” a esa transición real y eliminar el disparo incorrecto por módulo.

### 4. Exponer una API única, autorizada y compatible con el nuevo flujo

Crear rutas bajo estas superficies, usando `authorizeCourseAccessByCourseId` y controles de ADMIN en toda mutación administrativa:

- Estudiante: progreso por curso/lección, completar una lección sin tests, listar/consultar/enviar tests de lección, consultar/enviar examen final e historial propio.
- Administración: CRUD de tests y preguntas de una lección; CRUD del examen final y de preguntas escritas/foto/video; cola de entregas, decisión de revisión y concesión de revalidación.
- Validar pertenencia entre curso, módulo, estilo, lección, test, pregunta y entrega en cada endpoint. Validar respuestas completas, opciones reales, tipos MIME y límites de tamaño antes de guardar.
- Retirar las rutas de mutación de progreso por módulo y los flujos de tests de módulo/curso de la experiencia activa. Las rutas legadas que deban subsistir para historial devolverán una respuesta de transición explícita y no permitirán crear progreso nuevo.

### 5. Reorganizar la administración de contenido y correcciones

Actualizar `src/app/(dashboard)/admin/courses/[courseId]/edit/page.tsx` mediante componentes extraídos para evitar ampliar el editor monolítico.

- Crear componentes de autoría de tests de lección dentro de cada lección: formulario de test, preguntas de selección múltiple, opciones, respuesta correcta, nota mínima e intentos.
- Reemplazar la sección de “Tests del curso” por una sección única de “Examen final”, con editor de preguntas escritas, foto y video y configuración del límite base de intentos.
- Reemplazar `src/app/(dashboard)/admin/courses/components/CourseExamReviewView.tsx` y las tarjetas de `admin/certificates/review/ReviewActions.tsx` por una sola cola de revisión del final que muestre respuestas, archivos, intento, nota y comentario.
- Añadir el control de revalidación en el historial del estudiante agotado: cantidad de intentos extra, motivo, confirmación y resultado visible.
- Incorporar el asistente de migración de tests legados: selección de la lección destino y clonación segura de preguntas compatibles; los datos originales permanecen históricos.

### 6. Actualizar el recorrido del estudiante

- Refactorizar `src/app/(marketing)/learn/[courseId]/modules/[moduleId]/page.tsx` para que la barra lateral y el reproductor consuman estado por lección y muestren la acción o los tests de la lección activa.
- Reemplazar `src/app/components/ModuleTestSubmission.tsx` por un componente de test de lección de selección múltiple que muestre resultado e intentos restantes.
- Actualizar `src/app/(marketing)/learn/[courseId]/page.tsx` para calcular y presentar porcentaje por lección, módulos derivados y el estado del examen final.
- Crear una pantalla exclusiva del examen final con sus preguntas, carga de foto/video, estado de envío y mensajes de pendiente, intento disponible, agotado o aprobado.
- Reutilizar el flujo de carga con feedback existente para evidencias; una carga incompleta nunca envía el examen ni consume intento.

### 7. Alinear dashboard, actividades, notificaciones y certificados

- Actualizar `src/server/services/analytics-service.ts`, `src/app/components/StudentDashboard.tsx`, los perfiles públicos y los tipos de `src/types/academy.ts` para contar lecciones, calcular los cinco estados de curso y dejar de depender de `ModuleProgress` o de entregas legadas.
- Actualizar `NotificationService` y `AchievementService` para registrar `LESSON_COMPLETED`, revisión final, revalidación y curso realmente completado. Eliminar la notificación de finalización emitida al completar cualquier unidad intermedia.
- Ajustar `certificate.service.ts` y las rutas de certificados para que su condición de emisión y su representación provengan del intento final aprobado.
- Actualizar las consultas del dashboard ejecutivo sin sobrescribir sus cambios en curso; sustituir contadores legados por los modelos canónicos al integrar la rama correspondiente.

### 8. Actualizar datos auxiliares, documentación y limpieza de compatibilidad

- Actualizar `prisma/seed.ts` y `prisma/cleanup.ts` con lecciones, tests de lección, intentos finales y revalidaciones de ejemplo.
- Actualizar `docs/ACADEMY_CONTENT_MODEL.md`, `docs/ARCHITECTURE.md` y la documentación operativa de administración para describir el modelo canónico y el procedimiento de migración.
- Conservar el diseño aprobado como referencia y documentar los endpoints retirados, la política de publicación tardía de tests y la revalidación.

### 9. Pruebas y verificación

- Añadir pruebas unitarias para los servicios de progreso, corrección de tests, elegibilidad, cálculo de cupo y estados del curso.
- Añadir pruebas de integración para todas las rutas mutables: autorización, relación de recursos, acceso vencido, respuestas inválidas, límite de intentos, bloqueo pendiente, revisión, revalidación y emisión única del certificado.
- Añadir pruebas de migración/backfill, incluida la preservación de `completedAt` y la no creación de progreso desde módulos incompletos.
- Actualizar `src/server/services/__tests__/analytics-service.test.ts`, `tests/academy-content.test.ts`, datos de prueba y mocks que dependan de módulos o evaluaciones legadas.
- Ejecutar `npx prisma validate --schema prisma/schema.prisma`, las pruebas focalizadas, `npm test`, `npm run lint`, `npx tsc --noEmit` y `npm run build`. Registrar cualquier fallo preexistente separado de esta funcionalidad.

## Criterios de aceptación

1. El porcentaje visible de un curso corresponde a sus lecciones completadas, no a sus módulos.
2. Ninguna lección con tests se puede completar hasta aprobar todos sus tests de selección múltiple.
3. Cada test de lección respeta su propio número máximo de intentos.
4. El final no se puede enviar antes del 100% de avance ni mientras exista una entrega pendiente.
5. Administración decide el resultado final y solo una decisión aprobada genera certificado.
6. Un estudiante agotado ve la instrucción de contactar a administración; una revalidación individual le concede solo el cupo configurado.
7. Los datos antiguos se conservan y el avance de módulos completados se transfiere sin regresiones.
8. Las operaciones críticas resisten solicitudes concurrentes y están cubiertas por pruebas automatizadas.
