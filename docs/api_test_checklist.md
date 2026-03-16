# 详细接口测试文档

更新时间：2026-03-11

适用项目目录：`C:\Users\Ttop\codex_tmp_finance_verify_20260309_1`

配套文档：

- `docs/project_status_and_acceptance.md`
- `docs/api_acceptance_checklist.md`
- `docs/samples/bill_import_sample_round1.csv`
- `docs/samples/bill_import_sample_round2.csv`

## 1. 这份文档解决什么问题

这份文档是重新整理后的“可执行接口测试手册”，目标是解决你之前遇到的几个问题：

- 只给了接口名，但没讲接口为什么这样测
- 只给了部分请求体，导致你测到一半不知道怎么填
- 没讲清楚 `userId / familyId / familyMemberId` 之间的关系
- 没讲清楚后端真正的运行逻辑，所以遇到 `400` 时容易完全摸不着头脑

这次文档按“代码真实行为”写，不按理想设计写。也就是说：

- 写的都是你当前仓库里的真实接口
- 默认值、权限限制、参数约束都按 service 层代码说明
- 主线接口和旧版遗留接口会明确拆开

## 2. 使用方式

推荐你按这个顺序使用：

1. 先看第 3 节和第 4 节，搞清楚测试前提和权限模型。
2. 再按第 6 节给出的主线顺序逐步执行。
3. 测试时同步维护第 5 节里的变量。
4. 如果某一步报 `400/403/409`，先看对应接口下方的“常见失败原因”。

## 3. 测试前必须知道的事实

### 3.1 当前项目只有 2 个公开接口

只有下面两个接口不需要 JWT：

- `POST /api/users`
- `POST /api/auth/login`

其余接口都必须带：

```text
Authorization: Bearer {accessToken}
```

### 3.2 这个项目的错误返回不够友好

当前项目没有把大多数 `ResponseStatusException` 的中文 message 显式返回给前端，所以你在 Apifox 里经常只能看到：

```json
{
  "timestamp": "...",
  "status": 400,
  "error": "Bad Request",
  "path": "..."
}
```

这不代表后端没原因，而是“原因没有回到响应体里”。  
所以排错时要结合：

- 这份文档里的接口约束
- IDEA 控制台日志
- 相关 service 的业务逻辑

### 3.3 你重复测试时要改唯一字段

下面这些字段重复时会报错：

- `username`
- `phone`
- `email`
- 账单导入里的“整个文件内容”会触发文件哈希去重
- 账单导入里的 `sourcePlatform + externalTradeNo` 会触发单条流水去重

建议你测试时这样处理：

- 用户名加日期后缀，比如 `accept_user_20260311_01`
- 邮箱也加后缀
- 如果要重复导入测试，只有在专门验证 `409 Conflict` 时才重复上传完全同一文件

### 3.4 本文中的时间示例

本文统一使用 `2026-03` 这一组时间，是因为当前日期就是 2026-03-11。  
如果你在后面几天继续测，最好统一替换下面这些值：

- `month=2026-03`
- `transactionTime`
- `dueDate`
- `startDate/endDate`

## 4. 先搞清楚 4 个最重要的 ID

### 4.1 `userId`

用户 ID。  
来自注册接口 `POST /api/users`。

### 4.2 `familyId`

家庭 ID。  
来自 `POST /api/families`。

### 4.3 `familyMemberId`

家庭成员 ID。  
它不是 `userId`。  
你创建家庭后，系统会自动往 `family_member` 表里插入一条成员记录，这条记录的主键才是 `familyMemberId`。

这个值要通过 `GET /api/auth/me` 里的 `memberships` 拿到。

### 4.4 `accountId / categoryId / budgetId / debtId / ruleId`

这些都是后续业务对象的主键，分别来自各自的创建接口。

## 5. 建议维护的测试变量

建议在 Apifox 环境变量里维护这些值：

| 变量名 | 说明 | 从哪个接口拿 |
|---|---|---|
| `token` | JWT | `POST /api/auth/login` |
| `userId` | 用户 ID | `POST /api/users` |
| `familyId` | 家庭 ID | `POST /api/families` |
| `familyMemberId` | 当前用户在这个家庭里的成员 ID | `GET /api/auth/me` |
| `accountId` | 主测试账户 ID | `POST /api/accounts` |
| `accountId2` | 第二账户 ID，转账测试可选 | `POST /api/accounts` |
| `categoryId` | 分类 ID | `POST /api/categories` |
| `budgetId` | 预算 ID | `POST /api/budgets` |
| `debtId` | 债务 ID | `POST /api/debts` |
| `ruleId` | 规则 ID | `POST /api/rules` |
| `notificationId` | 通知 ID | `GET /api/notifications` |
| `batchId` | 导入批次 ID | `POST /api/bill-imports/upload` |
| `pendingItemId` | 待归类记录 ID | `GET /api/bill-imports/pending-items` |

## 6. 权限模型和自动补值规则

### 6.1 公开接口

- `POST /api/users`
- `POST /api/auth/login`

### 6.2 需要登录即可

大多数接口都至少要求登录。

### 6.3 需要“家庭读权限”

下面这些接口要求当前登录用户属于对应家庭：

- `/api/families/{familyId}`
- `/api/accounts`
- `/api/categories` 的查询
- `/api/budgets`
- `/api/transaction-records`
- `/api/debts`
- `/api/notifications`
- `/api/rules` 的查询
- `/api/bill-imports/upload`

### 6.4 需要“家庭 OWNER 权限”

下面这些接口要求当前用户是家庭主账号：

