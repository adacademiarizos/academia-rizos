# 🚀 Elizabeth Rizos - Guía de Inicio Rápido

**Documentado**: Marzo 2026
**Status**: Plataforma funcional con todos los módulos principales implementados

---

## 📋 Requisitos previos

- Node.js 18+
- PostgreSQL (local o remoto)
- Cuenta Stripe (test mode para desarrollo)

---

## ⚡ Configuración rápida

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
- `.env` — Entorno de desarrollo (ya configurado con PostgreSQL local)
- `.env.production` — Entorno de producción (Neon, Stripe live, etc.)

**Base de datos local:**
```
DATABASE_URL="postgresql://postgres:dark@localhost:5432/elizabeth"
```

### 3. Crear la base de datos y cargar datos demo
```bash
npx prisma migrate dev
npx prisma db seed
```

Esto carga automáticamente:
- 4 usuarios demo (admin, staff, 2 estudiantes)
- 3 cursos con módulos, tests y recursos
- Servicios y categorías desde JSON
- Citas, notificaciones, FAQ, horarios, chat rooms

Ver [DEMO_DATA.md](DEMO_DATA.md) para credenciales y detalles completos.

### 4. Iniciar el servidor
```bash
npm run dev
```

La app estará en http://localhost:3000.

---

## 🔑 Credenciales demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | `admin@elizabeth.com` | `admin123` |
| Staff | `staff@elizabeth.com` | `staff123` |
| Student | `student@elizabeth.com` | `student123` |
| Student 2 | `student2@elizabeth.com` | `student123` |

---

## 📁 Documentación

| Documento | Contenido |
|-----------|----------|
| `ARCHITECTURE.md` | Arquitectura, rutas, modelos de datos, flujos |
| `DEPLOY.md` | Guía de despliegue en Vercel + Neon |
| `DEMO_DATA.md` | Datos demo: usuarios, cursos, credenciales |
| `TECH-STACK.md` | Stack tecnológico completo |
| `FEATURES_ROADMAP.md` | Roadmap de funcionalidades |
| `FEATURES_01_ACADEMY_CORE.md` | Sistema de cursos (academia) |
| `FEATURES_02_COMMUNITY.md` | Comunidad: likes, comentarios, chat |
| `FEATURES_03_MARKETING.md` | Páginas de marketing |
| `FEATURES_04_POLISH.md` | Analytics, staff portal, tests |

---

## 🏗️ Scripts útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción (genera Prisma + migra + next build)
npm run seed         # Carga datos demo
npm run lint         # ESLint
npx prisma studio    # UI visual de la base de datos
npx prisma migrate dev # Aplicar migraciones pendientes
```
