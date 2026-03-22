# FASE 3: Marketing Pages & Brand Polish

**Prioridad**: 🟡 IMPORTANTE
**Estimación**: ~1 semana
**Dependencias**: Parciales (puede avanzar paralelo a FASE 1-2)

---

## 1️⃣ Descripción General

Completar la presencia de marketing con páginas informativas y calls-to-action estratégicos.

**Páginas a crear:**
- `/about` - Historia de Elizabeth y la marca
- `/services` - Detalle de servicios disponibles
- `/team` - Integrantes del equipo
- `/contact` - Formulario de contacto

**Mejoras a existentes:**
- Homepage refinements
- Navegación consistente
- Diseño alineado a Brand Manual

---

## 2️⃣ Historias de Usuario

### HU-M1: Visitante Lee Sobre Elizabeth y su Marca

```
COMO VISITANTE EN HOMEPAGE
QUIERO: Conocer la historia de Elizabeth
PARA QUE: Entienda su autoridad y vision

CRITERIOS DE ACEPTACIÓN:
✓ Link /about en navbar y footer
✓ Página /about con:
  - Hero section con foto de Elizabeth
  - Headline: "La historia de Elizabeth Rizos"
  - Párrafo intro (2-3 líneas)
  - Sección 1: "Mi viaje" (2-3 párrafos)
    - Cómo descubrió la comunidad curly girl
    - Transformación personal
    - Por qué decidió enseñar
  - Sección 2: "Mi misión" (1-2 párrafos)
    - Empoderamiento de mujeres rizadas
    - Comunidad inclusiva
    - Confianza en la diversidad
  - CTA: "Conoce nuestros servicios" → /services
         "Empiza tu viaje" → /booking
✓ Imágenes profesionales (Mary Kay style guidance)
✓ Tone: cálido, auténtic0, empoderador

DISEÑO:
- Paleta: beige + cobre + verde oliva
- Hero: full width con foto
- Texto sobre foto con overlay (transparencia)
- Secciones alternadas (texto/imagen)
```

---

### HU-M2: Visitante Descubre Servicios Detallados

```
COMO VISITANTE EN HOMEPAGE
QUIERO: Ver detalles de todos los servicios disponibles
PARA QUE: Pueda comparar y elegir cuál reservar

CRITERIOS DE ACEPTACIÓN:
✓ Link /services en navbar y homepage
✓ Página /services con:
  - Hero: "Nuestros servicios de cuidado de rizos"
  - Grid de service cards (3-4 columns):
    - Cada card incluye:
      § Foto/ícono representativo
      § Nombre servicio
      § Descripción breve
      § Duración estimada
      § Botón "Reservar ahora" → /booking?service=[serviceId]
      § Click card expande detalles:
        - Descrición larga (qué incluye)
        - Beneficios
        - Para quién es ideal
        - Precio (rango, "desde $X")
        - Staff disponible
  - Sección FAQ: "Preguntas frecuentes"
    - Qué pasa en la cita?
    - Cuánto dura?
    - Qué debo llevar?
    - Puedo reprogramar?
  - CTA footer: "Reserva tu cita" → /booking

DATA SOURCE:
- Fetchear de /api/services
- Jerarquía: servicio → detalles → staff

DISEÑO:
- Cards con hover effects
- Colores según paleta marca
- Responsive grid
- Typography: headings bold, body legible
```

---

### HU-M3: Visitante Conoce al Equipo

```
COMO VISITANTE EN HOMEPAGE
QUIERO: Ver quiénes son los miembros del equipo
PARA QUE: Sienta confianza y conexión personal

CRITERIOS DE ACEPTACIÓN:
✓ Link /team en navbar
✓ Página /team con:
  - Hero: "Conoce nuestro equipo"
  - Grid de staff profile cards:
    - Foto profesional (circular o cuadrada)
    - Nombre
    - Rol (ej: "Especialista en Rizos")
    - Bio corta (2-3 líneas)
    - Especialidades (tags)
    - Link "Reservar con [name]" → /booking?staff=[staffId]
  - Sección: "Por qué trabajamos así"
    - Valores del equipo (2-3 párrafos)
    - Commitment a calidad
  - CTA: "Reserva con tu favorite" → /booking

DATA SOURCE:
- Fetch /api/admin/staff (pública, datos básicos)
- StaffProfile.photoUrl, bio, userId

DISEÑO:
- Card con hover zoom sutil
- Foto grande
- Bio clara
- Botón acción claro
```

---

### HU-M4: Visitante Solicita Información o Contacto