- `POST /api/categories`
- `POST /api/debts/check-reminders`
- `POST /api/rules`
- `POST /api/rules/evaluate`
- `POST /api/bill-parse-rules`
- `GET /api/bill-parse-rules`
- `GET /api/bill-imports/pending-items`
- `POST /api/bill-imports/pending-items/{pendingItemId}/resolve`

### 6.5 哪些成员字段可以不传

为了减少出错，第一次验收建议尽量省略这些字段：

- `ownerMemberId`
- `createdByMemberId`
- `debtorMemberId`
- `uploadedByMemberId`
- `resolvedByMemberId`

原因是：

- 这几个字段很多接口都会自动补成“当前登录用户在这个家庭里的成员 ID”
- 你手工传错了，反而更容易 `403` 或 `400`

## 7. 推荐的完整测试顺序

主线顺序如下：

1. `POST /api/users`
2. `POST /api/auth/login`
3. `GET /api/auth/me`
4. `POST /api/families`
5. `GET /api/families`
6. `GET /api/families/{familyId}`
7. `GET /api/auth/me`，拿 `familyMemberId`
8. `POST /api/accounts`
9. `POST /api/accounts`，第二账户，可选
10. `POST /api/categories`
11. `POST /api/budgets`
12. `POST /api/transaction-records`
13. `GET /api/budgets/usage`
14. `GET /api/transaction-records/family/{familyId}/monthly-summary`
15. `POST /api/debts`
16. `POST /api/debts/{debtId}/repayments`
17. `POST /api/debts/check-reminders`
18. `POST /api/rules`
19. `POST /api/rules/evaluate`
20. `GET /api/notifications`
21. `POST /api/notifications/{notificationId}/read`
22. `POST /api/bill-parse-rules`
23. `POST /api/bill-imports/upload`
24. `GET /api/bill-imports/pending-items`
25. `POST /api/bill-imports/pending-items/{pendingItemId}/resolve`
26. `POST /api/bill-imports/upload` 第二轮导入
27. `POST /api/bill-imports/upload` 再重复导入同文件，验证 `409`

## 8. 接口详细测试说明

### 8.1 用户注册 `POST /api/users`

**用途**

创建一个普通用户账号。

**是否鉴权**

不需要。

**请求头**

```text
Content-Type: application/json
```

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `username` | 是 | 最长 50，不能重复 |
| `password` | 是 | 长度 6 到 100 |
| `nickname` | 是 | 最长 50 |
| `realName` | 否 | 最长 50 |
| `phone` | 否 | 最长 20，若填写不能重复 |
| `email` | 否 | 合法邮箱，最长 100，若填写不能重复 |
| `userType` | 否 | 如果传，只能是 `USER` |

**推荐请求体**

第一次测试建议直接省略 `userType`，最稳：

```json
{
  "username": "accept_user_20260311_01",
  "password": "Pass123456",
  "nickname": "accept01",
  "realName": "Acceptance User",
  "phone": "13800000001",
  "email": "accept01@example.com"
}
```

如果你一定要传 `userType`，只能这样写：

```json
{
  "username": "accept_user_20260311_01",
  "password": "Pass123456",
  "nickname": "accept01",
  "realName": "Acceptance User",
  "phone": "13800000001",
  "email": "accept01@example.com",
  "userType": "USER"
}
```

**后端运行逻辑**

`UserController.create -> UserService.create -> SysUserRepository.existsBy... -> PasswordHashUtil.sha256 -> save(SysUser)`

具体行为：

- 先查 `username` 是否存在
- 再查 `phone` 是否存在
- 再查 `email` 是否存在
- 把密码做 SHA-256
- 最终只允许注册 `USER` 类型

**成功判定**

- 返回 `201 Created`
- 响应体中有 `id`
- 记下这个 `id` 到变量 `userId`

**最常见失败原因**

- `userType` 传成 `NORMAL`
- 用户名已存在
- 手机号已存在
- 邮箱已存在

---

### 8.2 登录 `POST /api/auth/login`

**用途**

拿 JWT，后面所有主线接口都要用。

**是否鉴权**

不需要。

**请求体**

```json
{
  "username": "accept_user_20260311_01",
  "password": "Pass123456"
}
```

**后端运行逻辑**

`AuthController.login -> AuthService.login -> findByUsername -> PasswordHashUtil.matches -> JwtService.generateToken`

具体行为：

- 根据用户名查用户
- 校验用户状态必须为 `1`
- 校验密码哈希
- 更新 `lastLoginAt`
- 返回 JWT 和当前家庭 membership 列表

**成功判定**

- 返回 `200 OK`
- 响应中有 `accessToken`
- `tokenType = Bearer`
- 把 `accessToken` 存为 `token`

**最常见失败原因**

- 用户名错
- 密码错
- 用户被禁用

---

### 8.3 当前用户信息 `GET /api/auth/me`

**用途**

确认当前 token 有效，并在创建家庭后拿到 `familyMemberId`。

**是否鉴权**

需要。

**请求头**

```text
Authorization: Bearer {{token}}
```

**请求体**

无。

**后端运行逻辑**

`AuthController.me -> AuthService.me -> CurrentUserService.requireCurrentUserEntity -> FamilyMemberRepository + FamilyRepository`

**第一次调用时你应该看到什么**

刚注册和登录完，但还没创建家庭时：

- `user` 有值
- `memberships` 很可能为空数组

**创建家庭后再次调用时你应该看到什么**

`memberships` 中应该出现类似结构：

```json
{
  "familyId": 1,
  "familyName": "Graduation Demo Family",
  "familyMemberId": 1,
  "roleCode": "OWNER",
  "status": 1
}
```

