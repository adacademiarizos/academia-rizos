# Datos Demo — Entorno de Desarrollo

Este documento describe todos los datos demo que se cargan automáticamente al ejecutar `npm run seed` (o `npx prisma db seed`). Están diseñados para tener una plataforma funcional con datos realistas durante el desarrollo.

---

## Usuarios

| Email | Nombre | Rol | Contraseña |
|-------|--------|-----|------------|
| `admin@elizabeth.com` | Elizabeth Admin | ADMIN | `admin123` |
| `staff@elizabeth.com` | María Staff | STAFF | `staff123` |
| `student@elizabeth.com` | Ana Estudiante | STUDENT | `student123` |
| `student2@elizabeth.com` | Laura Estudiante | STUDENT | `student123` |

### Staff Profile
- **María Staff**: Bio + foto de perfil (Unsplash)

---

## Imágenes y Media

### Fuentes de Media (todas gratuitas y libres de uso)

| Tipo | Fuente | Formato URL |
|------|--------|-------------|
| Fotos | Unsplash | `https://images.unsplash.com/photo-{ID}?w={W}&h={H}&fit=crop` |
| Videos cursos | Pixabay CDN | `https://cdn.pixabay.com/video/{DATE}/{ID}_large.mp4` |
| Videos cursos | Pexels | `https://videos.pexels.com/video-files/{ID}/{ID}-{quality}.mp4` |
| PDFs recurso | W3C test files | `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf` |

### Imágenes Estáticas (en `/public/`)

| Archivo | Uso |
|---------|-----|
| `Elizabeth.webp` | Foto fundadora (About) |
| `f.webp` / `f2.webp` / `f3.webp` | Hero banner backgrounds |
| `persona2.webp` | Servicio: Diagnóstico + Rutina |
| `f2.webp` | Servicio: Definición & Styling |
| `f3.webp` | Servicio: Corte Curly |
| `logo.png` | Logo de la marca |

### Galería de Resultados (BD - `resultImage`)

| # | Descripción | Fuente |
|---|-------------|--------|
| 1 | Transformación rizos tipo 3A | Unsplash (curly hair woman) |
| 2 | Definición después de CGM | Unsplash (curly hair close-up) |
| 3 | Antes y después plopping | Unsplash (styled curly hair) |
| 4 | Rizos 3B definidos con gel | Unsplash (defined curls) |
| 5 | Hidratación profunda resultado | Unsplash (healthy curly hair) |
| 6 | Corte curly transformación | Unsplash (curly haircut) |

### Avatares Testimonios (en `site.ts` y `Testimonials.tsx`)
- 5 testimonios en `site.ts` + 3 en el componente `Testimonials.tsx`
- Avatares: fotos de retrato femenino de Unsplash (100x100, crop face)

---

## Categorías de Servicio

| Categoría | Orden |
|-----------|-------|
| Peinados | 0 |
| Pack Cabello ondulado densidad media-baja | 1 |
| Pack Cabello afro alta densidad | 2 |
| Pack Cabello rizado densidad media/alta | 3 |
| Pack Infantil | 4 |

> Los servicios se cargan desde `prisma/data/servicios.json` con todas sus variantes y precios por staff.

---

## Cursos

### Curso 1: El Método Curly Girl: Fundamentos
- **Precio:** 29.99 USD (acceso permanente)
- **Thumbnail:** Unsplash (mujer con rizos)
- **Trailer:** Pixabay video — mujer cepillando rizos (6s)
- **5 módulos** con videos reales de Pixabay (cuidado capilar):
  1. ¿Qué es realmente el Método Curly Girl? — video 30s
  2. Análisis de tu tipo de rizo — video 15s
  3. Ingredientes a evitar y buscar — video 15s
  4. Rutina básica: Lavado y acondicionamiento — video 15s
  5. Creming your waves: Técnica de definición — video 17s
- **Examen:** 4 preguntas (MC + texto + archivo)
- **Recursos:** PDF (guía nutrientes) + Imagen (clasificación tipos de rizo, Unsplash)

