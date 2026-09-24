param(
  [string]$Serial,
  [string]$ApkPath,
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\performance-results'),
  [int]$MemoryMinutes = 5
)

$ErrorActionPreference = 'Stop'
$packageName = 'com.anonymous.ecobudmobile'

$adbCommand = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCommand) {
  $adbPath = $adbCommand.Source
} else {
  $sdkRoots = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT) | Where-Object { $_ }
  $adbPath = $sdkRoots | ForEach-Object { Join-Path $_ 'platform-tools\adb.exe' } | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
}
if (-not $adbPath) { throw 'adb was not found. Install Android platform-tools or set ANDROID_HOME.' }

$deviceLines = @(& $adbPath devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S+\s+device\s*$' })
if (-not $Serial) {
  if ($deviceLines.Count -ne 1) { throw 'Connect exactly one Android phone, or pass -Serial from adb devices.' }
  $Serial = ($deviceLines[0] -split '\s+')[0]
}
$adbArgs = @('-s', $Serial)
function Invoke-Adb([string[]]$Arguments) {
  $output = & $adbPath @adbArgs @Arguments 2>&1
  if ($LASTEXITCODE -ne 0) { throw "adb $($Arguments -join ' ') failed: $output" }
  return $output
}

if ($ApkPath) {
  $resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path
  Invoke-Adb @('install', '-r', $resolvedApk) | Out-Null
}
if (-not (Invoke-Adb @('shell', 'pm', 'path', $packageName) | Select-String '^package:')) {
  throw "Install the release APK for $packageName before profiling."
}
$runAsResult = & $adbPath @adbArgs shell run-as $packageName id 2>&1 | Out-String
if ($runAsResult -match 'uid=') {
  throw 'The installed app is debuggable. Install an Android release build for valid measurements.'
}

$runDirectory = Join-Path $OutputDirectory (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $runDirectory -Force | Out-Null
$deviceInfo = @{
  serial = $Serial
  model = (Invoke-Adb @('shell', 'getprop', 'ro.product.model') | Out-String).Trim()
  android = (Invoke-Adb @('shell', 'getprop', 'ro.build.version.release') | Out-String).Trim()
  package = $packageName
  startedAt = (Get-Date).ToString('o')
}
$deviceInfo | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runDirectory 'device.json')
$results = [System.Collections.Generic.List[object]]::new()

function Capture-Stage([string]$Name) {
  $gfx = Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName)
  $memory = Invoke-Adb @('shell', 'dumpsys', 'meminfo', $packageName)
  $gfx | Set-Content -LiteralPath (Join-Path $runDirectory "$Name-gfxinfo.txt")
  $memory | Set-Content -LiteralPath (Join-Path $runDirectory "$Name-meminfo.txt")
  $gfxText = $gfx | Out-String
  $memoryText = $memory | Out-String
  $frames = [regex]::Match($gfxText, 'Total frames rendered:\s*([\d,]+)')
  $janky = [regex]::Match($gfxText, 'Janky frames:\s*([\d,]+)')
  $pss = [regex]::Match($memoryText, '(?m)^\s*TOTAL\s+([\d,]+)')
  $frameCount = if ($frames.Success) { [int]($frames.Groups[1].Value -replace ',', '') } else { $null }
  $jankyCount = if ($janky.Success) { [int]($janky.Groups[1].Value -replace ',', '') } else { $null }
  $pssKb = if ($pss.Success) { [int]($pss.Groups[1].Value -replace ',', '') } else { $null }
  $results.Add([pscustomobject]@{
    stage = $Name
    timestamp = (Get-Date).ToString('o')
    totalFrames = $frameCount
    jankyFrames = $jankyCount
    jankyPercent = if ($frameCount -gt 0 -and $null -ne $jankyCount) { [math]::Round(100 * $jankyCount / $frameCount, 1) } else { $null }
    totalPssMb = if ($null -ne $pssKb) { [math]::Round($pssKb / 1024, 1) } else { $null }
  })
  Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName, 'reset') | Out-Null
}

Invoke-Adb @('shell', 'am', 'force-stop', $packageName) | Out-Null
Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName, 'reset') | Out-Null
$launch = Invoke-Adb @('shell', 'am', 'start', '-W', '-n', "$packageName/.MainActivity")
$launch | Set-Content -LiteralPath (Join-Path $runDirectory 'startup.txt')
Start-Sleep -Seconds 10
Capture-Stage 'startup'

Write-Host 'Open Challenges > Discover. Press Enter, then scroll quickly for 30 seconds and press Enter again.'
Read-Host | Out-Null
Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName, 'reset') | Out-Null
Read-Host 'Press Enter after the fast scroll' | Out-Null
Capture-Stage 'scroll'

Write-Host 'Press Enter, then switch Home, Learn, Challenges, Tracker, Profile three times. Press Enter when done.'
Read-Host | Out-Null
Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName, 'reset') | Out-Null
Read-Host 'Press Enter after tab switching' | Out-Null
Capture-Stage 'tabs'

Write-Host 'Open a long chat. Press Enter, then scroll through its history and send a test message. Press Enter when done.'
Read-Host | Out-Null
Invoke-Adb @('shell', 'dumpsys', 'gfxinfo', $packageName, 'reset') | Out-Null
Read-Host 'Press Enter after chat use' | Out-Null
Capture-Stage 'chat'

Write-Host "Keep using the app for $MemoryMinutes minutes. Memory is sampled every 30 seconds."
for ($sample = 1; $sample -le ($MemoryMinutes * 2); $sample++) {
  Start-Sleep -Seconds 30
  Capture-Stage "memory-$sample"
}

$results | Export-Csv -LiteralPath (Join-Path $runDirectory 'summary.csv') -NoTypeInformation
Write-Host "Results: $runDirectory"
$results | Format-Table -AutoSize