**成功判定**

- 返回 `200 OK`
- `user.id = {{userId}}`
- 创建家庭后再次调用时，拿到 `familyMemberId`

**最常见失败原因**

- 没带 token
- token 失效

---

### 8.4 创建家庭 `POST /api/families`

**用途**

创建家庭，并自动生成一条 `OWNER` 家庭成员记录。

**是否鉴权**

需要。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyName` | 是 | 最长 100 |
| `ownerUserId` | 是 | 普通用户必须写自己的 `userId` |
| `currencyCode` | 否 | 默认 `CNY` |
| `timezone` | 否 | 默认 `Asia/Shanghai` |
| `remark` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyName": "Graduation Demo Family",
  "ownerUserId": {{userId}},
  "currencyCode": "CNY",
  "timezone": "Asia/Shanghai",
  "remark": "for acceptance test"
}
```

**后端运行逻辑**

`FamilyController.create -> FamilyAccessService.requireCurrentUserMatches -> FamilyService.create -> save(Family) -> save(FamilyMember OWNER)`

具体行为：

- 先校验当前登录用户和 `ownerUserId` 一致
- 保存家庭
- 自动生成 8 位 `inviteCode`
- 自动插入一条 `FamilyMember`
- 这条成员记录的 `roleCode = OWNER`

**成功判定**

- 返回 `201 Created`
- 响应中有 `id`
- 响应中有 `inviteCode`
- 把 `id` 存成 `familyId`

**最常见失败原因**

- `ownerUserId` 不是当前登录用户
- `ownerUserId` 指向不存在的用户

---

### 8.5 查询家庭列表 `GET /api/families`

**用途**

确认当前用户能看到自己加入的家庭。

**请求体**

无。

**后端运行逻辑**

`FamilyController.list -> FamilyAccessService.listAccessibleFamilies`

普通用户：

- 只返回自己加入的家庭

管理员：

- 返回全部家庭

**成功判定**

- 返回 `200 OK`
- 列表中存在 `familyId`

---

### 8.6 查询家庭详情 `GET /api/families/{familyId}`

**用途**

确认当前用户具备该家庭访问权限。

**请求体**

无。

**后端运行逻辑**

`FamilyController.getById -> FamilyAccessService.requireFamilyRead -> FamilyService.getById`

**成功判定**

- 返回 `200 OK`
- `id = {{familyId}}`

**最常见失败原因**

- 当前用户不属于这个家庭

---

### 8.7 再次调用 `GET /api/auth/me` 拿 `familyMemberId`

**用途**

这是测试链路里的关键步骤，不要省。

**为什么必须做**

后续这些接口虽然大多能自动补当前成员 ID，但你在债务、通知、待归类处理等地方理解权限时，必须先知道自己的 `familyMemberId` 到底是多少。

**成功判定**

- `memberships` 中出现 `familyId = {{familyId}}`
- 对应条目的 `roleCode = OWNER`
- 记下 `familyMemberId`

---

### 8.8 创建主账户 `POST /api/accounts`

**用途**

创建资金账户，后续交易、还款、账单导入都要依赖它。

**是否鉴权**

需要。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `ownerMemberId` | 否 | 可省略 |
| `accountName` | 是 | 最长 50 |
| `accountType` | 是 | 自由字符串，建议统一写大写语义值 |
| `institutionName` | 否 | 最长 100 |
| `accountNoMask` | 否 | 最长 64 |
| `currentBalance` | 否 | 默认 0 |
| `creditLimit` | 否 | 默认 0 |
| `billingDay` | 否 | 可选 |
| `repaymentDay` | 否 | 可选 |
| `isShared` | 否 | 默认 1 |
| `remark` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "accountName": "Cash Wallet",
  "accountType": "CASH",
  "institutionName": "Local",
  "accountNoMask": "CASH-001",
  "currentBalance": 5000,
  "isShared": 1,
  "remark": "main acceptance account"
}
```

**后端运行逻辑**

`AccountController.create -> FamilyAccessService.requireFamilyRead -> resolveManagedMemberId -> AccountService.create -> save(Account)`

具体行为：

- 先校验你属于这个家庭
- 如果传了 `ownerMemberId`，还要校验它属于这个家庭，并且普通成员不能冒用别人
- 默认余额、共享标记等值

**成功判定**

- 返回 `201 Created`
- 有 `id`
- `currentBalance = 5000`
- 把 `id` 存为 `accountId`

**最常见失败原因**

- `familyId` 不对
- `ownerMemberId` 传成别的家庭成员

---

### 8.9 创建第二个账户 `POST /api/accounts`（可选）

**用途**

给转账交易做目标账户。

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "accountName": "Savings Pocket",
  "accountType": "SAVINGS",
  "institutionName": "Local",
  "accountNoMask": "SAVE-001",
  "currentBalance": 1000,
  "isShared": 1,
  "remark": "optional transfer target"
}
```

**成功判定**

- 返回 `201 Created`
- 把 `id` 存为 `accountId2`

---

### 8.10 查询账户列表 `GET /api/accounts?familyId={familyId}`

**用途**

确认账户创建成功，也用于后面检查余额联动。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `accountId`

---

### 8.11 创建分类 `POST /api/categories`

**用途**

给预算、交易、规则和账单归类提供分类基础。

**是否鉴权**

需要。

**权限**

