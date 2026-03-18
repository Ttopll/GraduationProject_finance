param(
    [string]$BaseUrl = "http://localhost:8088",
    [string]$OwnerUsername = "demo_owner",
    [string]$OwnerPassword = "Demo123456",
    [string]$MemberUsername = "demo_member",
    [string]$MemberPassword = "Demo123456"
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host "[demo-seed] $Message" -ForegroundColor Cyan
}

function Convert-BodyToJson {
    param([object]$Body)
    if ($null -eq $Body) {
        return $null
    }
    return ($Body | ConvertTo-Json -Depth 10 -Compress)
}

function Read-ErrorBody {
    param($ErrorRecord)

    $response = $ErrorRecord.Exception.Response
    if ($null -eq $response) {
        return $null
    }

    try {
        $stream = $response.GetResponseStream()
        if ($null -eq $stream) {
            return $null
        }
        $reader = New-Object System.IO.StreamReader($stream)
        $raw = $reader.ReadToEnd()
        $reader.Close()
        if ([string]::IsNullOrWhiteSpace($raw)) {
            return $null
        }
        try {
            return ($raw | ConvertFrom-Json)
        } catch {
            return $raw
        }
    } catch {
        return $null
    }
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [object]$Body,
        [string]$Token,
        [int[]]$AllowStatusCodes = @()
    )

    $uri = "{0}{1}" -f $BaseUrl.TrimEnd("/"), $Path
    $headers = @{}
    if ($Token) {
        $headers["Authorization"] = "Bearer $Token"
    }

    $params = @{
        Uri         = $uri
        Method      = $Method
        Headers     = $headers
        ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
        $params["ContentType"] = "application/json; charset=utf-8"
        $params["Body"] = Convert-BodyToJson -Body $Body
    }

    try {
        $result = Invoke-RestMethod @params
        return [pscustomobject]@{
            StatusCode = 200
            Body       = $result
        }
    } catch {
        $response = $_.Exception.Response
        if ($null -eq $response) {
            throw
        }

        $statusCode = [int]$response.StatusCode
        $errorBody = Read-ErrorBody -ErrorRecord $_
        if ($AllowStatusCodes -contains $statusCode) {
            return [pscustomobject]@{
                StatusCode = $statusCode
                Body       = $errorBody
            }
        }

        $message = $null
        if ($errorBody -is [string]) {
            $message = $errorBody
        } elseif ($null -ne $errorBody -and $errorBody.PSObject.Properties.Name -contains "message") {
            $message = $errorBody.message
        } elseif ($null -ne $errorBody -and $errorBody.PSObject.Properties.Name -contains "error") {
            $message = $errorBody.error
        } else {
            $message = $response.StatusDescription
        }

        throw ("HTTP {0} for {1} {2}: {3}" -f $statusCode, $Method, $Path, $message)
    }
}

function Invoke-WebProbe {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [int]$TimeoutSec = 5
    )

    $params = @{
        Uri         = $Uri
        TimeoutSec  = $TimeoutSec
        ErrorAction = "Stop"
    }

    if ((Get-Command Invoke-WebRequest).Parameters.ContainsKey("UseBasicParsing")) {
        $params["UseBasicParsing"] = $true
    }

    return Invoke-WebRequest @params
}

