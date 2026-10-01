$ErrorActionPreference = "Stop"
$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

if (-not (Get-Command "docker" -ErrorAction SilentlyContinue)) {
  throw "Docker no está instalado. Instale Docker Desktop, inícielo y vuelva a ejecutar este archivo."
}

docker compose version | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "No se encontró Docker Compose v2. Actualice Docker Desktop y vuelva a ejecutar este archivo."
}

docker info | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Docker no está iniciado. Inicie Docker Desktop y vuelva a ejecutar este archivo."
}

$EnvFile = Join-Path $ProjectDir ".env"
if (-not (Test-Path $EnvFile)) {
  $Random = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
  try {
    $DatabaseBytes = New-Object byte[] 32
    $JwtBytes = New-Object byte[] 48
    $Random.GetBytes($DatabaseBytes)
    $Random.GetBytes($JwtBytes)
    $DatabasePassword = [BitConverter]::ToString($DatabaseBytes).Replace("-", "").ToLowerInvariant()
    $JwtSecret = [BitConverter]::ToString($JwtBytes).Replace("-", "").ToLowerInvariant()
  } finally {
    $Random.Dispose()
  }

  $Utf8NoBom = New-Object System.Text.UTF8Encoding -ArgumentList $false
  $Lines = @("POSTGRES_PASSWORD=$DatabasePassword", "JWT_SECRET=$JwtSecret")
  [System.IO.File]::WriteAllLines($EnvFile, $Lines, $Utf8NoBom)
  Write-Host "Se creó .env con secretos aleatorios locales."
}

docker compose up --build -d
if ($LASTEXITCODE -ne 0) {
  throw "No se pudo iniciar RRHH-Simple. Revise la salida anterior y los requisitos Docker."
}

Write-Host "RRHH-Simple está iniciando en http://127.0.0.1:4000"
Start-Process "http://127.0.0.1:4000"