```
COMO VISITANTE
QUIERO: Enviar mensaje para hacer preguntas
PARA QUE: Pueda obtener respuesta de Elizabeth o equipo

CRITERIOS DE ACEPTACIÓN:
✓ Link /contact en navbar y footer
✓ Página /contact con:
  - Hero: "Ponte en contacto"
  - Dos columnas (desktop) / full width (mobile):
    Columna izq (form):
    - Formulario:
      § Nombre (required)
      § Email (required, validate)
      § Asunto / Tipo consulta (select)
        - Pregunta general
        - Disponibilidad staff
        - Solicitud personalizada
        - Otra
      § Mensaje (required, textarea, min 10 chars)
      § Botón "Enviar"
    - Validación:
      § Client-side: zod schema
      § Server-side: rate limit + spam check
    - Success: "Gracias! Responderemos en 24-48h"
    Columna der (info):
    - "¿Cómo nos contactas?"
    - Email: XX
    - WhatsApp: XX (optional, link)
    - Horarios: Mon-Fri 10-19, Sat 10-14
    - Ubicación: [dirección] (if applicable)
    - Mapa embedded (Google Maps, opcional)
    - Social links (Instagram, etc)

EMAIL SERVIDOR:
- Recibe email en [admin-email]
- Asunto: "[Contact] {user_subject}"
- Body: formatted con datos usuario
- Auto-respuesta al usuario
- Opcional: CRM integration (Airtable, etc)

DESIGN:
- Form limpio, sin clutter
- Error validation visible
- Success toast/message
- Info sidebar con diseño visual
- Responsive
```

---

### HU-M5: Mejoras Homepage

```
COMO VISITANTE EN PÁGINA HOME
QUIERO: Experiencia fluida y profesional
PARA QUE: Confíe en la marca y convierta a cliente

CRITERIOS DE ACEPTACIÓN:
✓ Navbar:
  - Logo/isotipo
  - Links: Home, Services, Team, About, Contact, My booking, Dashboard
  - Login/Logout según estado
  - Mobile: hamburguer menu
  - Sticky en scroll (lazy)
✓ Header/Hero:
  - Laptop: full screen hero con video/background
  - Foto/video de Elizabeth o cabello
  - Overlay con headline
  - Subheadline text
  - CTA buttons: [Reserve] [Explore Academy]
  - Scroll down hint animado
✓ Secciones:
  - Trust bar (números: X servicios, Y clientes, etc)
  - Services preview (grid 3-4 cards)
  - Testimonios (carousel, 3-5)
  - "How it works" (3 steps)
  - Academy teaser (hero + 2-3 cursos)
  - FAQ accordion
  - Footer:
    - Links: Services, About, Contact, Privacy, Terms
    - Social icons
    - Email signup newsletter (optional)
    - Copyright
✓ Transiciones suaves (scroll animations, fade-in)
✓ Micro-interactions:
  - Button hover (color shift, subtle animation)
  - Card hover (shadow, slight elevation)
  - Fading sections as scroll
✓ Paleta visual:
  - Beige base
  - Cobre CTAs
  - Verde oliva accents
  - Tipografía: headings Mighty Bagher, body sans-serif
✓ Performance:
  - Imágenes optimizadas (WebP, lazy load)
  - CLS < 0.1
  - LCP < 2.5s

COMPONENTS TO ENHANCE:
- HeroSection
- ServicesSection (preview)
- TestimonialsSection
- FAQSection
- AcademyTeaser
- Footer

```

---

## 3️⃣ Requerimientos Técnicos

### Nuevas Rutas

```
GET /              (mejorar existente)
GET /(marketing)/about
GET /(marketing)/services
GET /(marketing)/team
GET /(marketing)/contact
POST /api/contact  (enviar formulario)
```

### APIs Necesarias

```
[PÚBLICO]
GET /api/services                 (ya existe)
GET /api/staff                    (pública, datos básicos)

[FORMULARIO CONTACTO]
POST /api/contact                 (crear contacto)
  body: {name, email, subject, message}
  response: {success, messageId}
```

### Componentes UI Nuevos

```
src/components/marketing/
  - AboutHero
  - AboutStory
  - AboutMission
  - ServicesGrid
  - ServiceCard
  - ServiceModal
  - TeamGrid
  - TeamMember
  - ContactForm
  - ContactInfo
  - FAQAccordion
  - NavigationBar
  - Footer (mejorado)
  - HeroSection (mejorado)
```

### Email (Resend)

Necesitamos setupear templates:

1. **Auto-respuesta al contacto**
```
To: [user email]
Subject: "Recibimos tu mensaje | Apoteósicas by Elizabeth Rizos"
Body: HTML email con:
  - Agradecimiento
  - Resumen de su pregunta
  - "Responderemos en 24-48 horas"
  - Links útiles (services, academy)
```

2. **Notificación admin**
```
To: [admin email]
Subject: "Nuevo contacto: {subject}"
Body:
  - Nombre y email usuario
  - Asunto
  - Mensaje completo
  - Link al dashboard (si existe)
```

---

## 4️⃣ Checklist de Implementación

### ETAPA 1: Setup Pages Structure (Día 1)

- [ ] Crear layout en `(marketing)/layout.tsx`
- [ ] Crear pages vacías:
  - [ ] `(marketing)/about/page.tsx`
  - [ ] `(marketing)/services/page.tsx`
  - [ ] `(marketing)/team/page.tsx`
  - [ ] `(marketing)/contact/page.tsx`
- [ ] Actualizar navbar con nuevos links
- [ ] Actualizar footer

**Archivos:**
```
src/app/(marketing)/layout.tsx (si no existe)
src/app/(marketing)/about/page.tsx
src/app/(marketing)/services/page.tsx
src/app/(marketing)/team/page.tsx
src/app/(marketing)/contact/page.tsx
```

---

(contenido restante del archivo original omitido por brevedad)
