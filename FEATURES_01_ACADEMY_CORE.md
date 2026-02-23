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

### HU-A2: Estudiante Ve Landing Page de Curso

```
COMO ESTUDIANTE
QUIERO: Ver página detallada de un curso antes de comprarlo
PARA QUE: Pueda decidir si vale la pena

CRITERIOS DE ACEPTACIÓN:
✓ Página /courses/[courseId] con información completa
✓ Trailer video (si existe)
✓ Descripción extensa
✓ Lista de módulos (sin acceso a contenido)
✓ Número de horas de contenido
✓ Precio y tipo (compra/alquiler con duración)
✓ Botón "Comprar" o "Alquilar"
✓ Sección de reviews/testimonios (opcional MVP)
✓ Likes y comentarios (si está autenticado)

FLUJO:
1. Usuario no autenticado ve página
2. Click en "Comprar" → redirige a login/signup
3. Usuario autenticado hace click → inicia pago
```

---

### HU-A3: Estudiante Compra/Alquila un Curso

```
COMO ESTUDIANTE
QUIERO: Comprar un curso de forma simple
PARA QUE: Acceda inmediatamente al contenido

CRITERIOS DE ACEPTACIÓN:
✓ Click en "Comprar/Alquilar" abre checkout de Stripe
✓ Monto mostrado incluye las fees (estimadas)
✓ Confirmación por email con:
  - Nombre del curso
  - Tipo de compra (compra/alquiler por X días)
  - Monto pagado
  - Fecha de expiración (si aplica)
  - Link a "Ir al curso"
✓ Se crea registro CourseAccess en DB
✓ Si es alquiler: acceso hasta fecha límite
✓ Si es compra: acceso permanente (rentalDays = null)
✓ Página de confirmación con link al curso

WEBHOOK:
- checkout.session.completed → crea CourseAccess
- envía email de confirmación + recibo
```

---

### HU-A4: Estudiante Accede al Área de Aprendizaje

```
COMO ESTUDIANTE CON ACCESO
QUIERO: Entrar al área de aprendizaje del curso
PARA QUE: Pueda ver módulos, recursos y tests

CRITERIOS DE ACEPTACIÓN:
✓ Página /learn/[courseId] mostrando:
  - Título del curso
  - Barra de progreso (% completado)
  - Menú lateral o tabs con:
    § Módulos (lista)
    § Recursos (PDFs, imágenes)
    § Test (botón si todos módulos completados)
  - Si acceso expirado: mensaje "Acceso vencido el X"
✓ Click en módulo abre player
✓ Marca automática al 75% visualizado
✓ Guardamos último módulo visto

PERMISOS:
- Solo usuario con CourseAccess válido puede acceder
- Si alquiler expirado: bloquea acceso
```

---

### HU-A5: Estudiante Mira un Módulo de Video

```
COMO ESTUDIANTE EN CURSO
QUIERO: Ver un módulo de video con controles
PARA QUE: Pueda aprender el contenido paso a paso

CRITERIOS DE ACEPTACIÓN:
✓ Página /learn/[courseId]/modules/[moduleId] con:
  - Reproductor de video
  - Título y descripción del módulo
  - Control de volumen y pantalla completa
  - Progreso visualizado en video
  - Botones anterior/siguiente módulo
  - Sección de likes/comentarios debajo
✓ Al alcanzar 75%: se marca como completado
✓ Se guarda en ModuleProgress (userId, moduleId, completed)
✓ Barra de progreso del curso se actualiza
✓ Puedo dejar comentarios si estoy autenticado
✓ Puedo dar like al módulo

DATOS NECESARIOS:
- Module.videoUrl (S3 o similar)
- Module.transcript (para IA)
```

---

### HU-A6: Estudiante Descarga Recursos

```
COMO ESTUDIANTE EN CURSO
QUIERO: Descargar archivos PDF o imágenes del curso
PARA QUE: Pueda consultarlos offline o guardarlos

CRITERIOS DE ACEPTACIÓN:
✓ Sección /learn/[courseId]/resources lista:
  - PDFs (con ícono de PDF)
  - Imágenes (con thumbnail)
✓ Click descarga archivo
✓ Validación: solo si tiene CourseAccess
✓ Logs de descarga (opcional)

DATOS:
- Resource.fileUrl (S3 presigned URL)
- Resource.fileName
- Resource.type (PDF | IMAGE)
```

