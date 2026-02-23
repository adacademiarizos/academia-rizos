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

### HU-C2: Estudiante Comenta en un Módulo

```
COMO ESTUDIANTE VIENDO MÓDULO DE VIDEO
QUIERO: Dejar comentarios en el módulo
PARA QUE: Pueda hacer preguntas y compartir insights

CRITERIOS DE ACEPTACIÓN:
✓ Debajo del video: sección "Comentarios"
✓ Muestra lista de comentarios (más recientes primero)
✓ Cada comentario: nombre usuario, fecha, texto, avatar
✓ Si no autenticado: "Loguéate para comentar"
✓ Si autenticado: textarea "Agregar comentario"
✓ Click "Enviar" → valida contenido
  - No permitir vacío
  - Max 500 caracteres (o similar)
✓ Nuevo comentario aparece al tope (optimista UI)
✓ Se guarda en DB: Comment table
✓ Admin puede moderar (delete) comentarios

DATOS:
- Comment.userId
- Comment.targetType = "MODULE"
- Comment.moduleId
- Comment.body
- Comment.createdAt

VALIDACIÓN:
- Solo usuarios con CourseAccess pueden comentar
- Rate limit: máximo 10 cambios/minutos (opcional)
```

---

### HU-C3: Estudiante Ve Comentarios en Curso Landing

```
COMO VISITANTE MIRANDO LANDING DE CURSO
QUIERO: Ver comentarios de otros estudiantes
PARA QUE: Pueda decidir si comprar basado en opiniones

CRITERIOS DE ACEPTACIÓN:
✓ Sección "Opiniones" en /courses/[courseId]
✓ Muestra últimos 5 comentarios
✓ Cada comentario: nombre, foto (si tienes), comentario
✓ Link "Ver todos comentarios" (opcional, abre modal)
✓ Comentarios son públicos (visible a no-logueados)
✓ Si hay muchos: scroll o paginación
```

---

### HU-C4: Estudiante Accede a Chat del Curso

```
COMO ESTUDIANTE CON ACCESO AL CURSO
QUIERO: Acceder a un chat exclusivo con otros estudiantes
PARA QUE: Pueda hacer preguntas e interactuar con la comunidad

CRITERIOS DE ACEPTACIÓN:
✓ Página /learn/[courseId]/chat (o dentro de área curso)
✓ Chat solo accesible si tienes CourseAccess
✓ Si no tienes acceso: "Compra/alquila el curso para acceder al chat"
✓ Interfaz:
  - Lista mensajes (scroll automático a nuevo)
  - Input campo para escribir
  - Botón "Enviar" (o Enter)
  - Mostrar: avatar, nombre, timestamp, mensaje
✓ Mensajes se cargan en tiempo real
  - Refetch cada 2-5 segundos (MVP simple)
  - O WebSocket si queremos más realtime
✓ Soporte básico:
  - No permitir mensajes vacíos
  - Max lenght 1000 caracteres
  - Rate limit: máximo 20 msgs/minuto

DATOS:
- ChatMessage.roomId (1 per course)
- ChatMessage.userId
- ChatMessage.body
- ChatMessage.createdAt
- ChatRoom.courseId (unique)

PERMISOS:
- Solo CourseAccess holders
```

---

### HU-C5: IA Responde en Chat del Curso

```
COMO ESTUDIANTE EN CHAT DEL CURSO
QUIERO: Hacer una pregunta y que IA la responda
PARA QUE: Obtener ayuda inmediata basada en contenido del curso

CRITERIOS DE ACEPTACIÓN:
✓ En chat: puedo escribir pregunta normal
✓ Si mensaje empieza con "@ai" o es pregunta clara:
  - Sistema detecta intención IA
  - Muestra avatar "IA Assistant" o similar
  - IA procesa el mensaje
  - Devuelve respuesta contextual
✓ IA tiene acceso a:
  - Transcripciones de módulos del curso
  - Descripción del curso
  - Recursos (PDFs parsed, si feasible)
  - Conocimiento general curly hair
✓ Respuesta incluye:
  - Referencia al módulo/sección ("Según módulo 3, tenemos que...")
  - Tono cálido y profesional
  - Limitado a contexto del curso

EJEMPLO:
User: "Cómo hago para que mis rizos no se encrespen?"
IA: "Excelente pregunta. En el módulo 2 aprendemos que el encrespamiento viene de falta de hidratación. La recomendación es..."

DATOS:
- ChatMessage.userId = IA bot user (system user)
- ChatMessage.body = respuesta IA
- metadata: que es mensje IA

INTEGRACIÓN LLM:
- Opción 1: OpenAI API + embeddings
- Opción 2: Claude API (Anthropic) - recomendado
- Opción 3: Open source (Llama, etc)

Recommendation: Claude API (simplicity + quality)
```