function Test-Backend {
    Write-Step "Checking backend availability at $BaseUrl"
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        try {
            Invoke-WebProbe -Uri ("{0}/demo/index.html" -f $BaseUrl.TrimEnd("/")) -TimeoutSec 5 | Out-Null
            return
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    throw "Backend is not reachable at $BaseUrl . Start the Spring Boot service first."
}

function Ensure-DemoUser {
    param(
        [string]$Username,
        [string]$Password,
        [string]$Nickname,
        [string]$RealName
    )

    Write-Step "Ensuring demo user $Username"
    $createResponse = Invoke-Api `
        -Method "POST" `
        -Path "/api/users" `
        -Body @{
            username = $Username
            password = $Password
            nickname = $Nickname
            realName = $RealName
            userType = "USER"
        } `
        -AllowStatusCodes @(409)

    if ($createResponse.StatusCode -eq 409) {
        Write-Host "[demo-seed] Reusing existing user $Username" -ForegroundColor DarkYellow
    }

    $loginResponse = Invoke-Api `
        -Method "POST" `
        -Path "/api/auth/login" `
        -Body @{
            username = $Username
            password = $Password
        }

    return [pscustomobject]@{
        Username    = $Username
        Password    = $Password
        Token       = $loginResponse.Body.accessToken
        User        = $loginResponse.Body.user
        Memberships = $loginResponse.Body.memberships
    }
}

function New-MonthDate {
    param(
        [int]$Offset,
        [int]$Day,
        [int]$Hour,
        [int]$Minute = 0
    )

    $base = (Get-Date).AddMonths($Offset)
    $safeDay = [Math]::Min($Day, [DateTime]::DaysInMonth($base.Year, $base.Month))
    return (Get-Date -Year $base.Year -Month $base.Month -Day $safeDay -Hour $Hour -Minute $Minute -Second 0)
}

function Format-DateText {
    param([datetime]$Value)
    return $Value.ToString("yyyy-MM-dd")
}

function Format-DateTimeText {
    param([datetime]$Value)
    return $Value.ToString("yyyy-MM-ddTHH:mm:ss")
}

function New-Category {
    param(
        [string]$Token,
        [long]$FamilyId,
        [string]$Name,
        [string]$Type,
        [int]$SortOrder
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/categories" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            categoryName = $Name
            categoryType = $Type
            scopeType = "FAMILY"
            sortOrder = $SortOrder
        }).Body
}

function New-Account {
    param(
        [string]$Token,
        [long]$FamilyId,
        [Nullable[long]]$OwnerMemberId,
        [string]$Name,
        [string]$Type,
        [decimal]$CurrentBalance,
        [string]$InstitutionName,
        [int]$BillingDay,
        [int]$RepaymentDay
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/accounts" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            ownerMemberId = $OwnerMemberId
            accountName = $Name
            accountType = $Type
            institutionName = $InstitutionName
            currentBalance = $CurrentBalance
            creditLimit = 0
            billingDay = $(if ($BillingDay -gt 0) { $BillingDay } else { $null })
            repaymentDay = $(if ($RepaymentDay -gt 0) { $RepaymentDay } else { $null })
            isShared = 1
            remark = "Generated by init_defense_demo_data.ps1"
        }).Body
}

function New-Budget {
    param(
        [string]$Token,
        [long]$FamilyId,
        [long]$CategoryId,
        [Nullable[long]]$CreatedByMemberId,
        [string]$Name,
        [decimal]$Amount,
        [decimal]$AlertRatio,
        [datetime]$StartDate
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/budgets" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            categoryId = $CategoryId
            createdByMemberId = $CreatedByMemberId
            budgetName = $Name
            periodType = "MONTH"
            amount = $Amount
            alertRatio = $AlertRatio
            startDate = (Format-DateText $StartDate)
            remark = "Generated by init_defense_demo_data.ps1"
        }).Body
}

function New-Transaction {
    param(
        [string]$Token,
        [long]$FamilyId,
        [long]$AccountId,
        [Nullable[long]]$TargetAccountId,
        [Nullable[long]]$CategoryId,
        [Nullable[long]]$CreatedByMemberId,
        [string]$TransactionType,
        [decimal]$Amount,
        [datetime]$TransactionTime,
        [string]$MerchantName,
        [string]$Note
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/transaction-records" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            accountId = $AccountId
            targetAccountId = $TargetAccountId
            categoryId = $CategoryId
            createdByMemberId = $CreatedByMemberId
            transactionType = $TransactionType
            amount = $Amount
            transactionTime = (Format-DateTimeText $TransactionTime)
            merchantName = $MerchantName
            sourcePlatform = "MANUAL"
            note = $Note
        }).Body
}

function New-Debt {
    param(
        [string]$Token,
        [long]$FamilyId,
        [Nullable[long]]$DebtorMemberId,
        [string]$Name,
        [string]$Type,
        [string]$LenderName,
        [decimal]$PrincipalAmount,
        [decimal]$AnnualRate,
        [int]$BillingDay,
        [int]$RepaymentDay,
        [datetime]$DueDate
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/debts" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            debtorMemberId = $DebtorMemberId
            debtName = $Name
            debtType = $Type
            lenderName = $LenderName
            principalAmount = $PrincipalAmount
            annualRate = $AnnualRate
            billingDay = $BillingDay
            repaymentDay = $RepaymentDay
            dueDate = (Format-DateText $DueDate)
            remark = "Generated by init_defense_demo_data.ps1"
        }).Body
}

function New-Repayment {
    param(
        [string]$Token,
        [long]$DebtId,
        [long]$FamilyId,
        [Nullable[long]]$PayAccountId,
        [Nullable[long]]$CreatedByMemberId,
        [decimal]$Amount,
        [decimal]$PrincipalPaid,
        [decimal]$InterestPaid,
        [datetime]$RepaymentTime
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/debts/$DebtId/repayments" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            payAccountId = $PayAccountId
            createdByMemberId = $CreatedByMemberId
            amount = $Amount
            principalPaid = $PrincipalPaid
            interestPaid = $InterestPaid
            repaymentTime = (Format-DateTimeText $RepaymentTime)
            note = "Generated by init_defense_demo_data.ps1"
        }).Body
}

function New-FixedAsset {
    param(
        [string]$Token,
        [long]$FamilyId,
        [Nullable[long]]$OwnerMemberId,
        [string]$Name,
        [string]$Type,
        [decimal]$PurchaseAmount,
        [datetime]$PurchaseDate,
        [decimal]$ValuationAmount,
        [datetime]$ValuationDate
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/fixed-assets" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            ownerMemberId = $OwnerMemberId
            assetName = $Name
            assetType = $Type
            purchaseAmount = $PurchaseAmount
            purchaseDate = (Format-DateText $PurchaseDate)
            valuationAmount = $ValuationAmount
            valuationDate = (Format-DateText $ValuationDate)
            remark = "Generated by init_defense_demo_data.ps1"
        }).Body
}

function New-Rule {
    param(
        [string]$Token,
        [long]$FamilyId,
        [Nullable[long]]$CategoryId,
        [Nullable[long]]$CreatedByMemberId,
        [string]$RuleName,
        [string]$RuleType,
        [string]$MetricType,
        [string]$TimeScope,
        [string]$OperatorType,
        [decimal]$ThresholdValue,
        [string]$ThresholdJson,
        [string]$MessageTemplate,
        [int]$Priority
    )

    return (Invoke-Api `
        -Method "POST" `
        -Path "/api/rules" `
        -Token $Token `
        -Body @{
            familyId = $FamilyId
            categoryId = $CategoryId
            createdByMemberId = $CreatedByMemberId
            ruleName = $RuleName
            ruleType = $RuleType
            metricType = $MetricType
            timeScope = $TimeScope
            operatorType = $OperatorType
            thresholdValue = $ThresholdValue
            thresholdJson = $ThresholdJson
            actionType = "NOTIFY"
            messageTemplate = $MessageTemplate
            priority = $Priority
        }).Body
}

Test-Backend

$ownerSession = Ensure-DemoUser `
    -Username $OwnerUsername `
    -Password $OwnerPassword `
    -Nickname "Defense Owner" `
    -RealName "Defense Owner"

$memberSession = Ensure-DemoUser `
    -Username $MemberUsername `
    -Password $MemberPassword `
    -Nickname "Defense Member" `
    -RealName "Defense Member"

$familyStamp = Get-Date -Format "yyyyMMdd-HHmmss"
$familyName = "Defense Demo $familyStamp"

Write-Step "Creating a fresh demo family $familyName"
$family = (Invoke-Api `
    -Method "POST" `
    -Path "/api/families" `
    -Token $ownerSession.Token `
    -Body @{
        familyName = $familyName
        ownerUserId = $ownerSession.User.id
        currencyCode = "CNY"
        timezone = "Asia/Shanghai"
        remark = "Generated by init_defense_demo_data.ps1"
    }).Body

Write-Step "Joining the second demo user to the new family"
[void](Invoke-Api `
    -Method "POST" `
    -Path "/api/families/join" `
    -Token $memberSession.Token `
    -Body @{
        inviteCode = $family.inviteCode
        memberName = "Defense Member"
    })

$members = (Invoke-Api `
    -Method "GET" `
    -Path "/api/families/$($family.id)/members" `
    -Token $ownerSession.Token).Body

$ownerMember = $members | Where-Object { $_.userId -eq $ownerSession.User.id } | Select-Object -First 1
$memberMember = $members | Where-Object { $_.userId -eq $memberSession.User.id } | Select-Object -First 1

if ($null -eq $ownerMember -or $null -eq $memberMember) {
    throw "Could not resolve family members for the demo family."
}

Write-Step "Creating categories"
$categoryMap = @{
    salary    = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Salary" -Type "INCOME" -SortOrder 10
    bonus     = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Bonus" -Type "INCOME" -SortOrder 20
    food      = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Food" -Type "EXPENSE" -SortOrder 100
    housing   = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Housing" -Type "EXPENSE" -SortOrder 110
    transport = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Transport" -Type "EXPENSE" -SortOrder 120
    education = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Education" -Type "EXPENSE" -SortOrder 130
    medical   = New-Category -Token $ownerSession.Token -FamilyId $family.id -Name "Medical" -Type "EXPENSE" -SortOrder 140
}

Write-Step "Creating accounts"
$accountMap = @{
    bank   = New-Account -Token $ownerSession.Token -FamilyId $family.id -OwnerMemberId $ownerMember.memberId -Name "Bank Card" -Type "BANK" -CurrentBalance 30000 -InstitutionName "ICBC" -BillingDay 0 -RepaymentDay 0
    cash   = New-Account -Token $ownerSession.Token -FamilyId $family.id -OwnerMemberId $memberMember.memberId -Name "Cash Wallet" -Type "CASH" -CurrentBalance 5000 -InstitutionName "Home" -BillingDay 0 -RepaymentDay 0
    travel = New-Account -Token $ownerSession.Token -FamilyId $family.id -OwnerMemberId $memberMember.memberId -Name "Travel Card" -Type "BANK" -CurrentBalance 2000 -InstitutionName "Bank of China" -BillingDay 0 -RepaymentDay 0
}

$monthStart = Get-Date -Year (Get-Date).Year -Month (Get-Date).Month -Day 1 -Hour 0 -Minute 0 -Second 0

Write-Step "Creating budgets"
[void](New-Budget -Token $ownerSession.Token -FamilyId $family.id -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -Name "Food Budget" -Amount 3000 -AlertRatio 0.80 -StartDate $monthStart)
[void](New-Budget -Token $ownerSession.Token -FamilyId $family.id -CategoryId $categoryMap.transport.id -CreatedByMemberId $ownerMember.memberId -Name "Transport Budget" -Amount 1000 -AlertRatio 0.80 -StartDate $monthStart)
[void](New-Budget -Token $ownerSession.Token -FamilyId $family.id -CategoryId $categoryMap.education.id -CreatedByMemberId $ownerMember.memberId -Name "Education Budget" -Amount 1500 -AlertRatio 0.80 -StartDate $monthStart)

Write-Step "Creating multi-month transactions"
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.salary.id -CreatedByMemberId $ownerMember.memberId -TransactionType "INCOME" -Amount 12000 -TransactionTime (New-MonthDate -Offset -2 -Day 5 -Hour 9) -MerchantName "Payroll" -Note "January salary")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 2600 -TransactionTime (New-MonthDate -Offset -2 -Day 8 -Hour 18) -MerchantName "Fresh Market" -Note "January food")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.housing.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 3200 -TransactionTime (New-MonthDate -Offset -2 -Day 10 -Hour 10) -MerchantName "Landlord" -Note "January rent")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.cash.id -TargetAccountId $null -CategoryId $categoryMap.transport.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 800 -TransactionTime (New-MonthDate -Offset -2 -Day 12 -Hour 8) -MerchantName "Metro Pass" -Note "January commute")

