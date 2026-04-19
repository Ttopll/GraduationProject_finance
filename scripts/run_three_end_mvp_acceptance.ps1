param(
    [string]$ProjectRoot = "C:\Users\Ttop\codex_tmp_finance_verify_20260309_1",
    [string]$BaseUrl = "http://localhost:8088",
    [string]$Username = "",
    [string]$Password = "",
    [switch]$AutoCreateUser,
    [string]$CountryIso3 = "CHN",
    [string]$FredSeriesId = "PCE"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot
$env:JAVA_TOOL_OPTIONS = "-Dfile.encoding=UTF-8 -Duser.home=C:/Users/Ttop"

$job = Start-Job -ScriptBlock {
    param($wd)
    Set-Location $wd
    mvn "-Duser.home=C:/Users/Ttop" "-Dmaven.repo.local=C:/Users/Ttop/.m2/repository" -DskipTests spring-boot:run
} -ArgumentList $ProjectRoot

try {
    $ready = $false
    for ($i = 0; $i -lt 120; $i++) {
        Start-Sleep -Seconds 2
        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType "application/json" -Body '{"username":"x","password":"y"}' -UseBasicParsing | Out-Null
        } catch {
            if ($_.Exception.Response -and ($_.Exception.Response.StatusCode.value__ -in 400,401,403,404)) {
                $ready = $true
                break
            }
        }
    }

    if (-not $ready) {
        throw "后端服务在超时时间内未就绪：$BaseUrl"
    }

    $reportScript = Join-Path $ProjectRoot "scripts/generate_three_end_mvp_report.ps1"
    if (-not (Test-Path -LiteralPath $reportScript)) {
        throw "未找到报告脚本：$reportScript"
    }

    $args = @{
        BaseUrl = $BaseUrl
        CountryIso3 = $CountryIso3
        FredSeriesId = $FredSeriesId
    }

    if ($AutoCreateUser) {
        $args.AutoCreateUser = $true
    } else {
        if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
            throw "未启用 AutoCreateUser 时，Username/Password 不能为空"
        }
        $args.Username = $Username
        $args.Password = $Password
    }

    & $reportScript @args
}
finally {
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -ErrorAction SilentlyContinue
}