---

### HU-C6: Admin Modera Comentarios

```
COMO ADMIN
QUIERO: Ver todos comentarios y moderar si es necesario
PARA QUE: Pueda remover contenido inapropiado

CRITERIOS DE ACEPTACIÓN:
✓ Dashboard /admin/comments (o sección en admin general)
✓ Tabla de comentarios con:
  - Usuario, curso/módulo, texto, fecha
  - Botón "Eliminar"
  - Filtros: visto/no visto, reported, etc
✓ Click eliminar → comentario desaparece
✓ Logs de quién eliminó (opcional)
```

---

### HU-C7: Admin Ve Estadísticas de Engagement

```
COMO ADMIN EN DASHBOARD
QUIERO: Ver estadísticas de engagement por curso
PARA QUE: Entienda qué contenido resonea mejor

CRITERIOS DE ACEPTACIÓN:
✓ Overview dashboard muestra:
  - Total likes por curso (top 5)
  - Total comentarios por curso
  - Chat activity (mensajes últimos 7 días)
  - Cursos con mayor engagement
✓ Página /admin/analytics (opcional)
  - Gráficos de engagement over time
  - Top comentadores
  - Curso más popular

DATA:
- CountLikes by courseId, moduleId
- CountComments by targetType, courseId/moduleId
- CountChatMessages by roomId, date range
```

---

## 3️⃣ Requerimientos Técnicos

### Modelos Prisma (Ya en schema, usar existentes)

```prisma
model Like {
  id        String         @id @default(cuid())
  userId    String
  targetType LikeTargetType         # COURSE | MODULE
  courseId  String?
  moduleId  String?
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  course Course? @relation(fields: [courseId], references: [id])
  module Module? @relation(fields: [moduleId], references: [id])

  @@unique([userId, targetType, courseId, moduleId])
}

model Comment {
  id        String            @id @default(cuid())
  userId    String
  targetType CommentTargetType # COURSE | MODULE
  courseId  String?
  moduleId  String?
  body      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  course Course? @relation(fields: [courseId], references: [id])
  module Module? @relation(fields: [moduleId], references: [id])

  @@index([targetType])
  @@index([courseId])
  @@index([moduleId])
}

model ChatRoom {
  id       String @id @default(cuid())
  courseId String @unique
  createdAt DateTime @default(now())

  course Course @relation(fields: [courseId], references: [id])
  messages ChatMessage[]
}

model ChatMessage {
  id       String @id @default(cuid())
  roomId   String
  userId   String
  body     String
  createdAt DateTime @default(now())

  room ChatRoom @relation(fields: [roomId], references: [id])
  user User @relation(fields: [userId], references: [id])

  @@index([roomId, createdAt])
}
```

---

### APIs Necesarias

```
[LIKES]
POST   /api/likes                  → Crear/toggle like
GET    /api/courses/[courseId]/likes  → Count + user liked?
GET    /api/modules/[moduleId]/likes  → Count + user liked?

[COMMENTS]
POST   /api/comments               → Crear comentario
GET    /api/courses/[courseId]/comments    → Listar comentarios
GET    /api/modules/[moduleId]/comments    → Listar comentarios
DELETE /api/comments/[commentId]           → Admin delete

[CHAT]
GET    /api/chat/[roomId]/messages      → Listar mensajes
POST   /api/chat/[roomId]/messages      → Enviar mensaje
GET    /api/chat/rooms-by-course/[courseId]  → Get or create room

[AI CHAT]
POST   /api/ai/chat                → Procesar mensaje y responder
(internal, llamado desde /api/chat)
```

---

### Integración IA (Claude API)

**Setup:**
```bash
npm install @anthropic-ai/sdk
```

**.env.local:**
```
ANTHROPIC_API_KEY=sk-ant-...
```

**RAG (Retrieval Augmented Generation):**
- Almacenar embeddings de transcripciones
- Hacer search por similaridad
- Context a Claude para respuesta contextual

**Opciones:**
1. Simple: Claude + contexto manual (más caro en tokens)
2. Embeddings: Pinecone/Weaviate + Claude ($$, pero más eficiente)
3. OpenAI: Usar su API de embeddings + ChatGPT

