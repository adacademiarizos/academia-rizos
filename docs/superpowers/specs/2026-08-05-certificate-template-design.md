# Diseño: certificado exacto con slogan por curso

## Objetivo

Emitir los certificados de la academia usando exactamente el modelo visual aprobado en `certificado_elizabeth_rizos_exact`: fondo, composición, logo, sello, ornamentos, tipografías y formato A4 horizontal. El contenido que identifica cada certificado será dinámico y verificable.

Además, cada curso publicado deberá definir un slogan propio para la línea de especialización del certificado. Ningún curso podrá publicarse sin ese dato.

## Alcance y criterios de aceptación

- El PDF conserva el diseño del modelo de referencia, sin botones, campos editables ni controles de impresión.
- Los valores dinámicos son: nombre de la alumna, título del curso, slogan del certificado, fecha de emisión, código y QR de validación.
- El QR apunta a `/verify/certificate/{code}` de la URL pública configurada para la plataforma.
- El administrador puede guardar un curso como borrador sin slogan, pero no puede activarlo/publicarlo hasta que el slogan sea válido.
- Un slogan válido es texto no vacío, sin espacios exteriores y de hasta 100 caracteres. Se renderiza en una sola línea para conservar las proporciones del modelo.
- La migración deja desactivados todos los cursos existentes que no tengan slogan. Como la plataforma aún no se ha lanzado, no hay accesos, alumnas ni certificados históricos que preservar o regenerar.
- La desactivación impide mostrar o vender el curso a nuevas alumnas. La lógica de acceso ya concedido no se revocará por desactivar un curso.

## Datos y administración

Se añadirá `certificateSlogan` opcional al modelo `Course`. Es opcional solo para permitir borradores; la regla de publicación exige que esté presente y sea válido cuando `isActive` es `true`.

El formulario de creación y el de edición de cursos para administradores incluirán el campo **Slogan del certificado**, con ayuda que explique su uso y su límite de 100 caracteres. La acción de publicar mostrará una validación clara si falta o excede el límite.

La validación se aplicará también en el servidor, no solo en el formulario, para proteger actualizaciones por API o peticiones manipuladas.

## Generación de PDF

La plantilla de referencia se convertirá en la fuente canónica de la generación:

- Los recursos visuales suministrados (fondo, logo ER y sello) se incluirán en el proyecto y se incorporarán como datos locales durante la generación del PDF.
- Las tipografías usadas por el modelo se empaquetarán localmente para que el resultado no dependa de la red durante la emisión.
- El HTML y CSS de impresión conservarán el tamaño A4 apaisado, los colores y las coordenadas del modelo.
- Se retirarán `contenteditable`, el botón de impresión y el código destinado solo a la vista manual.
- Los textos variables se escaparán antes de insertarlos en el HTML.
- El QR se generará con el enlace real de verificación y el código se mostrará en su campo del modelo.
- La fecha de emisión se mostrará en el campo de fecha ya previsto por el modelo, usando la fecha almacenada para el certificado.

El flujo existente mantiene su orden: generar el PDF, subirlo, crear el registro de certificado y, solo después, enviar el correo con el enlace de descarga y verificación. Si falla la generación o la subida, no se crea el certificado ni se envía el correo.

## Publicación y acceso

Al crear o actualizar un curso activo, el servidor verificará que `certificateSlogan` cumple la regla. Si no la cumple, rechazará el cambio con un error de validación.

La migración crea el nuevo campo sin valor y desactiva los cursos que carezcan de él. Para re-publicarlos, el administrador debe introducir un slogan y activar el curso expresamente. No se ejecutará una regeneración de certificados porque no existen certificados emitidos en producción.

## Pruebas y verificación

- Pruebas unitarias de la validación del slogan: requerido para publicar, límites, recorte de espacios y aceptación en borrador.
- Pruebas de los caminos de actualización/publicación para confirmar que el control existe también en servidor.
- Pruebas del generador de certificados para comprobar que el HTML de impresión recibe los valores dinámicos escapados, el slogan y la URL de verificación correcta.
- Prueba de migración o verificación de datos para confirmar que los cursos existentes quedan desactivados hasta tener slogan.
- Generación y revisión visual de un PDF de ejemplo a A4 horizontal para compararlo con el modelo aprobado.

## Fuera de alcance

- Cambiar el contenido o diseño del correo de certificado.
- Regenerar certificados históricos.
- Añadir personalización por alumna o edición manual de un certificado emitido.
- Cambiar la página pública de verificación, salvo el enlace que ya usa el QR.
