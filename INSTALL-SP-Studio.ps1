$ErrorActionPreference = "Stop"

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$project = Join-Path $HOME "SP-Studio"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $project "backups\v18-$stamp"

Write-Host "SP Studio V18 - installation / mise a jour" -ForegroundColor Cyan
Write-Host "Projet cible : $project"

if (-not (Test-Path $source)) { throw "Dossier source introuvable : $source" }
New-Item -ItemType Directory -Force -Path $project | Out-Null

if ((Get-ChildItem $project -Force -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0) {
    New-Item -ItemType Directory -Force -Path $backup | Out-Null
    $keep = @("backups","node_modules")
    Get-ChildItem $project -Force | Where-Object { $keep -notcontains $_.Name } | Copy-Item -Destination $backup -Recurse -Force
    Write-Host "Sauvegarde : $backup" -ForegroundColor DarkYellow
}

$exclude = @("backups","node_modules")
Get-ChildItem $source -Force | Where-Object { $exclude -notcontains $_.Name } | Copy-Item -Destination $project -Recurse -Force

Push-Location $project
try {
    npm install
    Write-Host "Verification syntaxe..." -ForegroundColor Cyan
    node --check .\src\serveur.js
    node --check .\src\analyser-site.js
    node --check .\src\agent-planner.js
    node --check .\src\generer-video.js
} finally { Pop-Location }

Write-Host ""
Write-Host "SP Studio V18 est installe." -ForegroundColor Green
Write-Host "Lance ensuite : node .\src\serveur.js"
Write-Host "Puis ouvre http://localhost:3000"
