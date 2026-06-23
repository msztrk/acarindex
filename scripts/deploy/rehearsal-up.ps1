#Requires -Version 5.1
# Yerel production-benzeri rehearsal — acarindex_dev'e dokunmaz
param(
  [ValidateSet('build', 'migrate', 'seed', 'up', 'smoke', 'backup', 'restore-test', 'restart-test', 'all')]
  [string]$Step = 'all'
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $Root

$ComposeFile = 'docker-compose.rehearsal.yml'
$Project = 'acarindex-rehearsal'
$EnvExample = 'deploy\.env.rehearsal.example'
$EnvFile = 'deploy\.env.rehearsal'
$BackupDir = 'deploy\rehearsal-backups'
$HostDbUrl = 'postgresql://acarindex_rehearsal:rehearsal_dev_password@127.0.0.1:5433/acarindex_rehearsal?schema=public'

function Invoke-Compose([string]$ComposeArgs) {
  Write-Host "> docker compose --env-file $EnvFile -f $ComposeFile -p $Project $ComposeArgs"
  Invoke-Expression "docker compose --env-file $EnvFile -f $ComposeFile -p $Project $ComposeArgs"
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed: $ComposeArgs" }
}

if (-not (Test-Path $EnvFile)) {
  Copy-Item $EnvExample $EnvFile
  Write-Host 'deploy/.env.rehearsal oluşturuldu'
}

function Do-Build {
  Invoke-Compose 'build app'
  $size = docker image inspect acarindex-web:rehearsal --format '{{.Size}}'
  Write-Host "Image size bytes: $size"
}

function Do-Migrate {
  Invoke-Compose 'up -d postgres'
  Start-Sleep -Seconds 8
  $env:DATABASE_URL = $HostDbUrl
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy failed' }
  npx prisma migrate deploy
  if ($LASTEXITCODE -ne 0) { throw 'prisma migrate deploy idempotency check failed' }
}

function Do-Seed {
  $env:DATABASE_URL = $HostDbUrl
  npx prisma generate
  if ($LASTEXITCODE -ne 0) { throw 'prisma generate failed' }
  $env:ALLOW_DEV_SEED = '1'
  npx tsx scripts/db/seed-dev.ts --write
  if ($LASTEXITCODE -ne 0) { throw 'seed first run failed' }
  npx tsx scripts/db/seed-dev.ts --write
  if ($LASTEXITCODE -ne 0) { throw 'seed idempotency run failed' }
  Remove-Item Env:ALLOW_DEV_SEED -ErrorAction SilentlyContinue
}

function Do-Up {
  Invoke-Compose 'up -d'
  Start-Sleep -Seconds 15
}

function Do-Smoke {
  npx tsx scripts/deploy/rehearsal-smoke.ts http://127.0.0.1:3001
}

function Do-Backup {
  New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
  $stamp = Get-Date -Format 'yyyyMMdd_HHmmss'
  $out = Join-Path $BackupDir "rehearsal_$stamp.dump"
  $containerPath = "/tmp/rehearsal_$stamp.dump"
  Invoke-Compose "exec -T postgres pg_dump -U acarindex_rehearsal -Fc -f $containerPath acarindex_rehearsal"
  docker cp "acarindex_rehearsal_pg:${containerPath}" $out
  if (-not (Test-Path $out) -or (Get-Item $out).Length -eq 0) { throw 'Backup boş' }
  Write-Host "Backup: $out ($((Get-Item $out).Length) bytes)"
  return $out
}

function Do-RestoreTest([string]$DumpPath) {
  if (-not $DumpPath) { $DumpPath = (Get-ChildItem $BackupDir -Filter 'rehearsal_*.dump' | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName }
  if (-not $DumpPath) { throw 'Backup dosyası bulunamadı' }
  $testDb = 'acarindex_restore_test'
  $tables = @('journals','issues','articles','pdf_files','authors','article_authors')
  Invoke-Compose "exec -T postgres psql -U acarindex_rehearsal -d postgres -c `"DROP DATABASE IF EXISTS $testDb;`""
  Invoke-Compose "exec -T postgres psql -U acarindex_rehearsal -d postgres -c `"CREATE DATABASE $testDb;`""
  docker cp $DumpPath acarindex_rehearsal_pg:/tmp/restore_test.dump
  Invoke-Compose 'exec -T postgres pg_restore --clean --if-exists -U acarindex_rehearsal -d acarindex_restore_test /tmp/restore_test.dump'
  foreach ($t in $tables) {
    $src = docker compose --env-file $EnvFile -f $ComposeFile -p $Project exec -T postgres psql -U acarindex_rehearsal -d acarindex_rehearsal -t -A -c "SELECT COUNT(*) FROM $t;"
    $dst = docker compose --env-file $EnvFile -f $ComposeFile -p $Project exec -T postgres psql -U acarindex_rehearsal -d $testDb -t -A -c "SELECT COUNT(*) FROM $t;"
    $src = ($src -join '').Trim()
    $dst = ($dst -join '').Trim()
    if ($src -ne $dst) { throw "Restore count mismatch ${t}: source=$src restore=$dst" }
    Write-Host "Restore OK ${t}: $src rows"
  }
  Invoke-Compose "exec -T postgres psql -U acarindex_rehearsal -d postgres -c `"DROP DATABASE $testDb;`""
  Write-Host 'Restore-test DB doğrulandı ve kaldırıldı.'
}

function Do-RestartTest {
  Invoke-Compose 'restart app'
  Start-Sleep -Seconds 20
  Do-Smoke
  Invoke-Compose 'restart postgres'
  Start-Sleep -Seconds 15
  Invoke-Compose 'restart app'
  Start-Sleep -Seconds 20
  Do-Smoke
}

switch ($Step) {
  'build' { Do-Build }
  'migrate' { Do-Migrate }
  'seed' { Do-Seed }
  'up' { Do-Up }
  'smoke' { Do-Smoke }
  'backup' { Do-Backup }
  'restore-test' { Do-RestoreTest }
  'restart-test' { Do-RestartTest }
  'all' {
    Do-Build
    Do-Migrate
    Do-Seed
    Do-Up
    Do-Smoke
    $dump = Do-Backup
    Do-RestoreTest $dump
    Do-RestartTest
  }
}

Write-Host "Rehearsal step '$Step' tamamlandı."
