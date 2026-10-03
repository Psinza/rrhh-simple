# RRHH Simple — versión de escritorio para Windows

Convierte el proyecto en una aplicación instalable (`RRHH Simple Setup x.y.z.exe`) que trae **todo incluido**:

- **Electron**: la ventana de la aplicación (no necesita navegador ni Node.js en el equipo del usuario).
- **PostgreSQL 16 portable**: se instala dentro de la aplicación, se crea y arranca solo, y se detiene al cerrar. No se instala como servicio ni toca otro PostgreSQL que ya exista en la PC.
- **Servidor Express** del proyecto, con sus datos guardados en PostgreSQL.

El usuario final solo ejecuta el instalador y abre "RRHH Simple" desde el escritorio. No configura nada.

## 1. Generar el instalador (una sola vez, en su PC de desarrollo)

1. Copie la carpeta **`desktop`** dentro de `D:\Proyecto\rrhh-simple-main\`.
2. Reemplace **`src\services\lightweightDb.ts`** por el archivo incluido en este paquete.
3. Haga doble clic en **`desktop\build-windows.bat`**.

El script instala Node.js (con `winget`, si falta), compila la interfaz, descarga PostgreSQL portable, y genera el instalador en `desktop\release\`. Necesita internet y tarda ~10 min la primera vez.
Para compilar, use Node.js **20.x**, la versión declarada por el proyecto. Si ya tiene otra versión instalada, `npm` puede mostrar una advertencia `EBADENGINE`.

Para probar sin instalar: dentro de `desktop`, tras correr el .bat una vez, use `npm start`.

## 2. Qué hace la aplicación al abrirse

1. Crea (solo la 1.ª vez) el clúster de PostgreSQL en `%APPDATA%\RRHH Simple\pgdata` con contraseña aleatoria (guardada en `secrets.json` en esa misma carpeta).
2. Arranca PostgreSQL en `127.0.0.1` (solo local, puerto 54329 o el primero libre), crea la base `rrhh` y las tablas.
3. Arranca el servidor en `127.0.0.1:47821` (o puerto libre) y abre la ventana. Solo la ventana de la aplicación puede consultarlo (token por sesión).
4. Al cerrar: guarda cambios pendientes, hace un respaldo automático y detiene PostgreSQL.

**Datos:** todo el estado de la aplicación (empleados, nómina, ventas, préstamos, auditoría, empresa, usuarios) se guarda en PostgreSQL (tabla `app_state`, más la tabla `users` para el login del servidor).

**Respaldos:**
- Automático al cerrar: `Documentos\RRHH Simple\Respaldos\auto-AAAA-MM-DD.dump` (se conservan los últimos 15 días).
- Manual: menú **Archivo → Respaldar base de datos… / Restaurar respaldo…**
- Desinstalar la aplicación **no** borra los datos (`%APPDATA%\RRHH Simple`).

## 3. Migrar datos que ya tiene en la versión web

En la versión anterior abra el módulo **Base de datos** y pulse **Exportar JSON Completo**; en la aplicación de escritorio abra ese mismo módulo y use **Restaurar Copia (.JSON)**. (Los datos de la versión web viven en el localStorage de ese navegador, no en PostgreSQL.)

## 4. Cambios respecto al proyecto original

- `src/services/lightweightDb.ts`: en escritorio lee/guarda el estado en PostgreSQL vía `/api/state`. En la versión web no cambia nada (solo actúa si existe `window.rrhhDesktop`).
- `desktop/server/`: copia del servidor adaptada (usa `bcryptjs` en vez de `bcrypt` para no compilar módulos nativos; endpoints `/api/state`; escucha solo en 127.0.0.1). **El servidor original (`server/`) y el despliegue en Render no se tocaron.**
- Los usuarios iniciales ya **no se reescriben en cada arranque** (el original restablecía las contraseñas al iniciar).

## 5. ⚠ Seguridad — revise antes de distribuir

- `src/data/authUsers.ts` y `server/db.js` contienen **contraseñas y correos reales en texto plano**, y el repositorio en GitHub es público. Cámbielas y considere rotarlas ya mismo.
- El inicio de sesión de la interfaz se valida **en el navegador** con esa lista (el backend se consulta solo de forma secundaria), así que las credenciales viajan dentro del JavaScript compilado. Para uso interno en una PC es tolerable; si el sistema va a manejar nómina real, conviene mover la validación al servidor.
- `firebase-applet-config.json` incluye la configuración de su proyecto Firebase.

## 6. Solución de problemas

| Síntoma | Qué hacer |
|---|---|
| `EPERM: operation not permitted, rename ... win-unpacked.tmp` | Guarde los cambios y cierre todas las ventanas de RRHH Simple, además de las ventanas del Explorador abiertas dentro de `desktop\release`; vuelva a ejecutar `build-windows.bat`. El script verifica que la aplicación esté cerrada, limpia automáticamente las carpetas temporales de compilaciones anteriores, reintenta bloqueos momentáneos de Windows y conserva el instalador existente. |
| "PostgreSQL no pudo iniciar" | Abra **Archivo → Abrir carpeta de registros** y revise `postgres.log`. Si dice que falta una DLL (`vcruntime140`), instale el *Visual C++ Redistributable x64* de Microsoft. |
| No arranca si se ejecuta "como administrador" | PostgreSQL no debe correr con privilegios elevados; ejecute la aplicación con un usuario normal. |
| SmartScreen advierte "editor desconocido" | El instalador no está firmado digitalmente. "Más información → Ejecutar de todas formas", o firme el .exe con un certificado. |
| El .bat no descarga PostgreSQL (404) | Ajuste la URL en `scripts\prepare-postgres.ps1` (lista en enterprisedb.com/download-postgresql-binaries). |
| Otra PC de la red quiere usar los mismos datos | Esta versión es monousuario/local. Para varios usuarios se necesita un servidor central. |