必须是 `OWNER`。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `parentId` | 否 | 可选父分类 |
| `categoryName` | 是 | 最长 50 |
| `categoryType` | 是 | 当前建议用 `EXPENSE` |
| `scopeType` | 否 | 默认 `FAMILY` |
| `iconCode` | 否 | 最长 50 |
| `sortOrder` | 否 | 默认 0 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "categoryName": "Food",
  "categoryType": "EXPENSE",
  "scopeType": "FAMILY",
  "iconCode": "meal",
  "sortOrder": 1
}
```

**后端运行逻辑**

`CategoryController.create -> FamilyAccessService.requireFamilyOwner -> CategoryService.create -> save(Category)`

具体行为：

- 必须先过 OWNER 权限
- 如果传 `parentId`，还要校验父分类属于同一家庭
- `scopeType` 默认 `FAMILY`

**成功判定**

- 返回 `201 Created`
- 把 `id` 存为 `categoryId`

**最常见失败原因**

- 你不是家庭 OWNER
- `parentId` 指到其他家庭

---

### 8.12 查询分类列表 `GET /api/categories?familyId={familyId}`

**用途**

确认分类已落库。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `categoryId`

---

### 8.13 创建预算 `POST /api/budgets`

**用途**

验证预算创建和后续预算统计联动。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `categoryId` | 是 | 必须属于当前家庭 |
| `createdByMemberId` | 否 | 建议省略 |
| `budgetName` | 是 | 最长 100 |
| `periodType` | 是 | 只能 `MONTH` 或 `YEAR` |
| `amount` | 是 | 正数 |
| `alertRatio` | 否 | 默认 0.80 |
| `startDate` | 是 | `yyyy-MM-dd` |
| `endDate` | 否 | 不能早于 `startDate` |
| `remark` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "categoryId": {{categoryId}},
  "budgetName": "Food Budget 2026-03",
  "periodType": "MONTH",
  "amount": 200,
  "alertRatio": 0.8,
  "startDate": "2026-03-01",
  "endDate": "2026-03-31",
  "remark": "acceptance budget"
}
```

**后端运行逻辑**

`BudgetController.create -> FamilyAccessService.requireFamilyRead -> resolveActorMemberId -> BudgetService.create -> save(BudgetPlan)`

具体行为：

- 校验分类属于家庭
- `createdByMemberId` 不传时自动填当前成员
- `alertRatio` 默认 `0.80`
- 预算是否生效依赖 `startDate/endDate`

**成功判定**

- 返回 `201 Created`
- 把 `id` 存为 `budgetId`

**最常见失败原因**

- `periodType` 不是 `MONTH` 或 `YEAR`
- `endDate` 小于 `startDate`

---

### 8.14 查询预算列表 `GET /api/budgets?familyId={familyId}`

**用途**

确认预算创建成功。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `budgetId`

---

### 8.15 查询预算使用情况 `GET /api/budgets/usage?familyId={familyId}&month=2026-03`

**用途**

验证预算统计接口本身可用，并作为后续交易联动的对照组。

**关键点**

- `month` 格式必须是 `yyyy-MM`
- 只统计 `EXPENSE` 交易
- 没分类的支出不会计入某个分类预算

**第一次查询的期望**

- 刚建完预算、还没记账时，`spentAmount = 0`

**成功判定**

- 返回 `200 OK`
- 对应预算的 `spentAmount = 0`

---

### 8.16 创建支出交易 `POST /api/transaction-records`

**用途**