[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.salary.id -CreatedByMemberId $ownerMember.memberId -TransactionType "INCOME" -Amount 12000 -TransactionTime (New-MonthDate -Offset -1 -Day 5 -Hour 9) -MerchantName "Payroll" -Note "February salary")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 2800 -TransactionTime (New-MonthDate -Offset -1 -Day 8 -Hour 18) -MerchantName "Fresh Market" -Note "February food")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.housing.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 3200 -TransactionTime (New-MonthDate -Offset -1 -Day 10 -Hour 10) -MerchantName "Landlord" -Note "February rent")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.cash.id -TargetAccountId $null -CategoryId $categoryMap.transport.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 850 -TransactionTime (New-MonthDate -Offset -1 -Day 12 -Hour 8) -MerchantName "Metro Pass" -Note "February commute")

[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.salary.id -CreatedByMemberId $ownerMember.memberId -TransactionType "INCOME" -Amount 12000 -TransactionTime (New-MonthDate -Offset 0 -Day 5 -Hour 9) -MerchantName "Payroll" -Note "Current month salary")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.cash.id -TargetAccountId $null -CategoryId $categoryMap.bonus.id -CreatedByMemberId $ownerMember.memberId -TransactionType "INCOME" -Amount 2000 -TransactionTime (New-MonthDate -Offset 0 -Day 6 -Hour 20) -MerchantName "Side Gig" -Note "Current month bonus")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 3600 -TransactionTime (New-MonthDate -Offset 0 -Day 8 -Hour 18) -MerchantName "Fresh Market" -Note "Current month food")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.housing.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 3400 -TransactionTime (New-MonthDate -Offset 0 -Day 10 -Hour 10) -MerchantName "Landlord" -Note "Current month rent")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.cash.id -TargetAccountId $null -CategoryId $categoryMap.transport.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 1100 -TransactionTime (New-MonthDate -Offset 0 -Day 12 -Hour 8) -MerchantName "Metro Pass" -Note "Current month commute")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.education.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 1800 -TransactionTime (New-MonthDate -Offset 0 -Day 15 -Hour 19) -MerchantName "Training Center" -Note "Current month course")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $null -CategoryId $categoryMap.medical.id -CreatedByMemberId $ownerMember.memberId -TransactionType "EXPENSE" -Amount 900 -TransactionTime (New-MonthDate -Offset 0 -Day 18 -Hour 15) -MerchantName "Clinic" -Note "Current month medical")
[void](New-Transaction -Token $ownerSession.Token -FamilyId $family.id -AccountId $accountMap.bank.id -TargetAccountId $accountMap.travel.id -CategoryId $null -CreatedByMemberId $ownerMember.memberId -TransactionType "TRANSFER" -Amount 500 -TransactionTime (New-MonthDate -Offset 0 -Day 20 -Hour 11) -MerchantName "Account Transfer" -Note "Transfer to travel card")

