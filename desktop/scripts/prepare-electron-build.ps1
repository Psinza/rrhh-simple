$ErrorActionPreference = 'Stop'

$releaseDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'release'
$buildDirectory = Join-Path $releaseDirectory 'win-unpacked'
$stagingDirectory = "$buildDirectory.tmp"
$buildDirectoryPrefix = $buildDirectory.TrimEnd('\') + '\'

$runningBuildProcesses = Get-CimInstance Win32_Process | Where-Object {
  $_.Name -eq 'RRHH Simple.exe' -or (
    $_.ExecutablePath -and $_.ExecutablePath.StartsWith(
      $buildDirectoryPrefix,
      [System.StringComparison]::OrdinalIgnoreCase
    )
  )
}

if ($runningBuildProcesses) {
  $runningBuildProcesses | ForEach-Object {
    Write-Host "RRHH Simple sigue abierto (PID $($_.ProcessId)): $($_.ExecutablePath)"
  }
  throw 'Guarde los cambios, cierre todas las ventanas de RRHH Simple y vuelva a ejecutar build-windows.bat.'
}

foreach ($directory in @($buildDirectory, $stagingDirectory)) {
  if (Test-Path -LiteralPath $directory) {
    $removed = $false
    for ($attempt = 1; $attempt -le 5 -and -not $removed; $attempt++) {
      try {
        Remove-Item -LiteralPath $directory -Recurse -Force
        Write-Host "Se limpio la carpeta de compilacion anterior: $directory"
        $removed = $true
      } catch {
        if ($attempt -eq 5) {
          throw "No se pudo limpiar '$directory'. Cierre RRHH Simple y las ventanas del Explorador abiertas en esa carpeta; espere a que el antivirus termine de analizarla y vuelva a ejecutar build-windows.bat. Detalle: $($_.Exception.Message)"
        }
        Start-Sleep -Seconds 2
      }
    }
  }
}
