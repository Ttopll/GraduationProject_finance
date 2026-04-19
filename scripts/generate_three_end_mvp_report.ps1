param(
    [string]$BaseUrl = "http://localhost:8088",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$AutoCreateUser,
    [string]$ProcessedDir = "data/processed",
    [bool]$TruncateBeforeImport = $true,
    [int]$BatchSize = 5000,
    [string]$CountryIso3 = "CHN",
    [string]$FredSeriesId = "PCE",
    [string]$ReportDir = "docs/reports"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$verifyScript = Join-Path $scriptRoot "verify_three_end_mvp.ps1"
if (-not (Test-Path -LiteralPath $verifyScript)) {
    throw "未找到联通自检脚本: $verifyScript"
}

$verifyParams = @{
    BaseUrl = $BaseUrl
    Username = $Username
    Password = $Password
    ProcessedDir = $ProcessedDir
    TruncateBeforeImport = $TruncateBeforeImport
    BatchSize = $BatchSize
    CountryIso3 = $CountryIso3
    FredSeriesId = $FredSeriesId
}
if ($AutoCreateUser) {
    $verifyParams.AutoCreateUser = $true
}

$jsonText = & $verifyScript @verifyParams
$result = $jsonText | ConvertFrom-Json

$root = Get-Location
$reportDirPath = Join-Path $root $ReportDir
if (-not (Test-Path -LiteralPath $reportDirPath)) {
    New-Item -ItemType Directory -Path $reportDirPath | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$reportFileName = "三端联通验收报告_$timestamp.md"
$reportPath = Join-Path $reportDirPath $reportFileName

$lines = @()
$lines += "# 三端联通验收报告"
$lines += ""
$lines += "- 生成时间：$($result.executedAt)"
$lines += "- 接口基地址：$($result.baseUrl)"
$lines += "- 验证用户：$($result.username)"
$lines += ""
$lines += "## 导入结果"
$lines += ""
$lines += "- retailImported：$($result.import.retailImported)"
$lines += "- worldBankImported：$($result.import.worldBankImported)"
$lines += "- fredImported：$($result.import.fredImported)"
$lines += ""
$lines += "## 分析接口结果"
$lines += ""
$lines += "- retail-overview：totalRecords=$($result.retailOverview.totalRecords)，totalAmount=$($result.retailOverview.totalAmount)"
$lines += "- world-bank-trend：country=$($result.worldBankTrend.countryIso3)，pointCount=$($result.worldBankTrend.pointCount)"
$lines += "- fred-series：seriesId=$($result.fredSeries.seriesId)，pointCount=$($result.fredSeries.pointCount)"
$lines += ""
$lines += "## 自动结论"
$lines += ""
foreach ($c in $result.conclusions) {
    $lines += "- $c"
}
$lines += ""
$lines += "## 原始JSON"
$lines += ""
$lines += '```json'
$lines += ($jsonText | Out-String).TrimEnd()
$lines += '```'

$lines | Set-Content -Path $reportPath -Encoding utf8

[PSCustomObject]@{
    reportPath = $reportPath
    reportFile = $reportFileName
} | ConvertTo-Json