Write-Step "Creating fixed assets"
[void](New-FixedAsset -Token $ownerSession.Token -FamilyId $family.id -OwnerMemberId $ownerMember.memberId -Name "Apartment" -Type "HOUSE" -PurchaseAmount 420000 -PurchaseDate (Get-Date).AddYears(-4) -ValuationAmount 480000 -ValuationDate (Get-Date))
[void](New-FixedAsset -Token $ownerSession.Token -FamilyId $family.id -OwnerMemberId $memberMember.memberId -Name "Sedan" -Type "CAR" -PurchaseAmount 85000 -PurchaseDate (Get-Date).AddYears(-2) -ValuationAmount 70000 -ValuationDate (Get-Date))

Write-Step "Creating debt and one repayment"
$debt = New-Debt -Token $ownerSession.Token -FamilyId $family.id -DebtorMemberId $ownerMember.memberId -Name "Mortgage Loan" -Type "MORTGAGE" -LenderName "Construction Bank" -PrincipalAmount 180000 -AnnualRate 3.45 -BillingDay 5 -RepaymentDay 20 -DueDate (Get-Date).AddDays(5)
[void](New-Repayment -Token $ownerSession.Token -DebtId $debt.id -FamilyId $family.id -PayAccountId $accountMap.bank.id -CreatedByMemberId $ownerMember.memberId -Amount 3500 -PrincipalPaid 2500 -InterestPaid 1000 -RepaymentTime (New-MonthDate -Offset 0 -Day 7 -Hour 20))

