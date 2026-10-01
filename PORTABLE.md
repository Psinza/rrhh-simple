# Ejecutar RRHH-Simple en Linux o Windows

Este paquete contiene la aplicación y PostgreSQL para uso local mediante Docker Compose. Los datos se conservan en un volumen Docker local; no se conecta a la base de datos de Render ni importa datos de producción.

## Requisitos

- Docker con Docker Compose v2 instalado y en ejecución.
- Conexión a Internet en el primer arranque para descargar imágenes y dependencias.
- Aproximadamente 2 GB de espacio libre para la construcción inicial.

En Windows, instale e inicie Docker Desktop. En Linux, instale Docker Engine y el complemento Docker Compose para su distribución. Para Linux, OpenSSL también debe estar disponible para generar secretos locales.

## Inicio en Windows

1. Extraiga el ZIP en una carpeta local.
2. Abra PowerShell en esa carpeta.
3. Si la política de ejecución bloquea el script, ejecute `Set-ExecutionPolicy -Scope Process Bypass`.
4. Ejecute `.\start-windows.ps1`.
5. Abra `http://127.0.0.1:4000` si el navegador no se abrió automáticamente.

También puede iniciar PowerShell como administrador y ejecutar `windows\install.ps1` para la instalación nativa existente, que instala Node.js y PostgreSQL y no requiere Docker.

## Inicio en Linux

1. Extraiga el ZIP en una carpeta local.
2. Abra una terminal en esa carpeta.
3. Ejecute `bash ./start-linux.sh`.
4. Abra `http://127.0.0.1:4000`.

## Primer inicio de sesión

La base local comienza vacía: las migraciones crean las tablas, pero no insertan cuentas ni contraseñas de demostración. Una vez que el lanzador haya iniciado la aplicación, abra otra terminal en la carpeta del paquete y ejecute:

```sh
docker compose exec -it app node server/bootstrap-admin.js
```

El asistente solicita el RIF de la empresa configurado en la aplicación y los datos de una cuenta nueva de administrador. La contraseña se escribe sin mostrarse y no se guarda en archivos. El comando solo funciona si todavía no existe ningún usuario en la base; no elimina ni reemplaza cuentas. Después, inicie sesión en `http://127.0.0.1:4000` con el nombre de usuario y la contraseña que acaba de crear, seleccionando el perfil **Administrador del Sistema**.

## Detener y volver a iniciar

Desde la carpeta del paquete:

```sh
docker compose down
```

Esto conserva la base local. Para iniciar de nuevo, ejecute el lanzador de su sistema operativo. No elimine el volumen `rrhh-simple-postgres-data` si necesita conservar los datos.

Los secretos locales se guardan en `.env`, creado automáticamente la primera vez. No lo comparta ni lo publique. El puerto queda limitado a la máquina local. Este paquete es para evaluación local; no está configurado para exponer el servicio en Internet ni para reemplazar un despliegue productivo.