---

### HU-A7: Estudiante Resuelve Test de Evaluación

```
COMO ESTUDIANTE CON MÓDULOS COMPLETADOS
QUIERO: Responder un test para validar aprendizaje
PARA QUE: Reciba certificado si apruebo

CRITERIOS DE ACEPTACIÓN:
✓ Botón "Test" solo visible si 100% módulos completados
✓ Test contiene:
  - Preguntas múltiple choice
  - Preguntas abiertas (texto)
  - Campo para subir evidencias (fotos, videos)
✓ Interfaz clara con progreso (X/N preguntas)
✓ Submit envía Submission a revisión admin
✓ Email al estudiante: "Tu evaluación fue enviada"
✓ Email al admin: "Nueva evaluación pendiente"
✓ Página de confirmación: "Waiting for review"

VALIDACIÓN:
- No permitir doble envío (único por usuario + curso)
- Validar type de evidencias (jpg, png, mp4, etc)
```

---

### HU-A8: Admin Revisa y Aprueba Submissions

```
COMO ADMIN
QUIERO: Revisar las evaluaciones enviadas
PARA QUE: Pueda decidir si aprueban o pedir revisión

CRITERIOS DE ACEPTACIÓN:
✓ Dashboard /admin/reviews muestra:
  - Tabs: PENDING | REVISION_REQUESTED | APPROVED
  - Lista de submissions con:
    § Nombre estudiante
    § Curso
    § Fecha envío
    § Estado actual
✓ Click en submission abre modal con:
  - Respuestas a cada pregunta
  - Evidencias subidas (preview images, videos)
  - Botones: [Aprobar] [Solicitar Revisión]
  - Campo para feedback (si solicita revisión)
✓ Al aprobar:
  - Status → APPROVED
  - Se genera certificado PDF
  - Se envia email al estudiance con cert
  - Se crea record Certificate
✓ Al solicitar revisión:
  - Email al estudiante con feedback
  - Status = REVISION_REQUESTED
  - Estudiante puede reenviar

FLUJO APROBACIÓN:
Admin: "Revisar" → ve respuestas/evidencias → "Aprobar"
  → Sistema genera PDF + QR
  → Envía email estudiante
  → Marca submission APPROVED
```

---

### HU-A9: Certificado PDF con QR

```
Como admin APRUEBA una evaluación

SISTEMA GENERA:
✓ PDF con:
  - Logo/branding (cobre, beige)
  - "Certificado de Finalización"
  - Nombre del estudiante
  - Nombre del curso
  - Fecha de emisión
  - Código único (alphanumeric)
  - QR code apuntando a /verify/certificate/[code]
✓ PDF se guarda en S3 o similar
✓ URL se guarda en Certificate.pdfUrl
✓ Email al estudiante incluye:
  - PDF adjunto
  - Link de descarga
  - Instrucciones para compartir

VERIFICACIÓN PÚBLICA:
✓ URL /verify/certificate/[code] muestra:
  - Nombre estudiante ✓
  - Curso ✓
  - Fecha emisión ✓
  - "Valid" o "Invalid"
  - QR que linkedea a esta misma página

SEGURIDAD:
- Code es único (UUID o similar)
- Verificable sin login
```

---

### HU-A10: Estudiante Ve Certificado en Perfil

```
COMO ESTUDIANTE
QUIERO: Ver mis certificados en una sección
PARA QUE: Pueda descargarlos y compartirlos

CRITERIOS DE ACEPTACIÓN:
✓ Página /profile (o /my-certificates )
✓ Lista certificados emitidos:
  - Nombre curso
  - Fecha emisión
  - Botón descargar PDF
  - Botón copiar link de verificación
  - Botón compartir en RRSS (opcional)
✓ Solo certificados válidos (valid = true)
```

---

## 3️⃣ Requerimientos técnicos

### Base de Datos (Prisma Models)

