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
  - Sección 3: "Credenciales" (opcional)
    - Certificaciones, etc
  - CTA: "Conoce nuestros servicios" → /services
         "Empiza tu viaje" → /booking
✓ Imágenes profesionales (Mary Kay style guidance)
✓ Tone: cálido, auténtico, empoderador

DESIGN:
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
- Fetch /api/admin/staff (public endpoint para datos básicos)
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

### ETAPA 2: Contact Form API (Día 1-2)

- [ ] Crear endpoint POST /api/contact
  - [ ] Validación Zod (name, email, subject, message)
  - [ ] Rate limit (máximo 5 contactos per IP per day)
  - [ ] Guardar en DB (opcional Contact tabla, o email directo)
  - [ ] Enviar email admin + auto-respuesta
  - [ ] Response: {success, messageId}
- [ ] Crear service `contact-service.ts`
  - [ ] sendAdminNotification()
  - [ ] sendAutoReply()
- [ ] Error handling

**Archivos:**
```
src/app/api/contact/route.ts
src/server/services/contact-service.ts
src/validators/contact.ts
src/types/contact.ts
```

---

### ETAPA 3: About Page (Día 2)

- [ ] Componentes:
  - [ ] `AboutHero` (hero section con foto Elizabeth)
  - [ ] `AboutStory` (sección "Mi viaje")
  - [ ] `AboutMission` (sección "Mi misión")
- [ ] Content: copiar texto marca/guión
- [ ] Imágenes:
  - [ ] Hero image de Elizabeth
  - [ ] Secondary images para secciones
- [ ] Estilos: beige/cobre/verde
- [ ] Responsive

**Archivos:**
```
src/app/(marketing)/about/page.tsx
src/components/marketing/AboutHero.tsx
src/components/marketing/AboutStory.tsx
src/components/marketing/AboutMission.tsx
```

---

### ETAPA 4: Services Page (Día 2-3)

- [ ] Fetch /api/services
- [ ] Componentes:
  - [ ] `ServicesGrid` (container)
  - [ ] `ServiceCard` (card individual)
  - [ ] `ServiceModal` (detalles expandido)
- [ ] Features:
  - [ ] Click card → expande detalles (modal o inline)
  - [ ] Botón "Reservar" → /booking?service=[id]
  - [ ] FAQ accordion
- [ ] Styling: grid responsive

**Archivos:**
```
src/app/(marketing)/services/page.tsx
src/components/marketing/ServicesGrid.tsx
src/components/marketing/ServiceCard.tsx
src/components/marketing/ServiceModal.tsx
src/components/marketing/ServiceFAQ.tsx
```

---

### ETAPA 5: Team Page (Día 3)

- [ ] Fetch /api/staff o /api/admin/staff (pública)
- [ ] Componentes:
  - [ ] `TeamGrid`
  - [ ] `TeamMember` card
- [ ] Features:
  - [ ] Foto, nombre, bio, especialidades
  - [ ] "Reservar con [name]" → /booking?staff=[id]
  - [ ] Hover effects
- [ ] Styling

**Archivos:**
```
src/app/(marketing)/team/page.tsx
src/components/marketing/TeamGrid.tsx
src/components/marketing/TeamMember.tsx
src/components/marketing/TeamValues.tsx
```

---

### ETAPA 6: Contact Page + Form (Día 3-4)

- [ ] Componentes:
  - [ ] `ContactForm` (formulario)
  - [ ] `ContactInfo` (información de contacto)
- [ ] Form features:
  - [ ] Validación Zod cliente
  - [ ] Submit → POST /api/contact
  - [ ] Loading state
  - [ ] Error toast
  - [ ] Success toast + reset
- [ ] Info sidebar:
  - [ ] Email, WhatsApp link
  - [ ] Horarios
  - [ ] Ubicación + Google Maps embed
  - [ ] Social icons
- [ ] Responsive: forma columnas

**Archivos:**
```
src/app/(marketing)/contact/page.tsx
src/components/marketing/ContactForm.tsx
src/components/marketing/ContactInfo.tsx
src/hooks/useContactForm.ts
```

---

### ETAPA 7: Homepage Improvements (Día 4-5)

- [ ] Mejorar HeroSection
  - [ ] Full screen, mejor imagen
  - [ ] Headline + subheadline optimizados
  - [ ] CTAs claros (Reservar, Academia)
  - [ ] Scroll down hint animado
- [ ] Mejorar ServicesTeaser
  - [ ] Link "Ver todos" → /services
  - [ ] 3-4 cards (preview)
- [ ] Mejorar TestimonialsSection
  - [ ] Agregar más testimonios (5-7)
  - [ ] Carousel swipeable
  - [ ] Avatar + nombre + rol
- [ ] Agregar FAQSection
  - [ ] 5-7 preguntas comunes
  - [ ] Accordion (expand/collapse)
  - [ ] "Pregunta más?" link a /contact
- [ ] Mejorar NavBar
  - [ ] Links: Home, Services, Team, About, Contact
  - [ ] Mobile responsive
  - [ ] Sticky on scroll
  - [ ] Logo consistente
- [ ] Mejorar Footer
  - [ ] Todas las secciones:
    - Links (Services, About, Contact, Privacy, Terms)
    - Social icons
    - Newsletter signup (opcional)
    - Copyright
