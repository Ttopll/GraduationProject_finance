# Financial Analysis Dashboard API

## Endpoint

`GET /api/financial-analysis/dashboard`

## Query Params

- `familyId`: required, target family id
- `month`: optional, target month in `yyyy-MM`, default current month
- `trendMonths`: optional, number of trend months, default `6`, max `24`

## Purpose

This endpoint is intended for the graduation-project demo "analysis dashboard" page.
It aggregates the current month and recent trend into one response so the frontend
or Postman demo can directly show:

- monthly income, expense, and net cash flow
- savings rate
- account balance, fixed asset value, debt balance, and net asset value
- category expense structure
- budget execution progress
- key indicators such as top expense category, debt-to-asset ratio, liquidity coverage, and Engel coefficient

## Example Request

```http
GET /api/financial-analysis/dashboard?familyId=1&month=2026-03&trendMonths=6
Authorization: Bearer <accessToken>
```

## Response Shape

```json
{
  "month": "2026-03",
  "overview": {
    "totalIncome": 8000.00,
    "totalExpense": 3500.00,
    "netCashFlow": 4500.00,
    "savingsAmount": 4500.00,
    "savingsRate": 0.5625,
    "incomeTransactionCount": 1,
    "expenseTransactionCount": 3
  },
  "assetSnapshot": {
    "totalAccountBalance": 7000.00,
    "totalFixedAssetValue": 300000.00,
    "totalDebtBalance": 100000.00,
    "totalAssetValue": 307000.00,
    "netAssetValue": 207000.00
  },
  "keyIndicators": {
    "engelCoefficient": 0.2857,
    "debtToAssetRatio": 0.3257,
    "liquidityCoverageMonths": 2.0000,
    "topExpenseCategory": "住房",
    "topExpenseAmount": 2000.00,
    "topExpenseRatio": 0.5714,
    "activeBudgetCount": 2,
    "alertBudgetCount": 2,
    "exceededBudgetCount": 1
  },
  "monthlyTrend": [],
  "expenseStructure": [],
  "budgetProgress": []
}
```

## Suggested Demo Script

1. Create or import several March transaction records.
2. Ensure at least one budget and one fixed asset already exist.
3. Call this endpoint after login.
4. Explain the response in the order: cash flow, expense structure, budget warning, asset snapshot, key indicators.

## Implementation Notes

- Expense structure only counts `EXPENSE` transactions.
- Trend data is anchored by the requested month rather than always using the current month.
- Engel coefficient is inferred from food-like category names such as `餐`, `饮`, `食`, `food`, `meal`, `grocery`.
- Asset snapshot reuses the existing fixed-asset overview aggregation logic.