Las siguientes tablas ya están en el schema pero VACÍAS:

```python
Model Course
Model Module
Model ModuleProgress
Model CourseAccess
Model Resource
Model Test
Model Submission
Model Certificate
```

**Action Items:**
- ✓ Schema ya existente, solo validar que es correcto
- ✓ Hacer migration si no existe
- ✓ Seedear datos de prueba (1-2 cursos)

---

### Almacenamiento de Video y Archivos

**Requerimiento:** Integración S3 o Cloudflare R2

- Videos: ~500MB-2GB por módulo
- PDFs/Imagenes: ~5-50MB resources
- Certificados PDF: ~1MB cada uno

**Opciones:**
1. AWS S3 (industry standard, aber pricey)
2. Cloudflare R2 (competitivo, same API)
3. Supabase Storage (simplista, bueno para MVP)
4. MinIO (self-hosted, si quieres control total)

**Recommendation:** Cloudflare R2 (mejor relación precio/performance)

**Setup necesario:**
```
.env.local:
NEXT_PUBLIC_R2_BUCKET_NAME=elizabeth-courses
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ACCOUNT_ID=...
R2_ENDPOINT=...
```

---

### Generación de PDFs (Certificados)

**Requerimiento:** PDFs profesionales con QR

**Opciones:**
1. **PDFKit** (Node.js, simple)
2. **Puppeteer** (headless Chrome, HTML → PDF, más flexible)
3. **wkhtmltopdf** (standalone, robusto)
4. **React-PDF** (React components → PDF, moderno)

**Recommendation:** **Puppeteer** (more flexible para diseños complejos)

```bash
npm install puppeteer @types/puppeteer
```

**Librería QR:**
```bash
npm install qrcode  # Ya instalada!
```

---

### APIs Necesarias

Nuevas rutas a construir:

```
[COURSES - PUBLIC]
GET  /api/courses              → Lista todos cursos
GET  /api/courses/[courseId]   → Detalles curso

[COURSE ACCESS]
GET  /api/course-access/[courseId]   → Verificar si tengo acceso
POST /api/course-access              → Crear acceso (post-pago)

[MODULES & LEARNING]
GET  /api/courses/[courseId]/modules           → Listar módulos
POST /api/modules/[moduleId]/progress          → Marcar completado
GET  /api/modules/[moduleId]                   → Detalles módulo

[RESOURCES]
GET  /api/courses/[courseId]/resources         → Listar recursos
POST /api/resources/upload                     → Admin sube recurso

[TESTS & EVALUATION]
GET  /api/courses/[courseId]/test              → Obtener estructura test
POST /api/submissions                          → Enviar respuestas + evidencias
GET  /api/submissions/[submissionId]           → Admin revisa

[CERTIFICATES]
GET  /api/certificates                         → Mis certificados
POST /api/admin/certificates/[submissionId]    → Admin aprueba y genera
GET  /verify/certificate/[code]                → Verificación pública

[ADMIN COURSE MANAGEMENT]
POST   /api/admin/courses                      → Crear curso
PUT    /api/admin/courses/[courseId]           → Editar curso
DELETE /api/admin/courses/[courseId]           → Eliminar curso
POST   /api/admin/courses/[courseId]/modules   → Crear módulo
PUT    /api/admin/courses/[courseId]/modules/[moduleId]  → Editar
DELETE /api/admin/courses/[courseId]/modules/[moduleId]  → Eliminar
POST   /api/admin/courses/[courseId]/test      → Crear/editar test
```

---

### Componentes UI necesarios

**Páginas:**
- `src/app/(academy)/courses` → Catálogo
- `src/app/(academy)/courses/[courseId]` → Landing
- `src/app/(academy)/learn/[courseId]` → Área de aprendizaje
- `src/app/(academy)/learn/[courseId]/modules/[moduleId]` → Player
- `src/app/(academy)/learn/[courseId]/resources` → Recursos
- `src/app/(academy)/learn/[courseId]/test` → Test
- `src/app/(academy)/my-certificates` → Mis certs
- `src/app/verify/certificate/[code]` → Verificar pública

