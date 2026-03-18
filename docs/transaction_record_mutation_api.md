# Transaction Record Mutation API

## Endpoints

- `GET /api/transaction-records/{recordId}`
- `PUT /api/transaction-records/{recordId}`
- `DELETE /api/transaction-records/{recordId}`

## Purpose

These APIs complete the transaction-record lifecycle so the system can not only
create and view bills, but also correct or remove wrong records during demo and
real use.

## Permission Rule

- Family owner can modify or delete any transaction record in the family.
- The creator of a transaction record can modify or delete their own record.
- Admin can operate on all records.
- If a historical record has no `createdByMemberId`, any readable family member can manage it.

## Update Request Example

```http
PUT /api/transaction-records/100
Authorization: Bearer <accessToken>
Content-Type: application/json
```

```json
{
  "accountId": 10,
  "targetAccountId": 11,
  "categoryId": 3,
  "createdByMemberId": 5,
  "transactionType": "TRANSFER",
  "amount": 80.00,
  "transactionTime": "2026-03-18T11:00:00",
  "merchantName": "Wallet Transfer",
  "counterpartyName": "Savings",
  "sourcePlatform": "MANUAL",
  "externalTradeNo": null,
  "note": "move cash"
}
```

## Delete Request Example

```http
DELETE /api/transaction-records/100
Authorization: Bearer <accessToken>
```

Response:

```http
204 No Content
```

## Data Consistency Rule

- When updating a record, the service first rolls back the old balance impact,
  then applies the new impact, and finally saves the changed accounts.
- When deleting a record, the service rolls back the original balance impact
  before removing the record.
- Existing records on inactive accounts can still be edited or deleted, so old
  data is still correct even after an account is disabled.
- `targetAccountId` is only allowed for `TRANSFER` transactions.

## Recommended Demo Path

1. Create one expense transaction from account A.
2. Update it to a transfer from account A to account B.
3. Show that both account balances changed correctly.
4. Delete the transfer and show that balances are restored.
