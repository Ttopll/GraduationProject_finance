# Embedded Demo Web Console

## Purpose

This page provides a one-stop thesis demo entry inside the Spring Boot application.
It reduces the gap between the completed backend APIs and the answer-defense
presentation layer.

## Access Path

- Start the backend application normally.
- Open `http://localhost:8088/demo/`
- `http://localhost:8088/demo/` will redirect to `http://localhost:8088/demo/index.html`

## Included Demo Capabilities

1. Login with `POST /api/auth/login`
2. Load current profile with `GET /api/auth/me`
3. Switch current family and member context
4. Show financial dashboard from `GET /api/financial-analysis/dashboard`
5. Create, edit, and delete transaction records
6. Create, edit, clear, delete debts, and record repayments
7. Import built-in CSV bill samples through `POST /api/bill-imports/upload`
8. Resolve pending bill items and create parse rules through `POST /api/bill-imports/pending-items/{id}/resolve`
9. Create bill parse rules through `POST /api/bill-parse-rules`
10. Create rule definitions and run manual rule evaluation
11. View generated notifications and mark them as read

## Suggested Defense Script

1. Login and select the target family.
2. Explain overview cards: income, expense, net cash flow, savings rate.
3. Explain asset snapshot and key indicators.
4. Show one quick transaction create/update/delete flow.
5. Show one debt create/repay/clear flow.
6. Import sample round 1 and point out that `STARBUCKS` is auto-classified while `UNKNOWN_STORE` enters the pending queue.
7. Resolve the pending item and enable auto rule creation.
8. Import sample round 2 and show that the new parse rule now works automatically.
9. Create one rule and execute manual evaluation for the current month.
10. Open the notification panel and explain the generated alerts.

## Notes

- The page is implemented with plain HTML, CSS, and JavaScript under `src/main/resources/static/demo`.
- Static demo resources are publicly accessible so the login page itself can be opened.
- Built-in import samples are available under `src/main/resources/static/demo/samples`.
- All business APIs except login still require JWT and are called with `Authorization: Bearer <token>`.