**Recommendation MVP**: Opción 1 (simple, funciona bien)

---

### Real-time Chat (Opcional MVP)

**MVP:** Polling (refetch cada 3 segundos)
**Better:** WebSocket o SSE
**Best:** Supabase Realtime, Firebase, Socket.io

Para MVP basta polling simple.

---

## 4️⃣ Checklist de Implementación

### ETAPA 1: Setup Base (Día 1)

- [ ] Verificar Prisma schema (Like, Comment, ChatRoom, ChatMessage)
- [ ] Ejecutar migration si no existe
- [ ] Crear tipos TypeScript
- [ ] Validators Zod para comments/likes

**Archivos:**
```
src/types/engagement.ts
src/validators/engagement.ts
```

---

### ETAPA 2: APIs Likes (Día 1-2)

- [ ] `POST /api/likes` → Create/toggle like
  - [ ] Valida usuario autenticado
  - [ ] Valida que course/module existe
  - [ ] Toggle (crear si no existe, delete si existe)
  - [ ] Devuelve: liked, count
- [ ] `GET /api/courses/[courseId]/likes` → Count total + user state
- [ ] `GET /api/modules/[moduleId]/likes` → idem

**Archivos:**
```
src/app/api/likes/route.ts
src/server/services/like-service.ts
```

---

### ETAPA 3: APIs Comments (Día 2-3)

- [ ] `POST /api/comments` → Crear comentario
  - [ ] Validar usuario autenticado + acceso
  - [ ] Validar contenido (no vacío, max length)
  - [ ] Rate limit básico
- [ ] `GET /api/courses/[courseId]/comments` → Listar (paginated)
- [ ] `GET /api/modules/[moduleId]/comments` → idem
- [ ] `DELETE /api/comments/[commentId]` → Admin only

**Archivos:**
```
src/app/api/comments/route.ts
src/server/services/comment-service.ts
```

---

### ETAPA 4: APIs Chat (Día 3-4)

- [ ] `GET /api/chat/rooms-by-course/[courseId]` → Get or create room
- [ ] `GET /api/chat/[roomId]/messages` → Listar mensajes (últimos 50)
- [ ] `POST /api/chat/[roomId]/messages` → Enviar mensaje
  - [ ] Valida acceso (CourseAccess)
  - [ ] Detecta if IA mention/question
  - [ ] Si IA: llama a LLM, devuelve respuesta como ChatMessage

**Archivos:**
```
src/app/api/chat/route.ts
src/server/services/chat-service.ts
src/server/services/ai-service.ts
```

---

### ETAPA 5: Frontend - Likes Component (Día 2)

- [ ] Componente `LikeButton`
  - [ ] Props: targetId, targetType (course/module)
  - [ ] Muestra corazón + contador
  - [ ] Click → POST /api/likes → optimista UI
  - [ ] Estados: loading, error, success
- [ ] Integrar en:
  - [ ] /courses/[courseId] page
  - [ ] /learn/[courseId]/modules/[moduleId] page

**Componentes:**
```
src/components/engagement/LikeButton.tsx
src/hooks/useLike.ts (custom hook)
```

---

### ETAPA 6: Frontend - Comments Component (Día 3-4)

- [ ] Componente `CommentSection`
  - [ ] Props: targetId, targetType, show (5 o todos)
  - [ ] Lista comentarios
  - [ ] Form comentario (textarea + botón)
  - [ ] Validación cliente (no vacío, max 500 chars)
- [ ] Componente `CommentItem`
  - [ ] Avatar, nombre, fecha, texto
  - [ ] Botón delete (si owner o admin)
- [ ] Integrar en:
  - [ ] /courses/[courseId] landing
  - [ ] /learn/[courseId]/modules/[moduleId]

**Componentes:**
```
src/components/engagement/CommentSection.tsx
src/components/engagement/CommentItem.tsx
src/hooks/useComments.ts
```

---

### ETAPA 7: Frontend - Chat Component (Día 4-5)

- [ ] Página /learn/[courseId]/chat
  - [ ] Validar CourseAccess (redirect si no)
  - [ ] Layout: mensajes + input footer
- [ ] Componente `ChatWindow`
  - [ ] Lista mensajes (refetch each 3s MVP)
  - [ ] Scroll auto on new message
  - [ ] Diferencia UI para IA messages
- [ ] Componente `ChatInput`
  - [ ] Textarea
  - [ ] Botón enviar
  - [ ] Detección @ai
  - [ ] Preventsumbit si vacío
