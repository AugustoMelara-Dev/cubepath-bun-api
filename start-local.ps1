$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$bunFromPath = Get-Command bun -ErrorAction SilentlyContinue
$fallbackBun = Join-Path $env:USERPROFILE ".bun\bin\bun.exe"

if ($bunFromPath) {
  $bunExecutable = $bunFromPath.Source
} elseif (Test-Path $fallbackBun) {
  $bunExecutable = $fallbackBun
} else {
  throw "No se encontro Bun. Instala Bun o agrega bun.exe al PATH."
}

Set-Location $projectRoot
Write-Host "Levantando CubePath Bun OpenRouter en http://localhost:3000"
& $bunExecutable run index.ts
