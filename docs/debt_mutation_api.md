# Debt Mutation API

## Endpoints

- `GET /api/debts/{debtId}`
- `PUT /api/debts/{debtId}`
- `POST /api/debts/{debtId}/clear`
- `DELETE /api/debts/{debtId}`

## Purpose

These APIs complete the debt-management lifecycle for the graduation project.
They are suitable for demo scenes where the user needs to:

- correct debt base information
- mark an off-system debt as cleared
- remove a mistaken debt together with its repayment side effects

## Permission Rule

- Family owner can manage all debts in the family.
- The debtor member of the debt can manage their own debt.
- Admin can manage all debts.

## Update Rule

- `principalAmount` can be changed, but it cannot be smaller than the already repaid principal.
- The service automatically recalculates:
  - `repaidPrincipal = oldPrincipalAmount - oldCurrentBalance`
  - `newCurrentBalance = newPrincipalAmount - repaidPrincipal`
- If the new current balance is `0`, status becomes `CLEARED`; otherwise it becomes `ACTIVE`.

## Clear Rule

- `POST /api/debts/{debtId}/clear` directly sets:
  - `currentBalance = 0`
  - `status = CLEARED`
- This is intended for scenarios where the debt has already been settled outside the system.

## Delete Rule

- Before deleting the debt, the service loads all repayment records of that debt.
- For each repayment with `payAccountId`, the repayment amount is added back to the account balance.
- Then repayment records are deleted, and finally the debt is deleted.
- Inactive repayment accounts are still allowed to participate in rollback, so historical data can remain correct.

## Example Update Request

```http
PUT /api/debts/23
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "debtorMemberId": 5,
  "debtName": "Housing Loan",
  "debtType": "LOAN",
  "lenderName": "ABC Bank",
  "principalAmount": 1200.00,
  "annualRate": 3.20,
  "billingDay": 5,
  "repaymentDay": 20,
  "dueDate": "2026-12-20",
  "remark": "updated debt"
}
```

## Example Demo Path

1. Create a debt and one repayment.
2. Update the principal amount and show that current balance changes automatically.
3. Call `POST /api/debts/{debtId}/clear` and show that status becomes `CLEARED`.
4. Recreate another debt with repayment, then delete it and show that the repayment account balance is restored.