Write-Step "Creating rules"
[void](New-Rule -Token $ownerSession.Token -FamilyId $family.id -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -RuleName "Food Threshold" -RuleType "THRESHOLD" -MetricType "CATEGORY_EXPENSE" -TimeScope "MONTH" -OperatorType "GT" -ThresholdValue 3000 -ThresholdJson $null -MessageTemplate "Food spending exceeded the configured threshold" -Priority 10)
[void](New-Rule -Token $ownerSession.Token -FamilyId $family.id -CategoryId $null -CreatedByMemberId $ownerMember.memberId -RuleName "Family Expense Streak" -RuleType "CONSECUTIVE_THRESHOLD" -MetricType "FAMILY_EXPENSE" -TimeScope "MONTH" -OperatorType "GT" -ThresholdValue 6000 -ThresholdJson '{"consecutiveMonths":3}' -MessageTemplate "Family expense remained high for consecutive months" -Priority 20)
[void](New-Rule -Token $ownerSession.Token -FamilyId $family.id -CategoryId $categoryMap.food.id -CreatedByMemberId $ownerMember.memberId -RuleName "Food Trend Anomaly" -RuleType "TREND_ANOMALY" -MetricType "CATEGORY_EXPENSE" -TimeScope "MONTH" -OperatorType "GTE" -ThresholdValue 0.20 -ThresholdJson '{"baselineMonths":2}' -MessageTemplate "Food spending grew sharply compared with recent months" -Priority 30)

