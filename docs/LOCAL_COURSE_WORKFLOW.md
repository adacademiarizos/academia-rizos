# Entorno local y flujo de cursos

Esta guía usa PostgreSQL 16 en Docker Compose. No requiere una cuenta de Cloudflare para arrancar la aplicación con los cursos demo; sí requiere R2 configurado para subir archivos nuevos desde el editor.

## 1. Preparar el entorno

Requisitos:

- Docker Desktop iniciado.
- Node.js 18 o superior.
- npm.

En la raíz del proyecto:

```bash
npm ci
copy .env.local.example .env.local
npm run db:setup
```

En macOS/Linux, el segundo comando equivalente es:

```bash
cp .env.local.example .env.local
```

`npm run db:setup` levanta PostgreSQL en el puerto `5433`, aplica las migraciones, genera Prisma y carga los datos demo. La primera ejecución descarga la imagen de PostgreSQL y puede tardar un poco.

Después, inicia la aplicación:

```bash
npm run dev
```

Abre <http://localhost:3000/signin>.

Comandos útiles:

```bash
npm run db:up       # Levantar PostgreSQL
npm run db:down     # Detenerlo sin borrar los datos
npm run db:logs     # Ver los logs de PostgreSQL
npm run db:migrate  # Aplicar migraciones pendientes
npm run db:generate # Regenerar Prisma Client
npm run seed        # Volver a cargar datos demo de forma repetible
npx prisma studio   # Explorar la base de datos visualmente
```

Para borrar por completo la base local y empezar de cero:

```bash
docker compose down -v
npm run db:setup
```

El parámetro `-v` borra el volumen local de PostgreSQL y, por tanto, todos los datos de desarrollo.

## 2. Usuarios de prueba

| Rol | Email | Contraseña | Entrada principal |
|---|---|---|---|
| Admin | `admin@elizabeth.com` | `admin123` | `/admin` |
| Estudiante | `student@elizabeth.com` | `student123` | `/student` |

El seed también crea `staff@elizabeth.com` / `staff123` y `student2@elizabeth.com` / `student123` para pruebas adicionales.

El estudiante principal recibe acceso demo permanente al Curso 1 y acceso temporal al Curso 2. Además, el seed deja algunos módulos del Curso 1 completados para comprobar el estado de progreso.

## 3. Cómo crear un curso como admin

1. Inicia sesión en `/signin` con `admin@elizabeth.com` y ``.
2. Abre `/admin/courses`.
3. Pulsa **+ Nuevo Curso**.
4. Carga una miniatura, escribe título y descripción, indica el precio y, si corresponde, los días de alquiler. Deja los días vacíos para acceso permanente.
5. Mantén **Activar curso al crear** seleccionado y pulsa **Crear curso**.
6. Abre el título del curso creado para entrar en `/admin/courses/[courseId]/edit`.
7. Crea los módulos en orden. Cada módulo representa una sección del curso.
8. Dentro de cada módulo, crea estilos opcionales como `General`, `Rizos` o `Afro`; luego añade las lecciones dentro del estilo.
9. Para cada lección, completa título, descripción, video y transcripción. Puedes pegar una URL pública de video o subir un archivo a R2.
10. Añade recursos PDF, imágenes u otros documentos desde el bloque de recursos del módulo.
11. Si necesitas evaluación, crea un test de módulo o un examen de curso, define puntuación mínima e incorpora sus preguntas.
12. Revisa que el curso esté activo y guarda los cambios.

La jerarquía que verá el estudiante es:

```text
Curso
└── Módulo / sección
    └── Estilo (opcional)
        └── Lección
```

El progreso se marca por módulo, no por estilo o lección.

## 4. Cómo completar un curso como estudiante

1. Cierra la sesión admin e inicia sesión con `student@elizabeth.com` y `student123`.
2. Entra en `/student` y abre un curso con acceso.
3. Abre el primer módulo desde el panel del curso.
4. Reproduce la lección, revisa la descripción/transcripción y descarga los recursos.
5. Si hay un test, ábrelo desde la columna lateral y envía las respuestas.
6. Pulsa **Marcar como completado** cuando termines el módulo.
7. Repite el proceso con todos los módulos.
8. Cuando estén cumplidos los requisitos, abre el examen final del curso y envíalo.
9. Si el examen requiere revisión manual, el admin lo revisa desde `/admin/courses/review`.
10. Tras la aprobación, el certificado se puede consultar desde el dashboard y verificar públicamente mediante su código QR.

Para verificar el estado directamente, el estudiante puede volver a `/learn/[courseId]` y comprobar el porcentaje de módulos completados.

## 5. Configurar Cloudflare R2 para archivos del curso

El editor usa R2 mediante URLs firmadas para que los videos grandes no pasen por el servidor de Next.js. Sin R2, el entorno local guarda las miniaturas pequeñas en `public/uploads` para que puedas crear y probar un curso; estos archivos no se publican y no sirven para videos o recursos grandes.

1. En Cloudflare, crea un bucket R2, por ejemplo `academia-rizos`.
2. Crea un API token con permisos de lectura/escritura para ese bucket.
3. Activa una URL pública `r2.dev` o configura un dominio propio para reproducir videos e imágenes.
4. Copia estos valores en `.env.local`:

```dotenv
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
R2_BUCKET_NAME=academia-rizos
R2_PUBLIC_URL=https://pub-XXXX.r2.dev
```

5. Reinicia `npm run dev`.
6. Desde el editor admin, usa **Subir** en la miniatura, video o recurso. Los archivos se guardan con una ruta por curso, por ejemplo `courses/<courseId>/video/...`.

No guardes estas claves en Git, en el frontend ni en un archivo que vayas a compartir. Para producción, configura las mismas variables como secretos del proveedor de despliegue.

### CORS para videos y recursos

Las cargas de video y recursos se envían directamente al bucket mediante una URL firmada. En Cloudflare, abre **R2 > elizabeth-rizos > Settings > CORS Policy** y guarda esta regla para desarrollo local:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://academia-rizos-mw1d.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Cuando publiques la plataforma, añade también el dominio final, por ejemplo `https://academia.tudominio.com`, en `AllowedOrigins`. `ExposeHeaders: ["ETag"]` es obligatorio para completar cargas multipart. Cloudflare exige permisos de administración del bucket para cambiar esta política; las claves de lectura/escritura de objetos no bastan.

## 6. Importar el contenido de Google Drive

El repositorio no debe contener credenciales de Google Drive. Para incorporar el contenido real del curso:

1. Descarga los videos, PDFs, imágenes y documentos desde la carpeta compartida.
2. Ordena los archivos localmente por `Curso/Módulo/Lección`.
3. Crea el curso y sus módulos en el editor.
4. Sube cada archivo desde la lección o el módulo correspondiente.
5. Usa nombres descriptivos y comprueba cada URL reproduciendo el video o abriendo el recurso desde una sesión estudiante.

Si la carpeta de Drive contiene subcarpetas con una jerarquía clara, esa jerarquía debe mapearse a módulos y estilos; no conviene mezclar archivos de distintas lecciones en un único recurso.

## 7. Verificación rápida

```bash
npm test
npm run build
```

Prueba manual mínima:

- el admin puede abrir `/admin/courses`;
- el estudiante puede abrir el Curso 1;
- un módulo puede marcarse como completado;
- los recursos abren desde el reproductor;
- el test registra un resultado;
- el curso mantiene el progreso después de cerrar y volver a iniciar sesión.
