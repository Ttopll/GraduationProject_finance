# Demo Data Bootstrap

## Purpose

This bootstrap flow creates a fresh answer-defense demo family through the existing HTTP APIs.
It does not require a local `mysql` CLI.

## What It Creates

- 2 demo users
- 1 new family with a timestamped name
- 1 extra family member
- Income and expense categories
- Shared accounts
- Monthly budgets
- Three months of transactions
- Fixed assets
- One debt and one repayment
- One bill parse rule for `STARBUCKS`
- Three rule definitions
- Rule-evaluation notifications
- Debt-reminder notifications

## Default Accounts

- Owner: `demo_owner / Demo123456`
- Member: `demo_member / Demo123456`

## Usage

1. Start the Spring Boot backend first.
2. Run the script from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init_defense_demo_data.ps1
```

3. Open the demo page:

```text
http://localhost:8088/demo/
```

If your browser caches redirects oddly, `http://localhost:8088/demo/index.html` also works.

4. Log in with `demo_owner / Demo123456`.
5. Select the latest family printed by the script.
6. If you want to demo bill import, use the embedded sample buttons on `/demo/`:
   - import sample round 1
   - resolve the pending `UNKNOWN_STORE` item with rule creation enabled
   - import sample round 2 to show the learned parse rule taking effect

## Optional Parameters

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\init_defense_demo_data.ps1 `
  -BaseUrl http://localhost:8088 `
  -OwnerUsername custom_owner `
  -OwnerPassword CustomPass123 `
  -MemberUsername custom_member `
  -MemberPassword CustomPass123
```

## Notes

- The script creates a new family every time it runs.
- Existing demo users are reused if they already exist and the provided passwords still match.
- After bootstrap, the current month dashboard, budgets, rules, debts, notifications, and bill-import demo flow should all have visible demo data.