- [ ] Micro-interacciones
  - [ ] Smooth scroll
  - [ ] Fade-in secciones
  - [ ] Button hover effects
  - [ ] Card hover shadow/elevation

**Archivos a mejorar:**
```
src/components/marketing/HeroSection.tsx (mejorar)
src/components/marketing/ServicesTeaser.tsx (mejorar)
src/components/marketing/TestimonialsSection.tsx (mejorar)
src/components/marketing/FAQSection.tsx (crear)
src/components/common/Navigation.tsx (mejorar)
src/components/common/Footer.tsx (mejorar)
```

---

### ETAPA 8: Email Templates (Día 5)

- [ ] Crear templates en Resend
  - [ ] Auto-respuesta contacto
  - [ ] Notificación admin
- [ ] Test sending
- [ ] Verificar en spam checks

**Archivos:**
```
src/server/email/contact-auto-reply.tsx
src/server/email/contact-admin-notification.tsx
```

---

### ETAPA 9: SEO & Metadata (Día 5-6)

- [ ] Metadatos para cada página:
  - [ ] title
  - [ ] description
  - [ ] og:image
  - [ ] og:title
  - [ ] og:description
- [ ] Sitemap.xml actualizado
- [ ] robots.txt
- [ ] Structured data (JSON-LD) para Organization/LocalBusiness

**Archivos:**
```
src/app/(marketing)/layout.tsx → defaultMetadata
src/app/(marketing)/about/page.tsx → metadata
src/app/(marketing)/services/page.tsx → metadata
etc
```

---

### ETAPA 10: Testing & Polish (Día 6-7)

- [ ] Responsive testing (mobile, tablet, desktop)
- [ ] Cross-browser testing
- [ ] Speed: Lighthouse > 90
- [ ] Accesibilidad: WCAG AA
- [ ] Links válidos
- [ ] Imágenes optimizadas
- [ ] Animations smoothes
- [ ] Copy review: tone, spelling, links

---

## 5️⃣ Guía de Contenido

### About Page Sample Copy

```
HEADLINE:
"Empoderando una riza a la vez"

INTRO:
Soy Elizabeth, especialista en curly hair y fundadora de Apoteósicas.
Mi misión es transformar la relación de las mujeres con sus rizos.

STORY SECTION:
Hace 5 años, yo tenía lo que muchas llaman "cabello frizz"...
[tu historia personal]

MISSION SECTION:
Creí siempre en el poder de la comunidad. Un rizo no es un fallo,
es una característica única y hermosa. Cada mujer merece:
- Conocimiento (cómo cuidar sus rizos realmente)
- Confianza (saber que es bonito como es)
- Comunidad (conexión con otras rizadas)

CTA:
¿Listo para abrazar tus rizos? Comienza hoy.
[Botones: Reserva, Academia]
```

### Services Page Sample

Ya existen servicios en DB, pero puedes hacerlos más visuales.

---

## 6️⃣ Design System Reference

### Color Tokens (aplicados a marketing)
- **Cobre (#B16E34)**: Buttons, CTAs, highlights
- **Beige (#F0D7B8)**: Backgrounds, soft sections
- **Verde (#646A40)**: Accents, badges, tertiary
- **Gris Oscuro (#333 o similar)**: Text
- **Blanco**: Clean spaces

### Typography
- **Headings (Display)**: Mighty Bagher Demo (si tienes)
- **Headings (Sections)**: Sans-serif bold (Inter, Geist, Plus Jakarta)
- **Body**: Sans-serif regular
- **Sizes**: h1: 48-56px, h2: 32-40px, h3: 24-32px, body: 14-16px

### Spacing
- Consistent padding/margin (8px, 16px, 24px, 32px, 48px, 64px units)
- Max-width container: 1200-1280px

### Shadows
- Subtle: 0 2px 8px rgba(0,0,0,0.1)
- Medium: 0 4px 16px rgba(0,0,0,0.15)
- Hover: Medium shadow for card elevation

### Animations
- Transición default: 200-300ms ease-out
- Scroll animations: fade-in, slide-up
- Button: color shift on hover (no harsh colors)

---

## 7️⃣ Performance Targets

- LCP (Largest Contentful Paint): < 2.5s
- FID (First Input Delay): < 100ms
- CLS (Cumulative Layout Shift): < 0.1
- Lighthouse Score: > 90

**Optimizaciones:**
- Images: WebP, lazy loading, responsive sizes
- Fonts: system fonts primero, luego Google Fonts optimizados
- CSS: critical path, remove unused
- JS: code splitting, dynamic imports
- Bundle: <100KB initial JS

---

## ✅ Definition of Done

- [ ] Todas las páginas creadas y ropables
- [ ] Links navegan correctamente
- [ ] Form contacto funcional + emails
- [ ] API /api/staff pública (para team page)
- [ ] Responsive (mobile, tablet, desktop)
- [ ] Performance > 90 Lighthouse
- [ ] Accesible (alt text, labels, contrast)
- [ ] SEO: metadatos, structured data
- [ ] Imágenes optimizadas
- [ ] Animaciones suaves
- [ ] Copy revisada
- [ ] Testeado en navegadores principales

---

**Siguiente**: Consulta `FEATURES_04_POLISH.md` para mejoras finales y analytics.
