# Quedamos Beta Bot

Bot de Telegram para distribución privada de la beta de Quedamos.

## Funcionalidades

- ✅ Validación de código de invitación
- ✅ Registro automático de usuarios en Supabase
- ✅ Generación de contraseñas aleatorias seguras
- ✅ Distribución de APK via Telegram (sin almacenamiento externo)
- ✅ Verificación anti-duplicados de emails
- ✅ Comandos administrativos

## Flujo de Usuario

1. Usuario inicia con `/start`
2. Introduce código de invitación
3. Proporciona nombre
4. Proporciona email
5. Bot crea cuenta en Supabase
6. Supabase envía email de confirmación
7. Bot entrega credenciales y APK

## Comandos

### Usuarios

- `/start` - Iniciar proceso de registro
- `/apk` - Descargar la app (solo usuarios registrados)
- `/web` - Obtener enlace a versión web

### Administrador

- `/upload` - Subir nuevo APK (enviar archivo después del comando)
- `/users` - Listar usuarios registrados con estado de confirmación

## Configuración

### 1. Crear bot de Telegram

Habla con [@BotFather](https://t.me/BotFather):

```
/newbot
Bot name: Quedamos Beta Bot
Bot username: quedamos_beta_bot (o similar)
```

Copia el token que te da BotFather.

### 2. Obtener tu Telegram ID

Habla con [@userinfobot](https://t.me/userinfobot) para obtener tu ID de usuario.

### 3. Variables de entorno

Crea `.env` basándote en `.env.example`:

```bash
cp .env.example .env
```

Rellena los valores:

```env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
BETA_INVITE_CODE=QUEDAMOSBETAPRIVADA2026
ADMIN_TELEGRAM_ID=123456789
WEB_URL=https://quedamos-app-mobile.vercel.app
```

**Importante:**
- `SUPABASE_SERVICE_KEY`: Usa el **service_role** key (no el anon key)
- `ADMIN_TELEGRAM_ID`: Tu ID de Telegram (no el del bot)

### 4. Instalar dependencias

```bash
npm install
```

> **Nota**: Este bot es independiente del monorepo principal y usa `npm` en lugar de `pnpm`.

## Uso Local

### Desarrollo

```bash
npm run dev
```

### Build y ejecución

```bash
npm run build
npm start
```

## Deploy en Railway

### 1. Crear nuevo servicio

En el proyecto de Railway de Quedamos, añade un nuevo servicio:

- **Source**: Mismo repositorio que la API
- **Root Directory**: `tools/beta-bot`

### 2. Configurar build

```
Build Command: npm install && npm run build
Start Command: npm start
```

### 3. Variables de entorno

Añade las mismas variables que en `.env`:

- `TELEGRAM_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `BETA_INVITE_CODE`
- `ADMIN_TELEGRAM_ID`
- `WEB_URL`

### 4. Deploy

Railway desplegará automáticamente al hacer push a la rama configurada.

## Gestión del APK

### Subir APK (primera vez)

1. Habla con el bot desde tu cuenta de administrador
2. Envía `/upload`
3. Envía el archivo `.apk`
4. El bot guardará el `file_id` en `.apk-file-id`

### Actualizar APK

Simplemente repite el proceso anterior. El nuevo `file_id` sobrescribirá el anterior.

**Ventajas:**
- ✅ No ocupa espacio en el repositorio
- ✅ Telegram gestiona el almacenamiento
- ✅ Actualización instantánea para nuevos usuarios
- ✅ Sin necesidad de CDN o hosting externo

## Seguridad

- ✅ Código de invitación requerido
- ✅ Comandos admin protegidos por ID de Telegram
- ✅ Contraseñas aleatorias de 8 caracteres (mayúscula + minúscula + número + especial)
- ✅ Verificación de duplicados de email
- ✅ Service key de Supabase nunca expuesto al cliente

## Monitoreo

Ver logs en Railway o en consola local:

```bash
npm run dev
```

El bot muestra:
- ✅ Usuarios registrados
- ✅ APK file_id cargado
- ✅ Errores de Supabase
- ✅ Comandos ejecutados

## Testing

### Flujo completo

1. Habla con el bot: `/start`
2. Introduce código: `QUEDAMOSBETAPRIVADA2026`
3. Nombre: `Test User`
4. Email: `test@example.com`
5. Verifica recepción de credenciales
6. Verifica recepción del APK
7. Confirma email desde el enlace de Supabase
8. Login en la app con las credenciales

### Verificar usuarios

Como admin:

```
/users
```

Deberías ver la lista de usuarios con su estado de confirmación (✅ confirmado, ⏳ pendiente).

## Troubleshooting

### El bot no responde

- Verifica que el token sea correcto
- Asegúrate de que el bot esté ejecutándose (`npm run dev`)
- Revisa los logs por errores

### Error al crear usuario

- Verifica `SUPABASE_SERVICE_KEY` (debe ser service_role, no anon)
- Revisa que la URL de Supabase sea correcta
- Comprueba los logs de Supabase

### APK no se envía

- Ejecuta `/upload` como admin y sube el APK
- Verifica que el archivo `.apk-file-id` existe
- Comprueba que el archivo subido sea un `.apk` válido

### Email no se envía

Supabase envía automáticamente el email de confirmación cuando se crea el usuario con `email_confirm: false`. Verifica:

- Configuración de email en Supabase Dashboard
- Carpeta de spam del usuario
- Logs de Supabase → Authentication → Email

## Licencia

MIT
