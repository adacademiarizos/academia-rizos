# Skill: Frontend

- **Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Framer Motion, GSAP.
- **Arquitectura:** Vertical Slices dentro de `/src/app` por dominio (marketing, bookings, academy, admin, staff). Componentes funcionales en `/src/components`, tipados en `/src/types`, validaciones en `/src/validators` (Zod + `@hookform/resolvers`).
- **Convenciones de Código:**
  - Server Components por defecto; `"use client"` solo cuando haya interactividad, estado o hooks del navegador.
  - Estilos exclusivamente con clases utilitarias de Tailwind; tokens de diseño centralizados en `tailwind.config.ts`.
  - Formularios con `react-hook-form` + resolver de Zod.
- **Patrones:**
  - Fetching de datos en Server Components usando funciones de `/src/server` o `/src/lib`, siempre con manejo de errores (`try/catch` o `error.tsx` boundaries).
  - Estado de cliente puntual con hooks locales; no introducir una librería de estado global sin justificarlo como nueva skill.
- **Prohibiciones/Límites:**
  - No utilices CSS puro ni módulos `.css` fuera de `/src/styles` existentes.
  - No uses Redux ni otra librería de estado global sin aprobación explícita (requeriría nueva skill).
  - No hagas fetching de datos directo en Server Components sin manejo de errores.
  - No dupliques componentes de UI ya existentes en `/src/components`; reutiliza o extiende.