验证交易创建、账户余额联动、预算统计联动。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `accountId` | 是 | 账户 ID |
| `targetAccountId` | 否 | 仅 `TRANSFER` 用 |
| `categoryId` | 否 | 建议支出交易传上 |
| `createdByMemberId` | 否 | 建议省略 |
| `sourceBatchId` | 否 | 手工录入不用传 |
| `transactionType` | 是 | 只能 `INCOME / EXPENSE / TRANSFER` |
| `amount` | 是 | 正数 |
| `transactionTime` | 否 | 不传默认现在 |
| `merchantName` | 否 | 最长 100 |
| `counterpartyName` | 否 | 最长 100 |
| `sourcePlatform` | 否 | 不传默认 `MANUAL` |
| `externalTradeNo` | 否 | 最长 64 |
| `note` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "accountId": {{accountId}},
  "categoryId": {{categoryId}},
  "transactionType": "EXPENSE",
  "amount": 120,
  "transactionTime": "2026-03-11T12:30:00",
  "merchantName": "CAMPUS_CANTEEN",
  "sourcePlatform": "MANUAL",
  "externalTradeNo": "manual-expense-001",
  "note": "lunch and dinner"
}
```

**后端运行逻辑**

`TransactionRecordController.create -> FamilyAccessService.requireFamilyRead -> resolveActorMemberId -> TransactionRecordService.createRecord`

具体行为：

- 校验账户属于家庭
- 校验分类属于家庭
- `createdByMemberId` 不传时补当前成员
- 因为这是 `EXPENSE`，所以源账户余额会减少
- 最终保存一条 `TransactionRecord`

**成功判定**

- 返回 `201 Created`
- `transactionType = EXPENSE`
- `amount = 120`

**最常见失败原因**

- `transactionType` 写错
- `amount` 传负数
- 账户或分类不属于当前家庭

---

### 8.17 查询交易列表 `GET /api/transaction-records?familyId={familyId}`

**用途**

确认交易已落库。

**成功判定**

- 返回 `200 OK`
- 列表中存在刚创建的支出记录

---

### 8.18 再查账户列表，验证余额联动

接口：

`GET /api/accounts?familyId={familyId}`

**预期**

- `Cash Wallet` 的余额从 `5000` 变成 `4880`

**为什么会这样**

因为 `TransactionRecordService` 对 `EXPENSE` 类型做的是：

- 账户余额 `currentBalance - amount`

---

### 8.19 再查预算使用情况，验证预算联动

接口：

`GET /api/budgets/usage?familyId={familyId}&month=2026-03`

**预期**

- `spentAmount = 120`
- `remainingAmount = 80`
- `usageRatio` 接近 `0.6000`
- `alertTriggered = false`
- `exceeded = false`

**为什么会这样**

预算统计是从交易流水表里按：

- 当前月
- `transactionType = EXPENSE`
- `categoryId = 预算分类`

实时聚合出来的。

---

### 8.20 月汇总 `GET /api/transaction-records/family/{familyId}/monthly-summary?months=6`

**用途**

验证汇总能力。

**关键逻辑**

- `months` 默认 6
- 最大 24
- `INCOME` 计收入
- `EXPENSE` 计支出
- `TRANSFER` 不计净收支

**成功判定**

- 返回 `200 OK`
- 结果中包含 `2026-03`
- `2026-03` 的 `expense >= 120`

---

### 8.21 可选转账交易 `POST /api/transaction-records`

**用途**

验证 `TRANSFER` 逻辑。

**前提**

你已经有 `accountId2`。

**请求体**

```json
{
  "familyId": {{familyId}},
  "accountId": {{accountId}},
  "targetAccountId": {{accountId2}},
  "transactionType": "TRANSFER",
  "amount": 200,
  "transactionTime": "2026-03-11T15:00:00",
  "merchantName": "INTERNAL_TRANSFER",
  "sourcePlatform": "MANUAL",
  "externalTradeNo": "manual-transfer-001",
  "note": "optional transfer test"
}
```

**成功判定**

- 返回 `201 Created`
- 转出账户减少 `200`
- 转入账户增加 `200`

**最常见失败原因**

- `TRANSFER` 漏掉 `targetAccountId`
- `targetAccountId` 和 `accountId` 相同

---

### 8.22 创建债务 `POST /api/debts`

**用途**

验证债务建模和后续还款提醒链路。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `debtorMemberId` | 否 | 建议省略 |
| `debtName` | 是 | 最长 100 |
| `debtType` | 是 | 自由字符串，建议写统一值 |
| `lenderName` | 否 | 最长 100 |
| `principalAmount` | 是 | 正数 |
| `annualRate` | 否 | 默认 0 |
| `billingDay` | 否 | 可选 |
| `repaymentDay` | 否 | 可选 |
| `dueDate` | 否 | `yyyy-MM-dd` |
| `remark` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "debtName": "Student Installment",
  "debtType": "CREDIT",
  "lenderName": "Bank A",
  "principalAmount": 1000,
  "annualRate": 0.05,
  "repaymentDay": 14,
  "dueDate": "2026-03-14",
  "remark": "acceptance debt"
}
```

**后端运行逻辑**

`DebtController.create -> FamilyAccessService.requireFamilyRead -> resolveManagedMemberId -> DebtService.create`

具体行为：

- `debtorMemberId` 不传时自动取当前成员
- `currentBalance` 直接初始化为 `principalAmount`
- `status = ACTIVE`

**成功判定**

- 返回 `201 Created`
- `currentBalance = 1000`
- 把 `id` 存成 `debtId`

---

### 8.23 查询债务列表 `GET /api/debts?familyId={familyId}`

**用途**

确认债务创建成功。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `debtId`

---

### 8.24 创建还款记录 `POST /api/debts/{debtId}/repayments`

**用途**

