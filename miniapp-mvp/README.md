# miniapp-mvp

A minimal WeChat Mini Program scaffold for this project.

## Scope

- Page 1: Login (`/api/auth/login`)
- Page 2: Retail overview (`/api/real-data-analysis/retail-overview`)
- Page 3: World Bank trend (`/api/real-data-analysis/world-bank-trend`)
- Page 4: FRED series (`/api/real-data-analysis/fred-series`)
- Page 5: Defense summary (`/api/real-data-analysis/defense-summary`)

## Local backend

The app default backend is:

- `http://127.0.0.1:8088`

If your backend runs elsewhere, update `app.js`.

## Quick start

1. Start backend (`mvn spring-boot:run`).
2. Open WeChat DevTools.
3. Import `miniapp-mvp` as a Mini Program project.
4. In DevTools local settings, disable domain validation for local debugging.
5. Login with an existing user.
6. Verify retail overview, world-bank trend, fred-series, and defense-summary load.
