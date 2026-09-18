$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$iscc = Get-Command "ISCC.exe" -ErrorAction SilentlyContinue

if ($null -eq $iscc) {
  throw "No se encontró Inno Setup (ISCC.exe). Instálelo y vuelva a ejecutar este script."
}

& $iscc.Source (Join-Path $PSScriptRoot "RRHH-Simple.iss")
