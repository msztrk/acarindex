# Phase 1 tamamlaninca Phase 2 yazar ETL baslatir; ozet dosyasina yazar.
$ErrorActionPreference = 'Stop'
$reportsDir = 'D:\acarindex-web\reports'
$phase1Log = Join-Path $reportsDir 'full-catalog-etl-phase1b.log'
$phase2Log = Join-Path $reportsDir 'full-catalog-etl-phase2.log'
$summaryFile = Join-Path $reportsDir 'son-3-oturum-ozeti.txt'
$orchestratorLog = Join-Path $reportsDir 'phase1-phase2-orchestrator.log'
$phase1Pid = 3892
$expectedArticles = 1023303
$tolerance = 5000

function Write-OrchestratorLog($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ')] $msg"
    Add-Content -Path $orchestratorLog -Value $line -Encoding UTF8
    Write-Host $line
}

Set-Location 'D:\acarindex-web'
$env:DATABASE_URL = 'postgresql://acarindex:d87DHvD3QIDVaq5dW6Zhvlzi8UxXPoG3@127.0.0.1:5432/acarindex_dev?schema=public'
$env:ETL_TRANSACTION_TIMEOUT_MS = '300000'
$env:ETL_BATCH_SIZE = '400'

Write-OrchestratorLog "Orchestrator basladi; Phase 1 pid=$phase1Pid izleniyor."

# Phase 1 process bitene kadar bekle (5 dk aralik)
while ($true) {
    $proc = Get-Process -Id $phase1Pid -ErrorAction SilentlyContinue
    if (-not $proc) {
        Write-OrchestratorLog "Phase 1 process (pid $phase1Pid) sonlandi."
        break
    }
    $tail = if (Test-Path $phase1Log) { Get-Content $phase1Log -Tail 1 -ErrorAction SilentlyContinue } else { $null }
    Write-OrchestratorLog "Phase 1 devam: $tail"
    Start-Sleep -Seconds 300
}

Start-Sleep -Seconds 5

# JSON rapor kontrolu
$logContent = if (Test-Path $phase1Log) { Get-Content $phase1Log -Raw -Encoding UTF8 } else { '' }
$hasJson = $logContent -match '"mode"\s*:\s*"full"' -and $logContent -match '"counters"'
if (-not $hasJson) {
    Write-OrchestratorLog "HATA: Phase 1 log'unda JSON rapor bulunamadi."
    exit 1
}

# Makale sayisi dogrulama
$countResult = npx tsx --env-file=.env.local scripts/etl-pg/count-articles.ts 2>&1 | Out-String
$articleCount = 0
if ($countResult -match '"articleCount"\s*:\s*(\d+)') {
    $articleCount = [int]$Matches[1]
}
Write-OrchestratorLog "PostgreSQL article.count: $articleCount (raw: $($countResult.Trim()))"

if ([Math]::Abs($articleCount - $expectedArticles) -gt $tolerance) {
    Write-OrchestratorLog "UYARI: Makale sayisi beklenenden farkli: $articleCount (hedef ~$expectedArticles, tolerans $tolerance)"
} else {
    Write-OrchestratorLog "Makale sayisi OK: $articleCount (~$expectedArticles)"
}

# Phase 2 — yazar ETL (skip-authors YOK)
Write-OrchestratorLog "Phase 2 yazar ETL baslatiliyor..."
$phase2Start = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'
npx tsx --env-file=.env.local scripts/etl-pg/pilot-run.ts --full --write --batch-size=400 --start-after-id=0 2>&1 |
    Tee-Object -FilePath $phase2Log
$phase2Exit = $LASTEXITCODE
$phase2End = Get-Date -Format 'yyyy-MM-ddTHH:mm:ssZ'
Write-OrchestratorLog "Phase 2 bitti exit_code=$phase2Exit"

$phase2Content = if (Test-Path $phase2Log) { Get-Content $phase2Log -Raw -Encoding UTF8 } else { '' }
$phase1Json = if ($logContent -match '(\{[\s\S]*"mode"[\s\S]*"counters"[\s\S]*\})') { $Matches[1] } else { '(JSON cikarilamadi)' }
$phase2Json = if ($phase2Content -match '(\{[\s\S]*"mode"[\s\S]*"counters"[\s\S]*\})') { $Matches[1] } else { '(JSON cikarilamadi veya henuz yok)' }

$appendBlock = @"

================================================================================
Faz 1+2 Orchestrator Sonucu (otomatik)
Tarih: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (TR)
================================================================================

Faz 1 (skip-authors, start-after-id=397019)
  Log: reports/full-catalog-etl-phase1.log
  PostgreSQL article.count: $articleCount (hedef ~$expectedArticles)
  JSON ozet:
$phase1Json

Faz 2 (yazar ETL, start-after-id=0, skip-authors YOK)
  Baslangic: $phase2Start
  Bitis: $phase2End
  exit_code: $phase2Exit
  Log: reports/full-catalog-etl-phase2.log
  JSON ozet:
$phase2Json

Orchestrator log: reports/phase1-phase2-orchestrator.log
================================================================================
"@

Add-Content -Path $summaryFile -Value $appendBlock -Encoding UTF8
Write-OrchestratorLog "Ozet dosyasina eklendi: $summaryFile"
exit $phase2Exit