验证债务余额和账户余额同步变化。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 形式上必填，但 controller 会覆盖成债务真实 familyId |
| `payAccountId` | 否 | 传了就会扣账户余额 |
| `createdByMemberId` | 否 | 建议省略 |
| `amount` | 是 | 正数 |
| `principalPaid` | 否 | 不传时按全部本金 |
| `interestPaid` | 否 | 不传时按 0 |
| `repaymentTime` | 否 | 不传默认当前时间 |
| `note` | 否 | 最长 255 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "payAccountId": {{accountId}},
  "amount": 300,
  "principalPaid": 280,
  "interestPaid": 20,
  "repaymentTime": "2026-03-11T20:00:00",
  "note": "first repayment"
}
```

**后端运行逻辑**

`DebtController.repay -> debtService.getDebt -> FamilyAccessService.requireFamilyRead -> resolveActorMemberId -> DebtService.repay`

具体行为：

- 读取债务
- 校验账户属于家庭
- 若 `principalPaid + interestPaid != amount`，直接 `400`
- 债务余额扣减 `principalPaid`
- 如果有付款账户，账户余额扣减 `amount`
- 若债务余额变成 `0`，状态改成 `CLEARED`

**成功判定**

- 返回 `201 Created`
- 响应中的 `amount = 300`

**最常见失败原因**

- `principalPaid + interestPaid` 不等于 `amount`
- `principalPaid` 超过当前欠款

---

### 8.25 查询还款记录 `GET /api/debts/{debtId}/repayments`

**成功判定**

- 返回 `200 OK`
- 列表中存在刚才的还款记录

---

### 8.26 再查债务列表，验证欠款联动

接口：

`GET /api/debts?familyId={familyId}`

**预期**

- 这笔债务的 `currentBalance` 从 `1000` 变成 `720`

**为什么**

- 这次还款里只有 `280` 被算成还本金
- `20` 是利息

---

### 8.27 再查账户列表，验证付款账户联动

接口：

`GET /api/accounts?familyId={familyId}`

**预期**

- 主账户在前一步交易基础上再减少 `300`

---

### 8.28 债务提醒检查 `POST /api/debts/check-reminders?familyId={familyId}&daysAhead=7`

**用途**

验证债务提醒不是自动跑，而是通过这个接口手动触发。

**权限**

必须是 `OWNER`。

**请求体**

无。

**后端运行逻辑**

`DebtController.checkReminders -> FamilyAccessService.requireFamilyOwner -> DebtService.checkReminders -> NotificationService.createIfAbsentToday`

具体行为：

- 查找 `ACTIVE` 且余额大于 0 的债务
- 如果有 `dueDate`，优先用 `dueDate`
- 如果没有 `dueDate`，但有 `repaymentDay`，按每月还款日推算
- 当天相同来源提醒会去重

**成功判定**

- 返回 `200 OK`
- `reminderCount >= 1`
- `details` 里能看到债务名

**最常见失败原因**

- 普通成员调用，返回 `403`

---

### 8.29 创建规则 `POST /api/rules`

**用途**

验证轻量规则引擎的规则定义能力。

**权限**

必须是 `OWNER`。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `categoryId` | 条件必填 | `CATEGORY_EXPENSE` 时必须传 |
| `createdByMemberId` | 否 | 建议省略 |
| `ruleName` | 是 | 最长 100 |
| `ruleType` | 是 | 只能 `THRESHOLD` |
| `metricType` | 是 | `CATEGORY_EXPENSE` 或 `FAMILY_EXPENSE` |
| `timeScope` | 是 | `MONTH` 或 `YEAR` |
| `operatorType` | 是 | `GT/GTE/LT/LTE/EQ` |
| `thresholdValue` | 是 | 正数 |
| `actionType` | 是 | 只能 `NOTIFY` |
| `messageTemplate` | 是 | 最长 255 |
| `priority` | 否 | 默认 100 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "categoryId": {{categoryId}},
  "ruleName": "Food expense warning",
  "ruleType": "THRESHOLD",
  "metricType": "CATEGORY_EXPENSE",
  "timeScope": "MONTH",
  "operatorType": "GTE",
  "thresholdValue": 100,
  "actionType": "NOTIFY",
  "messageTemplate": "Food expense reached threshold",
  "priority": 10
}
```

**后端运行逻辑**

`RuleDefinitionController.create -> FamilyAccessService.requireFamilyOwner -> resolveActorMemberId -> RuleDefinitionService.create`

具体行为：

- 校验家庭 OWNER 权限
- 校验分类属于家庭
- 枚举值全部转大写
- 仅支持阈值规则

**成功判定**

- 返回 `201 Created`
- 把 `id` 存为 `ruleId`

**最常见失败原因**

- `ruleType` 不是 `THRESHOLD`
- `actionType` 不是 `NOTIFY`
- `CATEGORY_EXPENSE` 却没传 `categoryId`

---

### 8.30 查询规则列表 `GET /api/rules?familyId={familyId}`

**成功判定**

- 返回 `200 OK`
- 列表中存在 `ruleId`

---

### 8.31 手动评估规则 `POST /api/rules/evaluate?familyId={familyId}&month=2026-03`

**用途**

验证预算预警、规则命中、规则执行日志和通知生成。

**权限**

必须是 `OWNER`。

**请求体**

无。

**后端运行逻辑**

`RuleDefinitionController.evaluate -> FamilyAccessService.requireFamilyOwner -> RuleEvaluationService.evaluate`

具体行为：

- 先跑预算预警评估
- 再跑规则定义评估
- 每条规则都会写 `RuleExecutionLog`
- 命中后尝试生成通知

**一个重要细节**

返回值里的 `generatedNotificationCount` 不是严格意义上的“本次真正新增的通知条数”，因为预算预警部分是先计数，再尝试去重通知。  
所以如果你同一天连续评估多次，数字和 `details` 不一定完全一致。

**成功判定**

- 返回 `200 OK`
- `triggeredRuleCount >= 1`
- `generatedNotificationCount >= 1`

---

### 8.32 查询通知 `GET /api/notifications?familyId={familyId}`

**用途**

查看债务提醒和规则触发通知。

**后端运行逻辑**

`NotificationController.list -> NotificationService.list -> FamilyAccessService.requireFamilyRead / requireNotificationTargetReadable`

具体行为：

- OWNER 可以看全家庭
- 普通成员只能看公共通知和自己的通知

**成功判定**

- 返回 `200 OK`
- 列表里能看到规则通知或债务提醒
- 记下第一条 `id` 为 `notificationId`

**可选测试**

你也可以带 `targetMemberId={{familyMemberId}}` 查询自己的通知。

---

### 8.33 标记通知已读 `POST /api/notifications/{notificationId}/read`

**请求体**

无。

**后端运行逻辑**

`NotificationController.markRead -> NotificationService.markRead -> FamilyAccessService.requireNotificationAccess`

**成功判定**

- 返回 `200 OK`
- `readStatus = 1`

---

### 8.34 创建账单解析规则 `POST /api/bill-parse-rules`

**用途**

让导入时某些商户自动命中分类。

**权限**

必须是 `OWNER`。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | DTO 上没 `@NotNull`，但实际必须传 |
| `categoryId` | 是 | 分类 ID |
| `merchantKeyword` | 否 | 与 `regexPattern` 至少填一个 |
| `regexPattern` | 否 | 合法正则 |
| `priority` | 否 | 默认 100 |

**推荐请求体**

```json
{
  "familyId": {{familyId}},
  "categoryId": {{categoryId}},
  "merchantKeyword": "STARBUCKS",
  "priority": 10
}
```

