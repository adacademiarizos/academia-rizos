# Certificados de academia

Actualizado: 2026-09-01

## Proposito de la funcionalidad

Los certificados de la academia se emiten con el modelo visual aprobado de Elizabeth Rizos: A4 horizontal, fondo institucional, logo, sello, tipografias y tarjeta QR. Cada emision usa los datos almacenados del certificado.

## Flujo de datos

```mermaid
flowchart LR
  A[Alumna completa y aprueba] --> B[Servicio de certificados]
  B --> C[PDF A4 con modelo exacto]
  C --> D[QR: /verify/certificate/{code}]
  C --> E[Subida y registro del certificado]
  E --> F[Correo con enlaces]
```

## API y contrato de datos

- El QR usa `NEXT_PUBLIC_APP_URL` y apunta a `/verify/certificate/{code}`. Si no existe la variable, el entorno local usa `http://localhost:3000`.

## Decisiones criticas

- La plantilla HTML suministrada por negocio es la fuente de verdad visual. Sus recursos y fuentes se empaquetan localmente y se incrustan para que el PDF no dependa de red en tiempo de emision.
- `Course.certificateSlogan` fue retirado el 2026-09-01 (`DROP COLUMN`, irreversible). Los certificados ya emitidos NO se regeneran: sus PDF historicos conservan la linea de especializacion impresa tal como se emitio.
- La fecha se imprime en el campo de fecha existente del modelo. Los textos dinamicos se escapan antes de construir el HTML del PDF.

## Operacion y verificacion

En un entorno configurado, aplicar la migracion con `npx prisma migrate deploy` antes de publicar el cambio. Los cursos afectados se deben completar con su slogan y activar explicitamente desde administracion.

La verificacion del cambio incluye `npm test -- --runInBand`, `npx tsc --noEmit`, `npx prisma validate` y una inspeccion visual de un PDF de ejemplo. El lint completo del repositorio conserva errores preexistentes fuera de esta funcionalidad; el lint de los archivos modificados no tiene errores.
