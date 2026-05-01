param(
    [string]$ProjectRoot = "C:\Users\Ttop\codex_tmp_finance_verify_20260309_1",
    [string]$BaseUrl = "http://localhost:8088",
    [switch]$CheckBackend,
    [switch]$CheckRealDataApis,
    [string]$Username = "",
    [string]$Password = "",
    [switch]$AutoCreateUser,
    [string]$ProcessedDir = "data/processed",
    [bool]$TruncateBeforeImport = $false,
    [int]$BatchSize = 5000,
    [string]$CountryIso3 = "CHN",
    [string]$FredSeriesId = "PCE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Add-Check {
    param(
        [System.Collections.Generic.List[object]]$Items,
        [string]$Name,
        [bool]$Passed,
        [string]$Detail
    )

    $Items.Add([PSCustomObject]@{
        name = $Name
        passed = $Passed
        detail = $Detail
    }) | Out-Null
}

function Add-PathCheck {
    param(
        [System.Collections.Generic.List[object]]$Items,
        [string]$Name,
        [string]$Path,
        [string]$OkDetail
    )

    $exists = Test-Path -LiteralPath $Path
    if ($exists) {
        Add-Check -Items $Items -Name $Name -Passed $true -Detail $OkDetail
    } else {
        Add-Check -Items $Items -Name $Name -Passed $false -Detail "Missing: $Path"
    }
}

function Invoke-JsonPost {
    param(
        [string]$Uri,
        [object]$Body,
        [hashtable]$Headers
    )

    $json = $Body | ConvertTo-Json -Depth 8 -Compress
    if ($Headers) {
        return Invoke-RestMethod -Uri $Uri -Method Post -ContentType "application/json; charset=utf-8" -Body $json -Headers $Headers
    }
    return Invoke-RestMethod -Uri $Uri -Method Post -ContentType "application/json; charset=utf-8" -Body $json
}

function Test-BackendReady {
    param([string]$TargetBaseUrl)

    try {
        Invoke-WebRequest `
            -Uri "$($TargetBaseUrl.TrimEnd('/'))/api/auth/login" `
            -Method Post `
            -ContentType "application/json" `
            -Body '{"username":"x","password":"y"}' `
            -UseBasicParsing `
            -TimeoutSec 5 | Out-Null
        return $true
    } catch {
        if ($_.Exception.Response -and ($_.Exception.Response.StatusCode.value__ -in 400, 401, 403, 404)) {
            return $true
        }
        return $false
    }
}

Set-Location $ProjectRoot
$checks = [System.Collections.Generic.List[object]]::new()

Add-PathCheck -Items $checks -Name "project_root" -Path $ProjectRoot -OkDetail "Project root exists"
Add-PathCheck -Items $checks -Name "backend_config" -Path (Join-Path $ProjectRoot "src/main/resources/application.yml") -OkDetail "Spring Boot config exists"
Add-PathCheck -Items $checks -Name "admin_web" -Path (Join-Path $ProjectRoot "admin-web/package.json") -OkDetail "Vue admin app exists"
Add-PathCheck -Items $checks -Name "miniapp" -Path (Join-Path $ProjectRoot "miniapp-mvp/app.json") -OkDetail "WeChat miniapp exists"
Add-PathCheck -Items $checks -Name "database_schema" -Path (Join-Path $ProjectRoot "sql/finance_schema.sql") -OkDetail "Database schema exists"
Add-PathCheck -Items $checks -Name "retail_data" -Path (Join-Path $ProjectRoot "data/processed/online_retail_transactions.csv") -OkDetail "Retail processed data exists"
Add-PathCheck -Items $checks -Name "world_bank_data" -Path (Join-Path $ProjectRoot "data/processed/world_bank_household_consumption.csv") -OkDetail "World Bank processed data exists"
Add-PathCheck -Items $checks -Name "fred_data" -Path (Join-Path $ProjectRoot "data/processed/fred_macro_series.csv") -OkDetail "FRED data file exists"

$adminCheck = Join-Path $ProjectRoot "admin-web/scripts/check-vue-files.cjs"
Add-PathCheck -Items $checks -Name "admin_vue_check_script" -Path $adminCheck -OkDetail "Vue parse checker exists"
if (Test-Path -LiteralPath $adminCheck) {
    Push-Location (Join-Path $ProjectRoot "admin-web")
    try {
        $vueOutput = npm run check:vue 2>&1 | Out-String
        Add-Check -Items $checks -Name "admin_vue_parse" -Passed ($LASTEXITCODE -eq 0) -Detail ($vueOutput.Trim())
    } finally {
        Pop-Location
    }
}