**后端运行逻辑**

`BillParseRuleController.create -> FamilyAccessService.requireFamilyOwner -> BillParseRuleService.create`

具体行为：

- 校验 `familyId`
- 校验分类属于家庭
- 关键词规则和正则规则至少填一个
- 匹配时家用规则优先，优先级数字越小越优先

**成功判定**

- 返回 `201 Created`

**最常见失败原因**

- `familyId` 漏传
- `merchantKeyword` 和 `regexPattern` 都为空
- 正则表达式非法

---

### 8.35 查询账单解析规则 `GET /api/bill-parse-rules?familyId={familyId}`

**成功判定**

- 返回 `200 OK`
- 列表中存在 `merchantKeyword = STARBUCKS`

---

### 8.36 第一轮账单导入 `POST /api/bill-imports/upload`

**用途**

同时验证：

- 自动分类
- 未匹配进入待归类队列
- 批次记录生成

**请求方式**

`multipart/form-data`

**表单字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `familyId` | 是 | 家庭 ID |
| `uploadedByMemberId` | 否 | 建议省略 |
| `accountId` | 是 | 导入到哪个账户 |
| `sourcePlatform` | 否 | 默认 `CSV` |
| `file` | 是 | 上传文件 |

**推荐表单值**

- `familyId = {{familyId}}`
- `accountId = {{accountId}}`
- `sourcePlatform = CSV`
- `file = docs/samples/bill_import_sample_round1.csv`

**样例文件说明**

`bill_import_sample_round1.csv` 包含两行：

- `STARBUCKS`，应命中你刚才建的解析规则
- `UNKNOWN_STORE`，应因为匹配不到分类而进入待归类队列

**后端运行逻辑**

`BillImportController.upload -> FamilyAccessService.requireFamilyRead -> resolveActorMemberId -> BillImportService.importCsv`

具体行为：

- 先按整个文件内容计算哈希
- 若该文件曾成功导入过，直接 `409`
- 解析 CSV
- 每一行先尝试按商户规则匹配分类
- 不行再按原始分类名匹配
- 有分类则直接入交易流水
- 没分类则也先入交易流水，但把 `categoryId` 留空，再生成 `PENDING` 记录

**成功判定**

- 返回 `201 Created`
- 响应中有 `batch.id`
- 存成 `batchId`
- `importedCount = 2`
- `unmatchedCount = 1`

**最常见失败原因**

- 用 JSON 发，而不是 multipart
- 文件为空
- `accountId` 不属于当前家庭

---

### 8.37 查询导入批次 `GET /api/bill-imports?familyId={familyId}`

**用途**

确认导入批次记录已生成。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `batchId`
- 对应批次的 `unmatchedCount = 1`

---

### 8.38 查询待归类列表 `GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`

**用途**

确认未匹配的交易进入待归类队列。

**权限**

必须是 `OWNER`。

**成功判定**

- 返回 `200 OK`
- 列表中存在 `merchantName = UNKNOWN_STORE`
- 把这条记录的 `id` 存为 `pendingItemId`

**最常见失败原因**

- 你不是 OWNER
- `status` 写成 `ALL`

---

### 8.39 处理待归类项 `POST /api/bill-imports/pending-items/{pendingItemId}/resolve`

**用途**

验证人工归类、交易回写、自动补规则。

**权限**

必须是 `OWNER`。

**请求体字段**

| 字段 | 是否必填 | 说明 |
|---|---|---|
| `categoryId` | 是 | 归类到哪个分类 |
| `resolvedByMemberId` | 否 | 建议省略 |
| `createParseRule` | 否 | 是否顺手补规则 |
| `priority` | 否 | 补规则的优先级 |

**推荐请求体**

```json
{
  "categoryId": {{categoryId}},
  "createParseRule": true,
  "priority": 20
}
```

**后端运行逻辑**

`BillImportController.resolvePendingItem -> FamilyAccessService.requireFamilyOwner -> resolveActorMemberId -> BillImportPendingItemService.resolve`

具体行为：

- 待归类状态必须还是 `PENDING`
- 会回写关联交易记录的 `categoryId`
- 把待归类项改成 `RESOLVED`
- 如果 `createParseRule = true` 且商户名存在，会自动补一条关键词规则

**成功判定**

- 返回 `200 OK`
- `status = RESOLVED`
- `resolvedCategoryId = {{categoryId}}`

**最常见失败原因**

- `pendingItemId` 不存在
- 这条待归类已经处理过

---

### 8.40 再查待归类列表，确认已消失

接口：

`GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`

**预期**

- 刚才那条 `UNKNOWN_STORE` 不再出现

---

### 8.41 第二轮账单导入 `POST /api/bill-imports/upload`

**用途**

验证上一步自动补的解析规则已经生效。

**表单值**

- `familyId = {{familyId}}`
- `accountId = {{accountId}}`
- `sourcePlatform = CSV`
- `file = docs/samples/bill_import_sample_round2.csv`

**为什么用第二个文件**

第二个文件里仍然有 `UNKNOWN_STORE`，但交易号不同，所以不会被单条流水去重挡住；这样才能验证“自动补规则是否成功”。

**成功判定**

- 返回 `201 Created`
- `unmatchedCount = 0`
- 不再产生新的待归类项

---

### 8.42 再查待归类列表，确认没有新增待归类

接口：

`GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`

**预期**

- 返回 `200 OK`
- 没有第二轮新产生的 `UNKNOWN_STORE`

---

### 8.43 重复上传同一个文件，验证文件级去重

**用途**

