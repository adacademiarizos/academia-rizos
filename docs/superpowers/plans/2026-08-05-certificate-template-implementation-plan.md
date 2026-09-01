# Plan de implementación: certificado exacto y slogan por curso

## Estado

Pendiente de aprobación explícita antes de modificar código de producción.

## 1. Modelo de datos y regla de publicación

Archivos previstos:

- `prisma/schema.prisma`
- Nueva migración en `prisma/migrations/`
- `src/types/academy.ts`

Cambios:

1. Añadir `certificateSlogan String?` a `Course` y reflejarlo en el tipo compartido y los DTO de creación/actualización.
2. Crear una migración que agregue la columna y desactive los cursos que carezcan de un slogan válido.
3. Definir una única regla de validación: recortar extremos, exigir contenido para publicar y limitar a 100 caracteres; los borradores inactivos pueden omitirlo.

Comprobación:

- Generar Prisma y aplicar la migración en el entorno de prueba.
- Confirmar que ningún curso existente queda activo sin slogan.

## 2. API y administración de cursos

Archivos previstos:

- `src/app/api/admin/courses/route.ts`
- `src/app/api/admin/courses/[courseId]/route.ts`
- `src/app/(dashboard)/admin/courses/page.tsx`
- `src/app/(dashboard)/admin/courses/[courseId]/edit/page.tsx`

Cambios:

1. Extender los contratos de las rutas administrativas para aceptar y devolver `certificateSlogan`.
2. Aplicar la misma validación en creación y actualización. Si `isActive` es `true` sin slogan válido, devolver un error de validación sin guardar el cambio.
3. Añadir el campo de texto y contador `0/100` en la creación y edición del curso, con un mensaje que indique que es obligatorio para publicar.
4. Al editar un curso, incluir el slogan en la detección de cambios y mostrar el error de la API sin perder los valores del formulario.
5. Mantener el control de acceso basado en `CourseAccess`; la desactivación seguirá ocultando y bloqueando nuevas compras, pero no revocará accesos ya creados.

Comprobación:

- Un borrador sin slogan se guarda desactivado.
- Intentar publicarlo sin slogan falla tanto desde la interfaz como al llamar la API directamente.
- Al añadir un slogan válido, el administrador puede activarlo y el catálogo/checkout lo reconoce como activo.

## 3. Plantilla exacta de certificado

Archivos previstos:

- Recursos nuevos bajo `public/certificates/` (fondo, logo, sello y tipografías del modelo)
- `src/lib/pdf.ts`
- `src/server/services/certificate.service.ts`

Cambios:

1. Copiar los recursos del modelo aprobado al proyecto y empaquetar localmente las fuentes Cormorant Garamond, Manrope y Great Vibes necesarias para reproducirlo sin depender de Google Fonts en tiempo de emisión.
2. Reemplazar el HTML/CSS de certificado actual por la plantilla aprobada, conservando su escala, coordenadas, colores y reglas A4 horizontales. Eliminar sus controles manuales (`contenteditable`, botón de impresión y JavaScript de edición).
3. Incrustar los recursos locales en el HTML de Puppeteer para que el PDF sea autocontenido y se renderice de forma consistente en producción.
4. Construir el QR con la URL actual de verificación y rellenar nombre, curso, slogan, fecha de emisión y código con contenido HTML escapado.
5. Cargar `certificateSlogan` junto con el curso en `generateAndSaveCertificate`; rechazar la emisión si, por una ruta inesperada, falta el slogan.

Comprobación:

- Generar un certificado de ejemplo y compararlo visualmente con la vista previa aprobada: fondo, logo, sello, campos, QR, tipografías y A4 horizontal.
- Verificar que el QR resuelve la ruta pública `/verify/certificate/{code}`.
- Confirmar que un error del PDF o de la subida no crea un registro de certificado ni dispara el correo.

## 4. Pruebas automatizadas

Archivos previstos:

- Nuevos tests en `src/lib/__tests__/` o junto a la lógica correspondiente.
- Ajustes puntuales a los tests existentes de certificados y cursos.

Casos:

1. Slogan válido, espacios extremos, vacío y mayor de 100 caracteres.
2. Crear y actualizar cursos activos/inactivos con y sin slogan.
3. Acceso existente independiente de `isActive`.
4. Construcción de la plantilla con todos los campos dinámicos escapados, el slogan y la URL de QR correcta.
5. Servicio de certificados: carga del slogan y rechazo explícito si está ausente.

## 5. Verificación y documentación de cierre

1. Ejecutar `npm test`, `npm run lint` y una generación de PDF de muestra.
2. Revisar el PDF visualmente y comprobar la página de verificación del código utilizado.
3. Leer `skills/documentation-rules.md`, actualizar la documentación de certificados y registrar la decisión en `engram.json`.
4. Confirmar que la rama mantiene únicamente los cambios de esta funcionalidad y preparar su entrega para revisión hacia `dev`.
