$ErrorActionPreference = 'Stop'

$backendPath = Join-Path $PSScriptRoot 'backend'
$frontendPath = Join-Path $PSScriptRoot 'frontend'

$requiredFiles = @(
  (Join-Path $backendPath 'package.json'),
  (Join-Path $frontendPath 'package.json')
)

foreach ($requiredFile in $requiredFiles) {
  if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
    throw "Required project file not found: $requiredFile"
  }
}

$powerShellPath = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'

Start-Process -FilePath $powerShellPath -WorkingDirectory $backendPath -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-Command',
  'npm run dev'
)

Start-Process -FilePath $powerShellPath -WorkingDirectory $frontendPath -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-Command',
  'npm run dev'
)

Write-Host '3PL Dynamics development servers are starting:'
Write-Host '  Frontend: http://localhost:3000'
Write-Host '  Backend:  http://localhost:8888'
