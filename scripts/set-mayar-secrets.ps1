# ================================================================
# scripts/set-mayar-secrets.ps1
# Membaca supabase/.env.mayar lalu mendorong nilai yang TERISI
# ke Supabase Edge Function secrets lewat `supabase secrets set`.
# Nilai kosong / beri komentar (#) akan dilewati.
# Jalankan: npm run secrets:mayar
# ================================================================

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$envMayar = Join-Path $root 'supabase\.env.mayar'

if (-not (Test-Path $envMayar)) {
    Write-Host "[X] File tidak ditemukan: supabase/.env.mayar" -ForegroundColor Red
    exit 1
}

Write-Host "[1/3] Membaca supabase/.env.mayar ..." -ForegroundColor Cyan
$filled = @{}
foreach ($line in Get-Content $envMayar) {
    $trim = $line.Trim()
    if ($trim -eq '' -or $trim.StartsWith('#')) { continue }
    if ($trim -notmatch '^([A-Z0-9_]+)=(.*)$') { continue }
    $key = $Matches[1]
    $val = $Matches[2].Trim()
    if ([string]::IsNullOrWhiteSpace($val)) { continue }
    if ($val -match 'ganti_dengan|sbx_ganti') {
        Write-Host "    - Lewati $key (masih placeholder)" -ForegroundColor Yellow
        continue
    }
    $filled[$key] = $val
    Write-Host "    - $key  [terisi]" -ForegroundColor Green
}

if ($filled.Count -eq 0) {
    Write-Host "[X] Tidak ada nilai terisi. Buka supabase/.env.mayar dan isi MAYAR_API_KEY dulu." -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Menekan secrets ke Supabase ..." -ForegroundColor Cyan
foreach ($kv in $filled.GetEnumerator()) {
    supabase secrets set "$($kv.Key)=$($kv.Value)"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Gagal menekan $($kv.Key). Pastikan sudah 'supabase login' dan 'supabase link'." -ForegroundColor Red
        exit $LASTEXITCODE
    }
}

Write-Host "[3/3] Selesai. Nilai yang diterapkan:" -ForegroundColor Cyan
$filled.Keys | ForEach-Object { Write-Host "    $_" -ForegroundColor Green }
Write-Host ""
Write-Host "Lalu deploy/dalam langek fungsi bila belum:" -ForegroundColor Yellow
Write-Host "    npm run deploy:mayar"
