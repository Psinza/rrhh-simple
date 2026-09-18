param(
  [string]$InstallDir = (Join-Path $env:ProgramFiles "RRHH-Simple"),
  [string]$PostgresPassword = ""
)

$ErrorActionPreference = "Stop"

function Test-Command([string]$Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

if (-not (Test-Command "winget")) {
  throw "winget no está disponible. Instale App Installer desde Microsoft Store y vuelva a ejecutar este archivo."
}

if (-not (Test-Command "node")) {
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
}

if (-not (Test-Command "psql")) {
  winget install --id PostgreSQL.PostgreSQL --exact --accept-package-agreements --accept-source-agreements
}

# winget updates PATH for future processes; refresh it for this PowerShell process too.
$env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
  [Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Test-Command "node") -or -not (Test-Command "psql")) {
  throw "No se encontraron node o psql después de la instalación. Cierre y vuelva a abrir PowerShell como administrador."
}

if ([string]::IsNullOrWhiteSpace($PostgresPassword)) {
  $secure = Read-Host "Contraseña del usuario postgres de PostgreSQL" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try {
    $PostgresPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

$postgresServices = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue
foreach ($service in $postgresServices) {
  if ($service.Status -ne "Running") {
    Start-Service -Name $service.Name
  }
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
$sourceDir = Split-Path -Parent $PSScriptRoot
Copy-Item (Join-Path $sourceDir "*") $InstallDir -Recurse -Force -Exclude ".git","node_modules","dist","server\.env"

$env:PGPASSWORD = $PostgresPassword
$psqlArgs = @("-h", "127.0.0.1", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1")
$sqlPassword = $PostgresPassword.Replace("'", "''")
$sql = @"
DO `$`$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'rrhh_dev') THEN
    CREATE ROLE rrhh_dev LOGIN PASSWORD '$sqlPassword';
  ELSE
    ALTER ROLE rrhh_dev WITH LOGIN PASSWORD '$sqlPassword';
  END IF;
END
`$`$;
SELECT 'CREATE DATABASE rrhh_simple OWNER rrhh_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'rrhh_simple')\gexec
"@
$sql | psql @psqlArgs
Remove-Item Env:PGPASSWORD

Push-Location $InstallDir
try {
  npm install
  npm install --prefix server
  npm run build

  $jwt = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
  $databasePassword = [Uri]::EscapeDataString($PostgresPassword)
  @"
NODE_ENV=production
PORT=4000
SERVE_STATIC=true
ALLOWED_ORIGIN=http://127.0.0.1:4000
JWT_SECRET=$jwt
DATABASE_URL=postgresql://rrhh_dev:$databasePassword@127.0.0.1:5432/rrhh_simple
DATABASE_SSL=false
"@ | Set-Content -Encoding UTF8 (Join-Path $InstallDir "server\.env")
} finally {
  Pop-Location
}

Write-Host "RRHH-Simple instalado en $InstallDir"
Write-Host "Ejecute windows\start-rrhh.ps1 para iniciar el sistema."
