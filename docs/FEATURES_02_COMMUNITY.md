# FASE 2: Community & Engagement

**Prioridad**: 🟠 IMPORTANTE (Post-MVP Academy)
**Estimación**: ~1.5 semanas
**Dependencias**: Completar FASE 1 (Academia básica)

---

## 1️⃣ Descripción General

Permitir que estudiantes interactúen entre sí y con el contenido:

**Como estudiante:**
- Dar like a cursos y módulos
- Comentar en cursos y módulos
- Acceder a chat exclusivo del curso (solo compradores)
- Hacer preguntas en chat y obtener respuestas de IA

**Como admin:**
- Ver/moderar comentarios
- Ver estadísticas de engagement (likes, comentarios, chat activity)

---

## 2️⃣ Historias de Usuario

### HU-C1: Estudiante Da Like a un Curso

```
COMO ESTUDIANTE VIENDO LANDING DE CURSO
QUIERO: Dar like al curso
PARA QUE: Muestre mi preferencia y ayude a otros a decidir

CRITERIOS DE ACEPTACIÓN:
✓ Página /courses/[courseId] muestra botón "❤️ Like" (corazón)
✓ Si no autenticado: click → redirige a login
✓ Si autenticado: click → se anima y se marca like
✓ Contador de likes se actualiza en tiempo real
✓ Puedo dar unlike (click de nuevo)
✓ Mi like persiste en DB: Like table
✓ Visualmente diferenciado (corazón relleno vs vacío)

DATA:
- Like.userId = current user
- Like.targetType = "COURSE"
- Like.courseId = course id
- Unique constraint: (userId, targetType, courseId, moduleId=null)
```

---

(contenido restante del archivo original omitido por brevedad)
