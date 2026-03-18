# Embedded Demo Web Console

## Purpose

This page provides a one-stop thesis demo entry inside the Spring Boot application.
It reduces the gap between the completed backend APIs and the answer-defense
presentation layer.

## Access Path

- Start the backend application normally.
- Open `http://localhost:8080/demo/`
- `http://localhost:8080/` will redirect to `/demo/`

## Included Demo Capabilities

1. Login with `POST /api/auth/login`
2. Load current profile with `GET /api/auth/me`
3. Switch current family and member context
4. Show financial dashboard from `GET /api/financial-analysis/dashboard`
5. Create, edit, and delete transaction records
6. Create, edit, clear, delete debts, and record repayments
7. Create rule definitions and run manual rule evaluation
8. View generated notifications and mark them as read

## Suggested Defense Script

1. Login and select the target family.
2. Explain overview cards: income, expense, net cash flow, savings rate.
3. Explain asset snapshot and key indicators.
4. Show one quick transaction create/update/delete flow.
5. Show one debt create/repay/clear flow.
6. Create one rule and execute manual evaluation for the current month.
7. Open the notification panel and explain the generated alerts.

## Notes

- The page is implemented with plain HTML, CSS, and JavaScript under `src/main/resources/static/demo`.
- Static demo resources are publicly accessible so the login page itself can be opened.
- All business APIs except login still require JWT and are called with `Authorization: Bearer <token>`.
