param(
    [string]$BaseUrl = "http://localhost:8088",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$AutoCreateUser,
    [string]$ProcessedDir = "data/processed",
    [bool]$TruncateBeforeImport = $true,
    [int]$BatchSize = 5000,
    [string]$CountryIso3 = "CHN",
    [string]$FredSeriesId = "PCE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Require-Value {
    param([string]$Name, [string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "参数 $Name 不能为空"
    }
}

function Post-Json {
    param(
        [string]$Url,
        [hashtable]$Body,
        [hashtable]$Headers
    )
    $json = $Body | ConvertTo-Json
    if ($null -ne $Headers) {
        return Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body $json -Headers $Headers
    }
    return Invoke-RestMethod -Uri $Url -Method Post -ContentType "application/json" -Body $json
}

$base = $BaseUrl.TrimEnd('/')

if ($AutoCreateUser) {
    $timestamp = Get-Date -Format "yyyyMMddHHmmss"
    $Username = "mvp_user_$timestamp"
    $Password = "Mvp#20260419"

    $createBody = @{
        username = $Username
        password = $Password
        nickname = "MVP用户"
        realName = "MVP Runner"
        userType = "USER"
    }

    Post-Json -Url "$base/api/users" -Body $createBody -Headers $null | Out-Null
}

Require-Value -Name "Username" -Value $Username
Require-Value -Name "Password" -Value $Password

$login = Post-Json -Url "$base/api/auth/login" -Body @{ username = $Username; password = $Password } -Headers $null
if ([string]::IsNullOrWhiteSpace($login.accessToken)) {
    throw "登录成功但未返回 accessToken"
}

$headers = @{ Authorization = "Bearer $($login.accessToken)" }

$importUrl = "$base/api/real-data-analysis/import?processedDir=$ProcessedDir&truncateBeforeImport=$TruncateBeforeImport&batchSize=$BatchSize"
$import = Invoke-RestMethod -Uri $importUrl -Method Post -Headers $headers
$retail = Invoke-RestMethod -Uri "$base/api/real-data-analysis/retail-overview?topCountries=10" -Method Get -Headers $headers
$worldBank = Invoke-RestMethod -Uri "$base/api/real-data-analysis/world-bank-trend?countryIso3=$CountryIso3" -Method Get -Headers $headers
$fred = Invoke-RestMethod -Uri "$base/api/real-data-analysis/fred-series?seriesId=$FredSeriesId" -Method Get -Headers $headers
$summary = Invoke-RestMethod -Uri "$base/api/real-data-analysis/defense-summary?countryIso3=$CountryIso3&seriesId=$FredSeriesId&topCountries=10" -Method Get -Headers $headers

$top1 = $null
if ($retail.topCountries -and $retail.topCountries.Count -gt 0) {
    $top1 = $retail.topCountries[0]
}

$points = @($worldBank.points)
$first = $null
$last = $null
if ($points.Count -gt 0) {
    $first = $points[0]
    $last = $points[$points.Count - 1]
}

$totalAmount = [decimal]($retail.totalAmount)
$topAmount = if ($top1) { [decimal]($top1.totalAmount) } else { [decimal]0 }
$topShare = if ($totalAmount -gt 0) { [math]::Round(($topAmount / $totalAmount) * 100, 2) } else { 0 }

$growthPct = $null
if ($first -and $last -and [decimal]$first.value -gt 0) {
    $growthPct = [math]::Round((([decimal]$last.value / [decimal]$first.value) - 1) * 100, 2)
}

$fredCount = @($fred.points).Count

$conclusions = @($summary.conclusions)
if ($conclusions.Count -eq 0) {
    $conclusions = @(
        "国家趋势结论：$($worldBank.countryName)（$($worldBank.countryIso3)）从 $($first.year) 年 $($first.value) 增至 $($last.year) 年 $($last.value)，累计变化 $growthPct%。",
        "交易结构结论：$($top1.country) 交易额占比约 $topShare%。",
        "FRED状态结论：$FredSeriesId 数据点数为 $fredCount。"
    )
}

$result = [PSCustomObject]@{
    executedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    baseUrl = $base
    username = $Username
    import = $import
    retailOverview = [PSCustomObject]@{
        totalRecords = $retail.totalRecords
        totalAmount = $retail.totalAmount
        averageAmount = $retail.averageAmount
        topCountry = $top1
    }
    worldBankTrend = [PSCustomObject]@{
        countryIso3 = $worldBank.countryIso3
        countryName = $worldBank.countryName
        pointCount = $points.Count
        firstPoint = $first
        lastPoint = $last
    }
    fredSeries = [PSCustomObject]@{
        seriesId = $FredSeriesId
        pointCount = $fredCount
    }
    defenseSummary = $summary
    conclusions = $conclusions
}

$result | ConvertTo-Json -Depth 8
