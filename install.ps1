$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        YTLocal Installer (Win)       ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "  Created by Fahimi Amir | Powered by yt-dlp" -ForegroundColor Gray
Write-Host ""

$Repo = "MigorengGH/YTLocal"
$AppName = "YTLocal"
$TempPath = Join-Path $env:TEMP "YTLocal_Setup.exe"

Write-Host "📡 Fetching latest release..." -ForegroundColor Yellow
try {
    $Release = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $ExeAsset = $Release.assets | Where-Object { $_.name -like "*.exe" } | Select-Object -First 1

    if (-not $ExeAsset) {
        Write-Host "❌ Could not find a Windows .exe release. Visit: https://github.com/$Repo/releases" -ForegroundColor Red
        exit
    }
} catch {
    Write-Host "❌ Failed to connect to GitHub API. Please download manually from: https://github.com/$Repo/releases" -ForegroundColor Red
    exit
}

$DownloadUrl = $ExeAsset.browser_download_url
Write-Host "📥 Downloading $($ExeAsset.name)..." -ForegroundColor Yellow

# Use WebClient for progress bar
$WebClient = New-Object System.Net.WebClient
$WebClient.DownloadFile($DownloadUrl, $TempPath)

Write-Host "🚀 Running Installer..." -ForegroundColor Yellow
# Start the NSIS installer. It runs automatically because we built it with oneClick=true
Start-Process -FilePath $TempPath -Wait

Write-Host "🔄 Updating yt-dlp core..." -ForegroundColor Yellow
$InstalledYtDlp = Join-Path $env:LOCALAPPDATA "Programs\YTLocal\resources\bin\yt-dlp.exe"
if (Test-Path $InstalledYtDlp) {
    Start-Process -FilePath $InstalledYtDlp -ArgumentList "-U" -Wait -NoNewWindow
}

Write-Host "💿 Cleaning up..." -ForegroundColor Yellow
Remove-Item -Path $TempPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅ YTLocal installed successfully!  ║" -ForegroundColor Green
Write-Host "║  Look for it on your Desktop/Start!  ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
