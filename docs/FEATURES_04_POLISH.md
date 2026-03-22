# FASE 4: Polish, Analytics & Advanced Features

**Prioridad**: 🟢 OPCIONAL (Post-Launch)
**Estimación**: ~2-3 semanas
**Dependencias**: Completar FASE 1-3

---

## 1️⃣ Descripción General

Mejora de experiencia general, analytics, y features avanzadas (no críticas para MVP).

**Áreas:**
- Dashboards de usuario (perfil, mis cursos, mis reservas)
- Analytics para admin (conversiones, revenue, engagement)
- Mejora en disponibilidad de staff (calendario visual)
- Notifications y reminders
- Refinements UI/UX
- Tests automatizados

---

## 2️⃣ Historias de Usuario

### HU-ADV1: Estudiante Ve su Perfil y Progreso

```
COMO ESTUDIANTE AUTENTICADO
QUIERO: Ver mi perfil y mis cursos
PARA QUE: Administre mi aprendizaje y datos personales

CRITERIOS DE ACEPTACIÓN:
✓ Página /profile accesible desde menu o botón perfil
✓ Secciones:
  1) Mi información
     - Nombre, email, foto (editable)
     - Botón "Editar perfil"
     - Botón "Cambiar contraseña" (si login por creds)
  2) Mis cursos
     - Lista de cursos comprados/alquilados
     - Para cada curso:
       § Thumbnail
       § Título
       § Progreso (% completado)
       § Fecha de compra / acceso expire
       § Botón "Continuar aprendiendo"
     - Filtros: activos, completados, expirados
  3) Mis certificados
     - List de certificados emitidos
     - Botón descargar PDF
     - Link compartible
  4) Mis reservas
     - Próximas citas
     - Citas pasadas (historial)
     - Para cada:
       § Fecha/hora, servicio, profesional
       § Estado (confirmada, completada, cancelada)
       § Botón "Reprogramar" (si aplica)
✓ Responsive
✓ Fácil navegación

DISEÑO:
- Layout sidebar (desktop) o tabs (mobile)
- Cards para cada sección
- Status badges visibles
```

---

### HU-ADV2: Admin Ve Dashboard de Analytics

```
COMO ADMIN EN DASHBOARD
QUIERO: Ver métricas de negocio y performance
PARA QUE: Entienda salud del negocio

CRITERIOS DE ACEPTACIÓN:
✓ Página /admin/analytics con:
  1) Revenue
     - Total revenue (mes, trimestre, año)
     - Desglose: reservas vs cursos vs payment links
     - Gráfico línea histórico
     - Top cursos por revenue
  2) Conversión
     - Visitantes web → Compras (funnel)
     - Tasa conversión reservas
     - Tasa conversión academia
     - Cart abandonment (si aplica)
  3) Customers
     - Total clientes únicos
     - Clientes nuevos (mes)
     - Repeat customers
     - Churn rate (cursos alquiler)
     - Lifetime value
  4) Product
     - Top 5 servicios
     - Top 5 cursos
     - Módulos más vistos
     - Engagement (likes, comments, chat)
     - Test completion rate
  5) Staff Performance
     - Citas por profesional (mes)
     - Rating/reviews (si implementa)
     - Availability utilization
  6) Learnings
     - Estudiantes activos
     - Progress stats
     - Certificate issuance
     - Submission completion
✓ Filtros temporales: week, month, quarter, year
✓ Exportar a CSV (opcional)
✓ Dashboard overview (/admin) muestra KPIs principales

GRÁFICOS:
- Línea: Revenue over time
- Barras: Revenue por categoría
- Pastel: Desglose cursos vs reservas
- KPI cards: números grandes + cambio %
```

---

### HU-ADV3: Admin Ve Calendario de Disponibilidad

```
COMO ADMIN
QUIERO: Ver disponibilidad de staff en calendario visual
PARA QUE: Pueda gestionar schedules fácilmente

CRITERIOS DE ACEPTACIÓN:
✓ Página /admin/staff/[staffId]/schedule
✓ Calendario:
  - Vista mensual (default) o semanal
  - Grid: horarios (eje Y) vs días (eje X)
  - Celdas coloreadas:
    - Verde: disponible
    - Rojo: no disponible
    - Azul: booked
    - Gris: fuera de horario
✓ Interacción:
  - Click celda → abre modal para marcar disponible/no disponible
  - Drag-select para marcar rangos de disponibilidad
  - Bulk actions: "Marcar semana como disponible"
✓ Recurring rules (opcional):
  - "Cada lunes-viernes 9am-6pm disponible"
  - "Sabados no disponible"
- Data se guarda en StaffProfile.availabilityJson

ALTERNATIVA MVP:
- Simple form con input ranges:
  "Disponibilidad: Lunes-Viernes, 9am-6pm"
  "Days off: [lista fechas]"
```

---

### (continúa con más historias y checklist...) 

 (El contenido completo de FEATURES_04_POLISH.md continúa en el archivo original.)