**Componentes:**
- `CourseCard` → Card para listado
- `CourseHero` → Hero sección landing
- `VideoPlayer` → Reproductor de módulo
- `TestForm` → Formulario test
- `SubmissionReview` → Admin review modal
- `CertificatePreview` → Preview PDF

**Dashboard Admin:**
- `/admin/courses` → CRUD cursos
- `/admin/courses/[courseId]` → Editar detalles
- `/admin/courses/[courseId]/modules` → Gestionar módulos
- `/admin/courses/[courseId]/test` → Builder test
- `/admin/reviews` → Ver submissions

---

### Integración Stripe (Cambios)

Actualmente el checkout maneja **citas**.

Necesitamos extender para que maneje **cursos** también:

```typescript
// Existing: appointment checkout
type CheckoutType = 'appointment' | 'paymentLink'

// NEW: add 'course' type
type CheckoutType = 'appointment' | 'paymentLink' | 'course'

// API: /api/stripe/checkout
Interface CheckoutRequest {
  type: 'course' | ...
  courseId?: string
  rentalDays?: number  // si aplica
}
```

**Webhook handling:**
- Si `type=course` en Payment.metadata:
  - Crear CourseAccess
  - No requiere appointment
  - Set accessUntil = now() + rentalDays (si aplica)

---

## 4️⃣ Checklist de Implementación

### ETAPA 1: Configuración Base (Semana 1)

- [ ] Verificar/completar Prisma schema (Course, Module, etc.)
- [ ] Ejecutar migration
- [ ] Crear 2-3 cursos seed de prueba
- [ ] Setup almacenamiento (Cloudflare R2)
  - [ ] Crear bucket
  - [ ] Guardar credenciales en `.env.local`
  - [ ] Crear función helper `uploadToR2()`
- [ ] Instalar librerías necesarias:
  - [ ] `puppeteer` (PDF generation)
  - [ ] SDK R2/S3 (ya tiene stripe, auth, etc.)
- [ ] Crear tipos TypeScript para Course/Module/Test
- [ ] Crear validators Zod para course data

**Archivos a crear/modificar:**
```
src/lib/storage.ts          → Funciones R2 upload/download
src/lib/pdf.ts              → Generación PDF certs
src/types/course.ts         → Tipos Course, Module, Test, etc.
src/validators/course.ts    → Zod schemas
```

---

### ETAPA 2: APIs Backend (Semana 1.5)

- [ ] `GET /api/courses` → listar público
- [ ] `GET /api/courses/[courseId]` → detalles
- [ ] `POST /api/course-access` → crear acceso (webhook)
- [ ] `GET /api/course-access/[courseId]` → verificar acceso
- [ ] `GET /api/courses/[courseId]/modules` → listar módulos
- [ ] `POST /api/modules/[moduleId]/progress` → marcar completado
- [ ] `POST /api/submissions` → enviar test + evidencias
- [ ] `GET /api/certificates` → mis certificados

**Archivos a crear:**
```
src/app/api/courses/route.ts
src/app/api/courses/[courseId]/route.ts
src/app/api/course-access/route.ts
src/app/api/submissions/route.ts
src/app/api/certificates/route.ts
```

---

### ETAPA 3: Frontend - Catálogo & Landing (Semana 1.5)

- [ ] Página `/courses` (catálogo)
  - [ ] Componente `CourseCard`
  - [ ] Grid responsive
  - [ ] Filtros básicos
- [ ] Página `/courses/[courseId]` (landing)
  - [ ] Componente `CourseHero` (trailer, título, desc)
  - [ ] Sección módulos (preview)
  - [ ] Botón "Comprar/Alquilar"
  - [ ] Likes y comentarios

**Archivos a crear:**
```
src/app/(academy)/courses/page.tsx
src/app/(academy)/courses/[courseId]/page.tsx
src/components/academy/CourseCard.tsx
src/components/academy/CourseHero.tsx
```

---

### ETAPA 4: Frontend - Área de Aprendizaje (Semana 2)

- [ ] Página `/learn/[courseId]` (dashboard curso)
  - [ ] Barra progreso
  - [ ] Tabs: Módulos, Recursos, Test
  - [ ] Validar acceso (CourseAccess)