$appJsonPath = Join-Path $ProjectRoot "miniapp-mvp/app.json"
if (Test-Path -LiteralPath $appJsonPath) {
    $appJson = Get-Content -LiteralPath $appJsonPath -Raw | ConvertFrom-Json
    $missingPages = @()
    foreach ($page in $appJson.pages) {
        foreach ($ext in @("js", "wxml", "json", "wxss")) {
            $target = Join-Path $ProjectRoot ("miniapp-mvp/{0}.{1}" -f $page, $ext)
            if (-not (Test-Path -LiteralPath $target)) {
                $missingPages += ("{0}.{1}" -f $page, $ext)
            }
        }
    }

    if ($missingPages.Count -eq 0) {
        Add-Check -Items $checks -Name "miniapp_page_files" -Passed $true -Detail "All app.json page files exist"
    } else {
        Add-Check -Items $checks -Name "miniapp_page_files" -Passed $false -Detail ("Missing: " + ($missingPages -join ", "))
    }
}

if ($CheckBackend) {
    $ready = Test-BackendReady -TargetBaseUrl $BaseUrl
    if ($ready) {
        Add-Check -Items $checks -Name "backend_ready" -Passed $true -Detail "Backend is reachable"
    } else {
        Add-Check -Items $checks -Name "backend_ready" -Passed $false -Detail "Backend is not reachable. Start Spring Boot first."
    }
}

if ($CheckRealDataApis) {
    if (-not (Test-BackendReady -TargetBaseUrl $BaseUrl)) {
        Add-Check -Items $checks -Name "real_data_apis" -Passed $false -Detail "Backend is not running"
    } else {
        try {
            $base = $BaseUrl.TrimEnd("/")
            if ($AutoCreateUser) {
                $stamp = Get-Date -Format "yyyyMMddHHmmss"
                $Username = "landing_user_$stamp"
                $Password = "Landing#20260501"
                Invoke-JsonPost -Uri "$base/api/users" -Body @{
                    username = $Username
                    password = $Password
                    nickname = "Landing User"
                    realName = "Landing User"
                    userType = "USER"
                } -Headers $null | Out-Null
            }

            if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
                throw "Username/Password is required when CheckRealDataApis is enabled, unless AutoCreateUser is used."
            }

            $login = Invoke-JsonPost -Uri "$base/api/auth/login" -Body @{ username = $Username; password = $Password } -Headers $null
            $headers = @{ Authorization = "Bearer $($login.accessToken)" }

            $importUrl = "{0}/api/real-data-analysis/import?processedDir={1}&truncateBeforeImport={2}&batchSize={3}" -f $base, $ProcessedDir, $TruncateBeforeImport, $BatchSize
            $import = Invoke-RestMethod -Uri $importUrl -Method Post -Headers $headers
            $retail = Invoke-RestMethod -Uri "$base/api/real-data-analysis/retail-overview?topCountries=10" -Method Get -Headers $headers
            $worldBank = Invoke-RestMethod -Uri "$base/api/real-data-analysis/world-bank-trend?countryIso3=$CountryIso3" -Method Get -Headers $headers
            $fred = Invoke-RestMethod -Uri "$base/api/real-data-analysis/fred-series?seriesId=$FredSeriesId" -Method Get -Headers $headers

            $detail = "import retail=$($import.retailImported), worldBank=$($import.worldBankImported), fred=$($import.fredImported); retailRecords=$($retail.totalRecords); worldBankPoints=$(@($worldBank.points).Count); fredPoints=$(@($fred.points).Count)"
            Add-Check -Items $checks -Name "real_data_apis" -Passed ($retail.totalRecords -gt 0 -and @($worldBank.points).Count -gt 0) -Detail $detail
        } catch {
            Add-Check -Items $checks -Name "real_data_apis" -Passed $false -Detail $_.Exception.Message
        }
    }
}

$passedCount = @($checks | Where-Object { $_.passed }).Count
$failedCount = $checks.Count - $passedCount
$result = [PSCustomObject]@{
    executedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    projectRoot = $ProjectRoot
    baseUrl = $BaseUrl
    passedCount = $passedCount
    failedCount = $failedCount
    checks = $checks
}

$result | ConvertTo-Json -Depth 8

if ($failedCount -gt 0) {
    exit 1
}