$currentMonthText = (Get-Date).ToString("yyyy-MM")

Write-Step "Running manual rule evaluation and debt reminder check"
$ruleEvaluation = (Invoke-Api `
    -Method "POST" `
    -Path "/api/rules/evaluate?familyId=$($family.id)&month=$currentMonthText" `
    -Token $ownerSession.Token).Body

$debtReminder = (Invoke-Api `
    -Method "POST" `
    -Path "/api/debts/check-reminders?familyId=$($family.id)&daysAhead=7" `
    -Token $ownerSession.Token).Body

$dashboard = (Invoke-Api `
    -Method "GET" `
    -Path "/api/financial-analysis/dashboard?familyId=$($family.id)&month=$currentMonthText&trendMonths=6" `
    -Token $ownerSession.Token).Body

$notifications = (Invoke-Api `
    -Method "GET" `
    -Path "/api/notifications?familyId=$($family.id)" `
    -Token $ownerSession.Token).Body

Write-Host ""
Write-Host "Demo data bootstrap completed." -ForegroundColor Green
Write-Host "Base URL        : $BaseUrl"
Write-Host "Demo page       : $($BaseUrl.TrimEnd('/'))/demo/"
Write-Host "Owner login     : $OwnerUsername / $OwnerPassword"
Write-Host "Member login    : $MemberUsername / $MemberPassword"
Write-Host "Family ID       : $($family.id)"
Write-Host "Family name     : $($family.familyName)"
Write-Host "Invite code     : $($family.inviteCode)"
Write-Host "Current month   : $currentMonthText"
Write-Host "Overview income : $($dashboard.overview.totalIncome)"
Write-Host "Overview expense: $($dashboard.overview.totalExpense)"
Write-Host "Net asset value : $($dashboard.assetSnapshot.netAssetValue)"
Write-Host "Rule triggers   : $($ruleEvaluation.triggeredRuleCount)"
Write-Host "Budget alerts   : $($ruleEvaluation.budgetAlertCount)"
Write-Host "Debt reminders  : $($debtReminder.reminderCount)"
Write-Host "Notifications   : $(@($notifications).Count)"
Write-Host ""
Write-Host "Open the demo page and select the family named '$familyName'." -ForegroundColor Yellow
