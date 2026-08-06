# Certificados de academia con slogan por curso

Actualizado: 2026-08-06

## Proposito de la funcionalidad

Los certificados de la academia se emiten con el modelo visual aprobado de Elizabeth Rizos: A4 horizontal, fondo institucional, logo, sello, tipografias y tarjeta QR. Cada emision usa los datos almacenados del certificado y el slogan definido por el administrador para el curso.

El slogan es informacion obligatoria para publicar un curso, pero no para guardarlo como borrador. Asi se evita vender o completar un curso cuyo certificado no tenga el texto editorial aprobado.

## Flujo de datos

```mermaid
flowchart LR
  A[Administrador crea o edita curso] --> B{Curso publicado?}
  B -- No --> C[Borrador: slogan opcional]
  B -- Si --> D{Slogan valido, <= 100 caracteres?}
  D -- No --> E[API rechaza la publicacion]
  D -- Si --> F[Course.certificateSlogan]
  F --> G[Alumna completa y aprueba]
  G --> H[Servicio de certificados]
  H --> I[PDF A4 con modelo exacto]
  I --> J[QR: /verify/certificate/{code}]
  I --> K[Subida y registro del certificado]
  K --> L[Correo con enlaces]
```

## API y contrato de datos

- `Course.certificateSlogan` es nullable para permitir borradores. Su valor publicado se recorta de espacios exteriores y debe ser texto no vacio de un maximo de 100 caracteres.
- `POST /api/admin/courses` y `PUT /api/admin/courses/[courseId]` rechazan con HTTP 400 un curso activo sin slogan valido. Esta regla es de servidor y no depende de la interfaz.
- Las pantallas `/admin/courses` y `/admin/courses/[courseId]/edit` permiten editar el slogan, muestran el limite y no activan el curso si falta.
- Al emitir, el servicio obtiene el slogan del curso. Si el dato falta, la emision se detiene antes de generar el PDF, subir archivos, crear el registro o enviar correo.
- El QR usa `NEXT_PUBLIC_APP_URL` y apunta a `/verify/certificate/{code}`. Si no existe la variable, el entorno local usa `http://localhost:3000`.

## Decisiones criticas

- La plantilla HTML suministrada por negocio es la fuente de verdad visual. Sus recursos y fuentes se empaquetan localmente y se incrustan para que el PDF no dependa de red en tiempo de emision.
- La migracion `20260805120000_add_certificate_slogan` agrega el campo y desactiva los cursos sin slogan. No revoca accesos ya existentes; solamente evita su exhibicion y venta como cursos activos.
- La plataforma no tenia alumnas ni certificados al tomar esta decision, por lo que no se requiere regeneracion de historicos.
- La fecha se imprime en el campo de fecha existente del modelo. Los textos dinamicos se escapan antes de construir el HTML del PDF.

## Operacion y verificacion

En un entorno configurado, aplicar la migracion con `npx prisma migrate deploy` antes de publicar el cambio. Los cursos afectados se deben completar con su slogan y activar explicitamente desde administracion.

La verificacion del cambio incluye `npm test -- --runInBand`, `npx tsc --noEmit`, `npx prisma validate` y una inspeccion visual de un PDF de ejemplo. El lint completo del repositorio conserva errores preexistentes fuera de esta funcionalidad; el lint de los archivos modificados no tiene errores.