- [ ] Página `/learn/[courseId]/modules/[moduleId]` (player)
  - [ ] Componente `VideoPlayer`
  - [ ] Controles volumen, pantalla completa
  - [ ] Likes y comentarios
  - [ ] Botones anterior/siguiente
- [ ] Página `/learn/[courseId]/resources`
  - [ ] Listar recursos
  - [ ] Descargar PDF/imágenes

**Archivos a crear:**
```
src/app/(academy)/learn/[courseId]/page.tsx
src/app/(academy)/learn/[courseId]/modules/[moduleId]/page.tsx
src/app/(academy)/learn/[courseId]/resources/page.tsx
src/components/academy/VideoPlayer.tsx
src/components/academy/ResourcesList.tsx
```

---

### ETAPA 5: Test & Evaluación (Semana 2)

- [ ] Página `/learn/[courseId]/test` (test form)
  - [ ] Renderizar preguntas según schema
  - [ ] Multiple choice, text, file upload
  - [ ] Validar 100% módulos antes de mostrar
  - [ ] Submit envía Submission
- [ ] Página de confirmación post-envío

**Archivos a crear:**
```
src/app/(academy)/learn/[courseId]/test/page.tsx
src/components/academy/TestForm.tsx
src/components/academy/EvidenceUpload.tsx
```

---

### ETAPA 6: Certificados (Semana 2.5)

- [ ] Función generación PDF (puppeteer)
  - [ ] Template HTML certificado
  - [ ] QR generación e inserción
- [ ] Admin API: POST `/api/admin/certificates/[submissionId]/approve`
  - [ ] Genera PDF
  - [ ] Sube a R2
  - [ ] Crea record Certificate
  - [ ] Envía email estudiante
- [ ] Página verificación pública: `/verify/certificate/[code]`
  - [ ] Muestra detalles
  - [ ] Valida código
- [ ] Página `/profile` o `/my-certificates`
  - [ ] Lista mis certificados
  - [ ] Botones descargar/compartir

**Archivos a crear:**
```
src/app/(academy)/my-certificates/page.tsx
src/app/verify/certificate/[code]/page.tsx
src/server/services/certificate-service.ts
src/lib/pdf.ts (actualizar, completar)
```

---

### ETAPA 7: Admin Dashboard - Cursos (Semana 2.5)

- [ ] Página `/admin/courses` (CRUD cursos)
  - [ ] Tabla cursos
  - [ ] Form crear/editar
  - [ ] Delete
- [ ] Página `/admin/courses/[courseId]/modules` (CRUD módulos)
  - [ ] Tabla módulos con orden
  - [ ] Form crear módulo:
    - [ ] Título, descripción
    - [ ] Upload video a R2
    - [ ] Transcript/descripción para IA
- [ ] Página `/admin/courses/[courseId]/resources` (upload recursos)
  - [ ] Upload PDF/imágenes
  - [ ] Listar
  - [ ] Delete
- [ ] Página `/admin/courses/[courseId]/test` (test builder)
  - [ ] UI para crear preguntas
  - [ ] Multiple choice, text, file upload
  - [ ] Preview

**Archivos a crear:**
```
src/app/(dashboard)/admin/courses/page.tsx
src/app/(dashboard)/admin/courses/[courseId]/page.tsx
src/app/(dashboard)/admin/courses/[courseId]/modules/page.tsx
src/app/(dashboard)/admin/courses/[courseId]/test/page.tsx
src/components/dashboard/CourseForm.tsx
src/components/dashboard/ModuleForm.tsx
src/components/dashboard/TestBuilder.tsx
```

---

### ETAPA 8: Admin Dashboard - Reviews (Semana 3)

- [ ] Página `/admin/reviews` (submission review)
  - [ ] Tabs: PENDING, REVISION_REQUESTED, APPROVED
  - [ ] Tabla con submissions
  - [ ] Click abre modal/panel detalle
  - [ ] Ver respuestas + evidencias
  - [ ] Botones: Aprobar, Solicitar Revisión
  - [ ] Email enviado al aprobar/rechazar