### Curso 2: Nutrición para Rizos Saludables
- **Precio:** 19.99 USD (alquiler 30 días)
- **Thumbnail:** Unsplash (cabello saludable)
- **Trailer:** Pixabay video — mujer secando cabello (14s)
- **3 módulos** con videos de Pixabay + Pexels:
  1. La conexión entre nutrición y salud capilar — Pixabay 22s
  2. Vitaminas y minerales esenciales — Pexels (curly hair styling) UHD
  3. Plan de alimentación pro-rizos — Pexels (curly hair styling) UHD
- **Examen:** 2 preguntas
- **Recursos:** 1 PDF

### Curso 3: Técnicas Avanzadas de Styling para Rizos
- **Precio:** 39.99 USD (acceso permanente)
- **Thumbnail:** Unsplash (técnica de styling)
- **Trailer:** Pixabay video — mujer bailando con rizos (28s)
- **5 módulos** con videos de Pexels (salón de belleza profesional):
  1. Herramientas esenciales — Pexels beauty salon HD
  2. Técnica del Plopping — Pexels curly hairstyle UHD
  3. Praying Hands y Microus — Pexels hair styling UHD
  4. Secado y afinamiento — Pexels hairdressing HD
  5. Troubleshooting — Pexels hair spray UHD
- **Examen:** 3 preguntas
- **Recursos:** PDF (guía técnicas) + Imagen (posiciones de manos, Unsplash)

---

## Datos Adicionales Demo

### Acceso a Cursos (CourseAccess)
- `student@elizabeth.com` → Curso 1 (permanente)
- `student@elizabeth.com` → Curso 2 (alquiler 30 días)
- `student2@elizabeth.com` → Curso 1 (permanente)

### Progreso de Módulos (ModuleProgress)
- Estudiante 1: Módulos 1-3 del Curso 1 completados
- Estudiante 2: Módulo 1 del Curso 1 completado

### Citas (Appointments)
- 3 citas de ejemplo con distintos estados (CONFIRMED, PENDING, COMPLETED)
- Asignadas al staff

### Notificaciones Demo
- 5 notificaciones de bienvenida para cada usuario
- Tipos: PAYMENT, NEW_COURSE, APPOINTMENT, COMMENT, COURSE_COMPLETION

### Horarios del Negocio (BusinessHours)
- Lunes a Viernes: 09:00 - 19:00
- Sábado: 10:00 - 14:00
- Domingo: Cerrado

### FAQ Demo
- 5 preguntas frecuentes sobre la plataforma, rizos, cursos, citas y pagos

### Chat Rooms
- Sala de comunidad general
- Sala por cada curso (3)

### Configuración (Settings)
- Comisión: 2.5%
- Fijo: 0.25€
- Moneda: EUR

---

## Configuración de Imágenes Externas

En `next.config.ts` se configuraron los dominios permitidos para `next/image`:
- `images.unsplash.com` — fotos de stock
- `cdn.pixabay.com` — thumbnails de video
- `videos.pexels.com` — videos
- `pub-cd27685460fa46d9af74b65c4b829faf.r2.dev` — Cloudflare R2 (producción)

---

## Cómo cargar los datos

```bash
# Opción 1: seed standalone
npx prisma db seed

# Opción 2: reset completo (borra todo + recrea + seed)
npx prisma migrate reset

# Opción 3: dev (se ejecuta automáticamente al detectar cambios)
npm run dev  # (si configurado con pre-seed)
```

## Credenciales rápidas para testing

| Acción | URL |
|--------|-----|
| Login admin | http://localhost:3000/signin → `admin@elizabeth.com` / `admin123` |
| Login staff | http://localhost:3000/signin → `staff@elizabeth.com` / `staff123` |
| Login student | http://localhost:3000/signin → `student@elizabeth.com` / `student123` |
| Dashboard admin | http://localhost:3000/admin |
| Dashboard staff | http://localhost:3000/staff/appointments |
| Dashboard student | http://localhost:3000/student |
| Notificaciones | http://localhost:3000/notifications |
| Comunidad | http://localhost:3000/community |
