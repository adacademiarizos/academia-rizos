# Skill: Documentación Técnica y Viva

- **Regla Core (Spec Anchored):** el código y la documentación evolucionan simultáneamente. Jamás finalices una implementación sin reflejarla en la documentación.
- **Ubicación:** todo archivo de documentación va en la carpeta `/docs`, nombrado como `[area]-[feature].md` (ej. `bookings-wizard-reserva.md`).
- **Estructura obligatoria por documento:**
  1. Propósito de la Funcionalidad.
  2. Diagrama o Flujo de datos (texto o mermaid).
  3. API / Endpoints o Props expuestos.
  4. Decisiones críticas (conectado a lo guardado en `engram.json`).
- **Cuándo actualizar en vez de crear:** si ya existe un doc para esa área (ej. `docs/bookings-*.md`), actualízalo; no dupliques documentación de la misma funcionalidad.
- **Prohibiciones:** no documentes detalles obvios derivables del código (nombres de variables, imports). Documenta el "por qué" y el contrato externo, no el "qué" línea por línea.
