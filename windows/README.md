# Instalación local en Windows 10

## Requisitos

- Windows 10 de 64 bits.
- Internet durante la instalación.
- App Installer actualizado para disponer de `winget`.
- Permisos de administrador para instalar Node.js y PostgreSQL.

## Instalación rápida

Abra PowerShell como administrador desde esta carpeta y ejecute:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\install.ps1
```

El instalador:

1. Instala Node.js LTS y PostgreSQL mediante `winget` si no están instalados.
2. Crea el usuario PostgreSQL `rrhh_dev`.
3. Crea la base local `rrhh_simple`.
4. Instala las dependencias del frontend y del servidor.
5. Compila el frontend.
6. Genera `server\.env` con una clave JWT aleatoria y la conexión local.

## Arranque

```powershell
.\start-rrhh.ps1
```

Abra `http://127.0.0.1:4000`. El servidor Express sirve la aplicación compilada y la API desde el mismo puerto.

También puede ejecutar `start-rrhh.cmd` con doble clic.

## Generar un instalador `.exe`

Instale Inno Setup en el equipo de compilación y ejecute:

```powershell
.\build-installer.ps1
```

El resultado se genera en `windows\output\RRHH-Simple-Setup.exe`. Este instalador requiere Internet en el primer arranque para instalar Node.js/PostgreSQL y no incluye contraseñas ni archivos `.env`.

## Seguridad

- No suba `server\.env` al repositorio.
- Cambie la contraseña de PostgreSQL si el equipo se comparte.
- El instalador está pensado para uso local; para producción se requiere endurecer firewall, copias de seguridad y gestión de secretos.
