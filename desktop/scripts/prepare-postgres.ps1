# Descarga los binarios portables de PostgreSQL (EDB) y los deja en desktop\resources\pgsql
# para que el instalador los incluya. No instala nada en el sistema.
param(
  [string]$Url = 'https://get.enterprisedb.com/postgresql/postgresql-16.15-3-windows-x64-binaries.zip'
)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # acelera mucho Invoke-WebRequest
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$desktop = Split-Path -Parent $PSScriptRoot
$cache   = Join-Path $desktop '.cache'
$zip     = Join-Path $cache 'postgresql-binaries.zip'
$extract = Join-Path $cache 'pg-extract'
$target  = Join-Path $desktop 'resources\pgsql'

if (Test-Path (Join-Path $target 'bin\postgres.exe')) {
  Write-Host "PostgreSQL ya preparado en $target (borre esa carpeta para volver a descargarlo)."
  exit 0
}

New-Item -ItemType Directory -Force -Path $cache | Out-Null
if (-not (Test-Path $zip)) {
  Write-Host "Descargando PostgreSQL portable desde:`n  $Url"
  Invoke-WebRequest -Uri $Url -OutFile $zip -UseBasicParsing
}
Write-Host ("Hash SHA-256: " + (Get-FileHash $zip -Algorithm SHA256).Hash)

if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Write-Host 'Descomprimiendo...'
Expand-Archive -Path $zip -DestinationPath $extract -Force

$src = Join-Path $extract 'pgsql'
if (-not (Test-Path (Join-Path $src 'bin\postgres.exe'))) { throw "El ZIP no tiene la estructura esperada (pgsql\bin\postgres.exe)." }

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
Move-Item $src $target

# Quitar lo que no hace falta para ejecutar (ahorra ~250 MB en el instalador)
foreach ($d in 'pgAdmin 4','StackBuilder','doc','symbols','include') {
  $p = Join-Path $target $d
  if (Test-Path $p) { Remove-Item $p -Recurse -Force }
}

# Runtime de Visual C++: se copia junto a postgres.exe (despliegue local) si el ZIP no lo trae,
# así el equipo destino no necesita instalar el "Visual C++ Redistributable".
$bin = Join-Path $target 'bin'
foreach ($dll in 'vcruntime140.dll','vcruntime140_1.dll','msvcp140.dll') {
  if (-not (Test-Path (Join-Path $bin $dll))) {
    $sys = Join-Path $env:WINDIR "System32\$dll"
    if (Test-Path $sys) { Copy-Item $sys $bin; Write-Host "Copiado $dll" }
    else { Write-Warning "No se encontró $dll; instale el VC++ Redistributable x64 en esta PC y repita." }
  }
}

$mb = [math]::Round(((Get-ChildItem $target -Recurse -File | Measure-Object Length -Sum).Sum) / 1MB)
Write-Host "Listo: PostgreSQL preparado en $target ($mb MB)"
