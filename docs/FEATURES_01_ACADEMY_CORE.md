# FASE 1: Academia de Rizos - Sistema de Cursos

**Prioridad**: 🔴 CRÍTICO
**Estimación**: ~2-3 semanas de desarrollo
**Stack**: Next.js, Prisma, Stripe, S3/Storage, PDF generation

---

## 1️⃣ descripción General

El usuario debería poder:

**Como estudiante:**
- Navegar catálogo de cursos disponibles
- Ver detalles: trailer, descripción, precio, duración
- Comprar un curso (pago único) o alquilarlo (acceso temporal)
- Acceder a contenido: módulos de video, recursos PDF, tests
- Marcar módulos como completados
- Responder test con preguntas múltiple choice + texto + evidencias
- Recibir retroalimentación y ver estado de evaluación
- Descargar certificado PDF con QR cuando aprueba

**Como admin:**
- Crear/editar/eliminar cursos
- Subir videos de módulos (transcripciones)
- Subir recursos (PDFs, imágenes)
- Crear tests con builder UI
- Revisar submissions (respuestas + evidencias)
- Aprobar o solicitar revisión
- Generar certificados PDF
- Ver estadísticas de enrolamiento y progreso

**Como visitante:**
- Ver landing pages de cursos
- Comprar/alquilar curso
- Validar certificados en URL pública

---

## 2️⃣ historias de Usuario

### HU-A1: Estudiante Descubre Catálogo de Cursos

```
COMO ESTUDIANTE
QUIERO: Ver un catálogo de todos los cursos disponibles
PARA QUE: Pueda elegir cuál quiero comprar o alquilar

CRITERIOS DE ACEPTACIÓN:
✓ Página /courses lista todos los cursos activos
✓ Cada curso muestra: thumbnail, título, descripción corta, precio
✓ Puedo ver si es compra ilimitada o alquiler (duración)
✓ Click en curso me lleva a landing page detallada
✓ Si estoy autenticado, puedo ver si ya lo compré
✓ Filtros opcionales: categoría, precio, duración

MOCKITO:
Grid de cards con cursos
[Thumbnail] [Título] [Desc] [Precio] [Botón]
```

---

(contenido restante del archivo original omitido por brevedad)