验证导入批次的文件哈希去重逻辑。

**操作**

再次上传：

- `docs/samples/bill_import_sample_round2.csv`

**预期**

- 返回 `409 Conflict`

**为什么**

`BillImportService` 会把整个文件做 SHA-256，如果同一家庭下已经存在成功或部分成功的相同文件哈希，就直接拒绝。

## 9. 你最可能关心的“接口背后真正怎么跑”

### 9.1 家庭创建为什么会影响后续所有接口

因为家庭创建完成后，系统不仅保存 `Family`，还自动写一条 `FamilyMember`。  
后面很多权限判断、默认成员补值、通知过滤，都是围绕 `FamilyMember` 做的。

### 9.2 为什么预算不是单独维护“已用金额”

预算使用量不是单独存表，而是根据 `TransactionRecord` 实时聚合出来的。  
所以你只要交易流水有变化，再查 `/api/budgets/usage`，结果就会变。

### 9.3 为什么交易会直接改账户余额

`TransactionRecordService.createRecord` 在保存流水前就先改 `Account.currentBalance`：

- 收入加钱
- 支出减钱
- 转账一减一加

所以你验收时要先查交易成功，再回头查账户余额。

### 9.4 为什么债务还款会动两个地方

还款接口不是只存一条 `DebtRepayment`：

- 会扣债务余额
- 如果你传了 `payAccountId`，还会扣付款账户余额

### 9.5 为什么规则评估后通知数量有时看起来不完全对

规则评估接口会：

- 评预算预警
- 评规则定义
- 尝试建通知
- 写规则执行日志

但通知有“同日同源去重”。  
所以你同一天重复点很多次，计数字段和真正新增的通知数不一定完全一致。

### 9.6 为什么账单导入不是“识别不到就失败”

当前设计不是“识别不到就整批失败”，而是：

- 交易照样先入账
- 分类先留空
- 再放进待归类队列人工补

这样导入闭环更完整。

## 10. 常见状态码怎么理解

### `400 Bad Request`

大多是参数值不符合后端业务规则，例如：

- `userType = NORMAL`
- `periodType` 错
- `transactionType` 错
- `TRANSFER` 缺少 `targetAccountId`
- `principalPaid + interestPaid != amount`
- `status=ALL`

### `401 Unauthorized`

大多是：

- 没带 token
- token 失效
- 登录信息错误

### `403 Forbidden`

大多是：

- 你不是这个家庭成员
- 你不是 OWNER
- 你试图伪造别的家庭成员身份

### `404 Not Found`

大多是：

- `familyId/accountId/categoryId/debtId/pendingItemId` 不存在

### `409 Conflict`

当前项目里最典型的是：

- 用户名、手机号、邮箱重复
- 重复上传相同账单文件

## 11. 当前主线里最重要的枚举和值

| 字段 | 当前真实可用值 |
|---|---|
| `userType` | `USER` |
| `transactionType` | `INCOME` / `EXPENSE` / `TRANSFER` |
| `periodType` | `MONTH` / `YEAR` |
| `metricType` | `CATEGORY_EXPENSE` / `FAMILY_EXPENSE` |
| `timeScope` | `MONTH` / `YEAR` |
| `operatorType` | `GT` / `GTE` / `LT` / `LTE` / `EQ` |
| `actionType` | `NOTIFY` |
| `pending status` | `PENDING` / `RESOLVED` |

## 12. 额外接口说明

### 12.1 `GET /api/users`

这个接口存在，但需要管理员权限。  
而当前注册接口只允许注册 `USER`，不允许你自助注册 `ADMIN`。  
所以如果数据库里没有预置管理员账号，这个接口先不作为当前主线验收重点。

### 12.2 遗留接口

项目里还保留着这些旧接口：

- `GET /api/transaction/list`
- `POST /api/transaction/add`
- `GET /api/rule/list`

它们属于旧版链路，不是这次主线系统的重点，不建议你把它们和当前 `TransactionRecord / RuleDefinition / BillImport` 这条新链路混在一起验收。

## 13. 最终通过标准

如果下面这些点全部通过，你就可以比较有把握地说“当前项目后端主线已经具备完整演示能力”：

- [ ] 用户注册成功
- [ ] 用户登录成功
- [ ] 能获取当前用户信息
- [ ] 家庭创建成功
- [ ] 自动生成 OWNER 家庭成员身份
- [ ] 账户创建成功
- [ ] 分类创建成功
- [ ] 预算创建成功
- [ ] 手工新增交易后，账户余额联动成功
- [ ] 手工新增交易后，预算统计联动成功
- [ ] 债务创建成功
- [ ] 还款后债务余额和账户余额联动成功
- [ ] 债务提醒接口成功生成通知
- [ ] 规则创建成功
- [ ] 规则评估成功
- [ ] 通知查询和已读成功
- [ ] 账单解析规则创建成功
- [ ] 第一轮账单导入成功
- [ ] 未匹配账单进入待归类队列
- [ ] 人工处理待归类成功
- [ ] 自动补规则成功
- [ ] 第二轮账单导入时自动分类成功
- [ ] 重复文件导入被拦截

## 14. 你接下来怎么用这份文档最合适

最实用的方法是：

1. 从 `POST /api/users` 开始，按第 8 节顺序逐个测。
2. 每成功一步，就把返回的 ID 记到 Apifox 环境变量。
3. 遇到报错时，不要先怀疑 Apifox，先对照本接口的“后端运行逻辑”和“常见失败原因”。
4. 如果你愿意，我下一步可以直接跟着这份文档，继续陪你从第一个接口开始逐步验收。
