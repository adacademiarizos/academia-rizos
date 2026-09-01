# Prueba local de cron jobs

## Qué dejé listo

- `.env` local creado con `DATABASE_URL`, `NEXTAUTH_SECRET` y `CRON_SECRET`.
- Fallback de almacenamiento local para certificados cuando no hay R2.
- Script para preparar fixtures de prueba de los tres jobs.
- Script para disparar los endpoints cron desde tu máquina.

## Paso a paso

### 1. Aplicar la migración nueva
```bash
npm run db:migrate
```

### 2. Cargar datos demo
```bash
npm run db:seed
```

### 3. Preparar datos específicos para cron
```bash
npm run cron:fixtures
```

Esto deja:

- un `CourseAccess` vencido para probar `expire-access`
- un examen final aprobado sin certificado válido para probar `issue-certificates`
- un pago `PAID` con recibo pendiente para probar `send-receipts`

### 4. Arrancar la app
```bash
npm run dev
```

### 5. Probar los tres jobs
En otra terminal:

```bash
npm run cron:test
```

Si quieres probar uno solo:

```bash
npm run cron:test -- expire-access
npm run cron:test -- issue-certificates
npm run cron:test -- send-receipts
```

## Qué deberías ver

### `expire-access`
- HTTP `200`
- JSON con `job: "expire-access"`
- `processed` mayor o igual a `1`

### `issue-certificates`
- HTTP `200`
- JSON con `job: "issue-certificates"`
- `processed` mayor o igual a `1`
- PDF generado en `public/local-uploads/certificates/`

### `send-receipts`
- HTTP `200`
- JSON con `job: "send-receipts"`
- `processed` mayor o igual a `1`

Nota:
- Si no configuraste Gmail, el envío real de email se omite en local por el comportamiento actual del proyecto.
- Si no configuraste R2, los certificados se guardan localmente en `public/local-uploads/`.

## Verificaciones manuales útiles

### Ver el PDF emitido
Abre en el navegador la URL que quedó guardada en la tabla `Certificate.pdfUrl`, o entra a:

```text
http://localhost:3000/local-uploads/certificates/<archivo>.pdf
```

### Confirmar recibo marcado como enviado
Abre Prisma Studio:

```bash
npx prisma studio
```

Y revisa en `Payment`:

- `receiptEmailSentAt` ya no debe estar en `null`
- `receiptToEmail` debe contener `student@elizabeth.com`

### Confirmar estado de alertas cron
En `Settings` revisa el campo `cronAlertState`.

## Troubleshooting rápido

### Error de conexión a PostgreSQL
Revisa que el servicio `postgresql-x64-18` siga corriendo y que la contraseña local del usuario `postgres` sea `dark`.

### El job de certificados falla
Ejecuta otra vez:

```bash
npm run cron:fixtures
```

Y confirma que `public/local-uploads/` sea escribible.
