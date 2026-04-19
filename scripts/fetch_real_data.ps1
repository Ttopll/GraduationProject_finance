param(
    [string]$ProjectRoot = "C:\Users\Ttop\codex_tmp_finance_verify_20260309_1",
    [string]$Countries = "CHN,USA,JPN,KOR,DEU,FRA,GBR",
    [switch]$SkipOnlineRetail,
    [switch]$SkipMacro
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = `
    [Net.SecurityProtocolType]::Tls12 -bor `
    [Net.SecurityProtocolType]::Tls11 -bor `
    [Net.SecurityProtocolType]::Tls

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Download-File {
    param(
        [string]$Url,
        [string]$OutFile
    )
    $maxRetry = 3
    for ($i = 1; $i -le $maxRetry; $i++) {
        try {
            Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing -TimeoutSec 120
            return
        } catch {
            if ($i -eq $maxRetry) {
                throw "Download failed after $maxRetry attempts: $Url`n$($_.Exception.Message)`nHint: check network/proxy/TLS settings on your machine."
            }
            Start-Sleep -Seconds (2 * $i)
        }
    }
}

function Download-FromCandidates {
    param(
        [string[]]$Urls,
        [string]$OutFile,
        [string]$Label,
        [switch]$SoftFail
    )
    $errors = @()
    foreach ($url in $Urls) {
        try {
            Download-File -Url $url -OutFile $OutFile
            Write-Host "[$Label] downloaded from: $url"
            return $url
        } catch {
            $errors += "$url => $($_.Exception.Message)"
        }
    }
    $joinedErrors = $errors -join "`n"
    $message = ("All candidate URLs failed for {0}:`n{1}" -f $Label, $joinedErrors)
    if ($SoftFail) {
        Write-Warning $message
        return $null
    }
    throw $message
}

function Export-CsvUtf8NoBom {
    param(
        [Parameter(Mandatory = $true)] $InputObject,
        [Parameter(Mandatory = $true)][string]$Path
    )
    $InputObject | ConvertTo-Csv -NoTypeInformation | Set-Content -Path $Path -Encoding UTF8
}

function Normalize-LineEndingsForCsv {
    param(
        [Parameter(Mandatory = $true)][string]$SourcePath,
        [Parameter(Mandatory = $true)][string]$TargetPath
    )
    $raw = Get-Content -Path $SourcePath -Raw -Encoding UTF8
    if ($raw -notmatch "`n" -and $raw -match "`r") {
        $normalized = $raw -replace "`r", "`n"
    } else {
        $normalized = $raw -replace "`r`n", "`n"
    }
    Set-Content -Path $TargetPath -Value $normalized -Encoding UTF8
}

$dataRoot = Join-Path $ProjectRoot "data"
$rawRoot = Join-Path $dataRoot "raw"
$processedRoot = Join-Path $dataRoot "processed"
Ensure-Dir -Path $dataRoot
Ensure-Dir -Path $rawRoot
Ensure-Dir -Path $processedRoot

$fetchedAt = Get-Date -Format "yyyy-MM-ddTHH:mm:ssK"

if (-not $SkipOnlineRetail) {
    Write-Host "[1/3] Fetching Online Retail transactions..."
    $onlineRetailRawFile = Join-Path $rawRoot "online_retail.csv"
    $onlineRetailCandidates = @(
        "https://github.com/guipsamora/pandas_exercises/raw/master/07_Visualization/Online_Retail/Online_Retail.csv",
        "https://raw.githubusercontent.com/guipsamora/pandas_exercises/master/07_Visualization/Online_Retail/Online_Retail.csv"
    )
    $onlineRetailSource = Download-FromCandidates -Urls $onlineRetailCandidates -OutFile $onlineRetailRawFile -Label "online_retail"

    $onlineRetailNormalizedFile = Join-Path $rawRoot "online_retail.normalized.csv"
    Normalize-LineEndingsForCsv -SourcePath $onlineRetailRawFile -TargetPath $onlineRetailNormalizedFile
    $onlineRaw = Import-Csv -Path $onlineRetailNormalizedFile -Delimiter ',' -Encoding UTF8
    $onlineClean = foreach ($row in $onlineRaw) {
        $quantity = 0.0
        $unitPrice = 0.0
        [double]::TryParse([string]$row.Quantity, [ref]$quantity) | Out-Null
        [double]::TryParse([string]$row.UnitPrice, [ref]$unitPrice) | Out-Null
        if ($quantity -le 0 -or $unitPrice -le 0) {
            continue
        }
        [PSCustomObject]@{
            source_dataset = "online_retail"
            invoice_no = $row.InvoiceNo
            stock_code = $row.StockCode
            description = $row.Description
            quantity = [int]$quantity
            unit_price = [decimal]$unitPrice
            amount = [decimal]($quantity * $unitPrice)
            invoice_time = $row.InvoiceDate
            customer_id = $row.CustomerID
            country = $row.Country
            fetched_at = $fetchedAt
        }
    }
    $onlineProcessedFile = Join-Path $processedRoot "online_retail_transactions.csv"
    Export-CsvUtf8NoBom -InputObject $onlineClean -Path $onlineProcessedFile
}

