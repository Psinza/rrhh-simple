$ErrorActionPreference = "Stop"
$InstallDir = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $InstallDir "server\.env"))) {
  throw "No existe la configuración local. Ejecute windows\install.ps1 primero."
}

Push-Location $InstallDir
try {
  Start-Process "http://127.0.0.1:4000"
  npm --prefix server start
} finally {
  Pop-Location
}