**Archivos a crear:**
```
src/app/(dashboard)/admin/reviews/page.tsx
src/components/dashboard/SubmissionReview.tsx
src/components/dashboard/ReviewModal.tsx
```

---

### ETAPA 9: Email Transaccionales

- [ ] Template: Confirmación compra curso
- [ ] Template: Certificado listo (con adjunto PDF)
- [ ] Template: Solicitud revisión test
- [ ] Implementación en webhooks Stripe

**Archivos a crear/modificar:**
```
src/lib/mail.ts (agregar templates)
src/server/actions/send-course-receipt.ts
src/server/actions/send-certificate-email.ts
```

---

### ETAPA 10: Testing & Pulimiento (Semana 3)

- [ ] Validar flujo compra → acceso → aprendizaje → test → certificado
- [ ] Revisar permisos (solo owner del acceso ve contenido)
- [ ] Revisar expiraciones (alquiler vs compra)
- [ ] Responsive mobile de player
- [ ] Performance: optimizar carga de videos
- [ ] Tests unitarios e integración (opcional MVP)

---

## 5️⃣ Dependencias con otras features

**Bloqueadores:**
- ✓ Auth ya funciona
- ✓ Pagos Stripe funciona
- ✓ Mail (Resend) funciona

**Complementarias (FASE 2):**
- Likes y comentarios (mejora UX pero no bloquea MVP)
- Chat IA (mejora engagement pero no bloquea MVP)

**Nice to have (después):**
- Video transcoding (ahora asumimos videos ya codificados)
- Analytics dashboard
- Student progress dashboard

---

## 6️⃣ Datos Seed para Pruebas

Para empezar a testear, necesitamos crear 2-3 cursos seed:

```typescript
// prisma/seed.ts (o script similar)

const course1 = await prisma.course.create({
  data: {
    title: "Rizos: Cuidado Diario y Definición",
    description: "Aprende las técnicas fundamentales...",
    priceCents: 2999, // $29.99 USD
    rentalDays: null, // Compra ilimitada
    modules: {
      create: [
        {
          order: 1,
          title: "¿Qué es el Método Curly Girl?",
          description: "Explicación...",
          videoUrl: "https://r2.example.com/module-1.mp4",
          transcript: "content for AI..."
        },
        // ... 5-10 módulos más
      ]
    },
    resources: {
      create: [
        {
          type: "PDF",
          fileUrl: "https://r2.example.com/guia.pdf",
          fileName: "Guia_completa.pdf"
        }
      ]
    },
    test: {
      create: {
        schemaJson: {
          questions: [
            {
              id: "q1",
              type: "multipleChoice",
              text: "¿Cuál es...",
              options: ["Op A", "Op B", "Op C"],
              correctAnswer: "Op A"
            },
            // ... más preguntas
          ]
        }
      }
    }
  }
})
```

---

## 7️⃣ Notas de Diseño/UX

### Paleta de Colores (aplicada a Academy)
- Fondos: Beige suave (#F0D7B8)
- CTAs (comprar, continuar): Cobre (#B16E34)
- Acentos, badges, progreso: Verde oliva (#646A40)
- Texto: Gris oscuro (legible)

### Microinteracciones
- Botón "Comprar" → Transición cobre suave
- Módulo completado → Checkmark animado
- Barra de progreso → Smoothing en actualización
- Video paused → Ícono play overlay sutil

### Video Player
- Tema oscuro con controles cobre
- Subtítulos habilitados por default
- Full-screen responsive

---

## ✅ Definition of Done

Una feature se considera COMPLETA si:
- [ ] Código escrito y testeado
- [ ] Responsive (desktop, tablet, mobile)
- [ ] Permisos validados (servidor, no cliente)
- [ ] Errores manejados gracefully
- [ ] Emails funcionales (receipts, notifications)
- [ ] Accesibilidad básica (alt text, labels, keyboard nav)
- [ ] Performance aceptable (< 3s load, CLS < 0.1)
- [ ] Documentado en código
- [ ] User story testeada manually

---

**Siguiente**: Consulta `FEATURES_02_COMMUNITY.md` para likes/chat después de completar esta fase.