if (-not $SkipMacro) {
    Write-Host "[2/3] Fetching macro indicators from World Bank..."
    $countryParam = ($Countries -split "," | ForEach-Object { $_.Trim().ToUpper() } | Where-Object { $_ }) -join ";"
    $worldBankUrl = "https://api.worldbank.org/v2/country/$countryParam/indicator/NE.CON.PRVT.PC.KD?format=json&per_page=20000"
    $worldBankRawFile = Join-Path $rawRoot "world_bank_household_consumption.json"
    Download-FromCandidates -Urls @($worldBankUrl) -OutFile $worldBankRawFile -Label "world_bank" | Out-Null

    $worldBankJson = Get-Content -Path $worldBankRawFile -Raw -Encoding UTF8 | ConvertFrom-Json
    $worldBankRows = @()
    if ($worldBankJson.Count -ge 2) {
        foreach ($item in $worldBankJson[1]) {
            if ($null -eq $item.value) {
                continue
            }
            $worldBankRows += [PSCustomObject]@{
                source_dataset = "world_bank_ne_con_prvt_pc_kd"
                country_iso3 = $item.countryiso3code
                country_name = $item.country.value
                year = [int]$item.date
                indicator = $item.indicator.id
                value = [decimal]$item.value
                fetched_at = $fetchedAt
            }
        }
    }
    $worldBankProcessedFile = Join-Path $processedRoot "world_bank_household_consumption.csv"
    Export-CsvUtf8NoBom -InputObject $worldBankRows -Path $worldBankProcessedFile

    Write-Host "[3/3] Fetching macro indicators from FRED..."
    $fredSeries = @(
        @{ id = "PCE"; name = "personal_consumption_expenditures" },
        @{ id = "CPIAUCSL"; name = "consumer_price_index" }
    )
    $fredAllRows = @()
    foreach ($series in $fredSeries) {
        $url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=$($series.id)"
        $rawFile = Join-Path $rawRoot ("fred_" + $series.id + ".csv")
        $downloaded = Download-FromCandidates -Urls @($url) -OutFile $rawFile -Label ("fred_" + $series.id) -SoftFail
        if (-not $downloaded) {
            Write-Warning "Skip FRED series [$($series.id)] due to download failure."
            continue
        }

        $rows = Import-Csv -Path $rawFile
        foreach ($r in $rows) {
            if ([string]::IsNullOrWhiteSpace($r.DATE) -or [string]::IsNullOrWhiteSpace($r.($series.id)) -or $r.($series.id) -eq ".") {
                continue
            }
            $value = 0.0
            [double]::TryParse([string]$r.($series.id), [ref]$value) | Out-Null
            if ($value -eq 0.0) {
                continue
            }
            $fredAllRows += [PSCustomObject]@{
                source_dataset = "fred"
                series_id = $series.id
                series_name = $series.name
                date = $r.DATE
                value = [decimal]$value
                fetched_at = $fetchedAt
            }
        }
    }
    $fredProcessedFile = Join-Path $processedRoot "fred_macro_series.csv"
    if ($fredAllRows.Count -gt 0) {
        Export-CsvUtf8NoBom -InputObject $fredAllRows -Path $fredProcessedFile
    } else {
        Set-Content -Path $fredProcessedFile -Encoding UTF8 -Value "source_dataset,series_id,series_name,date,value,fetched_at"
    }
}

Write-Host "Done. Raw data folder: $rawRoot"
Write-Host "Done. Processed data folder: $processedRoot"