- [ ] Loading states, error handling

**Componentes:**
```
src/app/(academy)/learn/[courseId]/chat/page.tsx
src/components/academy/ChatWindow.tsx
src/components/academy/ChatInput.tsx
src/components/academy/ChatMessage.tsx
src/hooks/useChat.ts
```

**Hook para polling:**
```typescript
// useChatMessages.ts
useEffect(() => {
  const interval = setInterval(async () => {
    const msgs = await fetch(`/api/chat/${roomId}/messages`).then(r => r.json());
    setMessages(msgs);
  }, 3000);
  return () => clearInterval(interval);
}, [roomId]);
```

---

### ETAPA 8: LLM Integration (Día 5-6)

- [ ] Instalar @anthropic-ai/sdk
- [ ] Crear `ai-service.ts`
  - [ ] Función para generar prompt con contexto
  - [ ] Función para llamar Claude
  - [ ] Parsing respuesta
- [ ] En chat POST:
  - [ ] Detectar si pregunta para IA
  - [ ] Fetchear módulos transcripts del curso
  - [ ] Armar contexto
  - [ ] Llamar claude
  - [ ] Guardar respuesta como ChatMessage
- [ ] Error handling (IA timeout, rate limit, etc)

**Archivos:**
```
src/server/services/ai-service.ts
```

**Prompt template:**
```
Eres un asistente especializado en cuidado de rizos.
Responde preguntas basado SOLO en el contenido del curso.

CONTEXTO DEL CURSO:
[Título curso]
[Descripción]

CONTENIDO DE MÓDULOS:
Módulo 1: [título]
[transcript o resumen]

Módulo 2: [título]
[transcript o resumen]

PREGUNTA DEL ESTUDIANTE:
{user_question}

Proporciona una respuesta clara, basada en el contenido,
y haz referencia al módulo/sección relevante.
```

---

### ETAPA 9: Admin - Moderation (Día 6)

- [ ] Dashboard /admin/moderation (o new tab en admin)
  - [ ] Tabla comentarios
  - [ ] Filtros: curso, módulo, date range
  - [ ] Botón delete con confirmación
  - [ ] Opcional: reportar/flag comments

**Archivos:**
```
src/app/(dashboard)/admin/moderation/page.tsx
src/components/dashboard/CommentModerationTable.tsx
```

---

### ETAPA 10: Engagement Analytics (Día 6-7)

- [ ] Overview dashboard → agregar cards:
  - [ ] "Total likes this week"
  - [ ] "Top course by engagement"
  - [ ] "Chat messages today"
- [ ] Optional: /admin/engagement-analytics page
  - [ ] Charts con histórico
  - [ ] Breakdown por course

**Archivos:**
```
src/components/dashboard/EngagementStats.tsx
```

---

## 5️⃣ Testing Strategy

- [ ] Test API likes endpoint
- [ ] Test comment creation + deletion
- [ ] Test chat access control
- [ ] Test IA response generation
- [ ] Test rate limits

**Herramientas:**
- Jest para unitarios
- Vitest para speed
- Testing Library para componentes

---

## 6️⃣ Seguridad & Permisos

- [ ] Comments: valida CourseAccess para comentar
- [ ] Chat: valida CourseAccess para acceder
- [ ] Moderation: admin only
- [ ] Rate limits en comments y chat (prevent spam)
- [ ] Sanitización de texto (prevent XSS)

---

## 7️⃣ Performance

- [ ] Queries: index en courseId, moduleId, createdAt
- [ ] Chat: limit 50 mensajes por request
- [ ] Comments: paginate (20 per page)
- [ ] Like count: cache en Redis (optional)
- [ ] IA respuesta: max 30 segundos timeout

---

## 8️⃣ Rollout

**Fase 2a (week 1 post-academy):**
- Likes + Comments (engagement básica)
- Chat sin IA primero

**Fase 2b (week 2):**
- IA Chat integration
- Moderation tools

---

## ✅ Definition of Done

- [ ] Todas las APIs testadas
- [ ] Frontend responsive
- [ ] Permisos validados (servidor)
- [ ] Rate limits en lugar
- [ ] Texto sanitizado
- [ ] Emails si aplica (nuevos comentarios, etc)
- [ ] Accesible (labels, alt, keyboard)

---

**Siguiente**: Consulta `FEATURES_03_MARKETING.md` para completar las páginas de marketing después.
