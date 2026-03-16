# 接口验收清单

更新时间：2026-03-11

适用项目目录：`C:\Users\Ttop\codex_tmp_finance_verify_20260309_1`

## 1. 文档用途

这份文档用于把当前后端项目的接口验收流程固定下来，方便你用 Apifox、Postman 或 IDEA HTTP Client 按顺序逐项测试。

这份清单重点覆盖当前主线后端能力：

- 用户注册与 JWT 登录
- 家庭创建与成员身份获取
- 账户、分类、预算
- 新版交易流水
- 债务与还款
- 规则定义与规则评估
- 通知
- 账单导入、待归类处理、重复导入拦截

不作为本轮主验收重点的接口：

- `GET /api/users`，因为它要求管理员权限
- 旧版遗留接口 ` /api/transaction/* `、` /api/rule/* `

## 2. 验收前准备

### 2.1 运行环境检查

- [ ] 已安装 MySQL 8
- [ ] 已创建数据库 `finance_system`
- [ ] 已确认 `src/main/resources/application.yml` 中的数据库连接可用
- [ ] 已确认服务端口为 `8088`
- [ ] 已执行项目启动命令

推荐启动命令：

```bash
mvn spring-boot:run
```

如果你想先确认项目能编译，再启动：

```bash
mvn -DskipTests compile
```

## 2.2 全局测试约定

基础地址：

```text
http://localhost:8088
```

除 `POST /api/users` 和 `POST /api/auth/login` 外，其余接口都需要：

```text
Authorization: Bearer {accessToken}
```

建议在测试工具里维护这些变量：

- `baseUrl = http://localhost:8088`
- `token`
- `userId`
- `familyId`
- `familyMemberId`
- `accountId`
- `accountId2`
- `categoryId`
- `budgetId`
- `debtId`
- `ruleId`
- `notificationId`
- `batchId`
- `pendingItemId`

## 3. 建议验收顺序

建议按下面顺序执行。这样每一步创建出来的数据都会被后续步骤复用，不需要你自己临时补参数。

## 4. 核心验收步骤

### A. 认证与家庭初始化

#### A1. 注册用户

- 接口：`POST /api/users`
- 是否鉴权：否
- 目标：验证用户注册功能正常

请求体示例：

```json
{
  "username": "accept_user_01",
  "password": "Pass123456",
  "nickname": "accept01",
  "realName": "Acceptance User",
  "phone": "13800000001",
  "email": "accept01@example.com",
  "userType": "USER"
}
```

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `id`
- [ ] 记录该 `id` 为 `userId`

#### A2. 登录

- 接口：`POST /api/auth/login`
- 是否鉴权：否
- 目标：获取 JWT

请求体示例：

```json
{
  "username": "accept_user_01",
  "password": "Pass123456"
}
```

验收点：

- [ ] 返回 `200 OK`
- [ ] 响应中有 `accessToken`
- [ ] `tokenType` 为 `Bearer`
- [ ] 记录 `accessToken` 为 `token`

#### A3. 查询当前登录用户

- 接口：`GET /api/auth/me`
- 是否鉴权：是
- 目标：确认当前用户身份正常

验收点：

- [ ] 返回 `200 OK`
- [ ] `user.id` 等于前面注册出来的 `userId`
- [ ] 当前 `memberships` 允许为空

#### A4. 创建家庭

- 接口：`POST /api/families`
- 是否鉴权：是
- 目标：创建家庭，并自动把当前用户写入家庭成员表

请求体示例：

```json
{
  "familyName": "Graduation Demo Family",
  "ownerUserId": {{userId}},
  "currencyCode": "CNY",
  "timezone": "Asia/Shanghai",
  "remark": "for acceptance test"
}
```

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `id`
- [ ] 记录该 `id` 为 `familyId`
- [ ] 响应中有 `inviteCode`

#### A5. 查询家庭列表

- 接口：`GET /api/families`
- 是否鉴权：是
- 目标：验证当前用户已能看到自己创建的家庭

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `familyId`

#### A6. 查询家庭详情

- 接口：`GET /api/families/{familyId}`
- 是否鉴权：是
- 目标：验证家庭读权限

验收点：

- [ ] 返回 `200 OK`
- [ ] 响应中的 `id` 等于 `familyId`

#### A7. 再次查询当前用户，拿到家庭成员 ID

- 接口：`GET /api/auth/me`
- 是否鉴权：是
- 目标：获取后续可复用的 `familyMemberId`

验收点：

- [ ] 返回 `200 OK`
- [ ] `memberships` 中存在刚创建的 `familyId`
- [ ] 该条 membership 的 `roleCode` 为 `OWNER`
- [ ] 记录 `familyMemberId`

### B. 账户、分类、预算

#### B1. 创建账户

- 接口：`POST /api/accounts`
- 是否鉴权：是
- 目标：创建资金账户

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `id`
- [ ] 记录为 `accountId`
- [ ] `currentBalance` 为 `5000`

#### B2. 可选：创建第二个账户，用于转账测试

- 接口：`POST /api/accounts`
- 是否鉴权：是

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 记录为 `accountId2`

#### B3. 查询账户列表

- 接口：`GET /api/accounts?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `accountId`

#### B4. 创建支出分类

- 接口：`POST /api/categories`
- 是否鉴权：是
- 目标：创建预算和消费规则要用的分类

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `id`
- [ ] 记录为 `categoryId`

#### B5. 查询分类列表

- 接口：`GET /api/categories?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `categoryId`

#### B6. 创建预算

- 接口：`POST /api/budgets`
- 是否鉴权：是
- 目标：验证预算创建成功

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `id`
- [ ] 记录为 `budgetId`

#### B7. 查询预算列表

- 接口：`GET /api/budgets?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `budgetId`

#### B8. 查询预算使用情况

- 接口：`GET /api/budgets/usage?familyId={familyId}&month=2026-03`
- 是否鉴权：是
- 目标：验证预算统计接口可用

验收点：

- [ ] 返回 `200 OK`
- [ ] `Food Budget 2026-03` 对应的 `spentAmount` 初始为 `0`

### C. 交易流水与汇总

#### C1. 新增一笔支出交易

- 接口：`POST /api/transaction-records`
- 是否鉴权：是
- 目标：验证交易创建、账户余额联动、预算统计基础数据

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中的 `transactionType` 为 `EXPENSE`
- [ ] 响应中的 `amount` 为 `120`

#### C2. 查询交易列表

- 接口：`GET /api/transaction-records?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在刚创建的支出交易

#### C3. 查询账户列表，确认余额已联动

- 接口：`GET /api/accounts?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] `Cash Wallet` 的 `currentBalance` 由 `5000` 变为 `4880`

#### C4. 再查预算使用情况

- 接口：`GET /api/budgets/usage?familyId={familyId}&month=2026-03`
- 是否鉴权：是

验收点：

- [ ] `spentAmount` 为 `120`
- [ ] `remainingAmount` 为 `80`
- [ ] `usageRatio` 接近 `0.6000`
- [ ] `alertTriggered` 为 `false`
- [ ] `exceeded` 为 `false`

#### C5. 查询月度汇总

- 接口：`GET /api/transaction-records/family/{familyId}/monthly-summary?months=6`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 结果中包含 `2026-03`
- [ ] `2026-03` 的 `expense` 至少为 `120`

#### C6. 可选：转账交易

前置条件：

- 已创建 `accountId2`

接口：`POST /api/transaction-records`

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 转出账户减少 `200`
- [ ] 转入账户增加 `200`

### D. 债务、还款、提醒

#### D1. 创建债务

- 接口：`POST /api/debts`
- 是否鉴权：是
- 目标：验证债务创建与未来提醒逻辑

请求体示例：

```json
{
  "familyId": {{familyId}},
  "debtorMemberId": {{familyMemberId}},
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

验收点：

- [ ] 返回 `201 Created`
- [ ] 记录 `id` 为 `debtId`
- [ ] `currentBalance` 初始为 `1000`

#### D2. 查询债务列表

- 接口：`GET /api/debts?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `debtId`

#### D3. 创建还款记录

- 接口：`POST /api/debts/{debtId}/repayments`
- 是否鉴权：是
- 目标：验证还款后债务余额和支付账户余额同步变化

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 还款记录中的 `amount` 为 `300`

#### D4. 查询还款记录列表

- 接口：`GET /api/debts/{debtId}/repayments`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在刚创建的还款记录

#### D5. 再查债务列表

- 接口：`GET /api/debts?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] `debtId` 对应的 `currentBalance` 从 `1000` 变成 `720`

#### D6. 再查账户列表

- 接口：`GET /api/accounts?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] `Cash Wallet` 的余额在前一步基础上再减少 `300`

#### D7. 触发债务提醒检查

- 接口：`POST /api/debts/check-reminders?familyId={familyId}&daysAhead=7`
- 是否鉴权：是
- 目标：验证手动提醒生成

验收点：

- [ ] 返回 `200 OK`
- [ ] `reminderCount` 大于等于 `1`
- [ ] `details` 中包含当前债务名称

### E. 规则定义、规则评估、通知

#### E1. 创建规则

- 接口：`POST /api/rules`
- 是否鉴权：是
- 目标：验证轻量规则引擎的规则定义能力

请求体示例：

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

验收点：

- [ ] 返回 `201 Created`
- [ ] 记录 `id` 为 `ruleId`

#### E2. 查询规则列表

- 接口：`GET /api/rules?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `ruleId`

#### E3. 手动评估规则

- 接口：`POST /api/rules/evaluate?familyId={familyId}&month=2026-03`
- 是否鉴权：是
- 目标：验证规则触发和通知生成

验收点：

- [ ] 返回 `200 OK`
- [ ] `triggeredRuleCount` 大于等于 `1`
- [ ] `generatedNotificationCount` 大于等于 `1`

#### E4. 查询通知列表

- 接口：`GET /api/notifications?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中能看到规则评估通知或债务提醒通知
- [ ] 记录第一条通知的 `id` 为 `notificationId`

#### E5. 标记通知已读

- 接口：`POST /api/notifications/{notificationId}/read`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] `readStatus` 变为 `1`

### F. 账单导入、待归类、自动解析规则

本节建议使用这两个示例文件：

- `docs/samples/bill_import_sample_round1.csv`
- `docs/samples/bill_import_sample_round2.csv`

这两个文件我已经放进项目里，直接可用。

#### F1. 先创建一条账单解析规则

- 接口：`POST /api/bill-parse-rules`
- 是否鉴权：是
- 目标：让第一轮导入时 `STARBUCKS` 自动归到 `Food`

请求体示例：

```json
{
  "familyId": {{familyId}},
  "categoryId": {{categoryId}},
  "merchantKeyword": "STARBUCKS",
  "priority": 10
}
```

验收点：

- [ ] 返回 `201 Created`

#### F2. 查询账单解析规则列表

- 接口：`GET /api/bill-parse-rules?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `merchantKeyword = STARBUCKS`

#### F3. 上传第一轮账单文件

- 接口：`POST /api/bill-imports/upload`
- 是否鉴权：是
- 目标：同时验证自动分类和待归类队列

表单字段：

- `familyId = {{familyId}}`
- `accountId = {{accountId}}`
- `sourcePlatform = CSV`
- `file = docs/samples/bill_import_sample_round1.csv`

预期文件内容说明：

- 第 1 行商户 `STARBUCKS`，应命中上一步规则并自动分类
- 第 2 行商户 `UNKNOWN_STORE`，应进入待归类队列

验收点：

- [ ] 返回 `201 Created`
- [ ] 响应中有 `batch.id`
- [ ] 记录为 `batchId`
- [ ] `importedCount` 为 `2`
- [ ] `unmatchedCount` 为 `1`

#### F4. 查询导入批次列表

- 接口：`GET /api/bill-imports?familyId={familyId}`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在 `batchId`
- [ ] `unmatchedCount` 为 `1`

#### F5. 查询待归类列表

- 接口：`GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表中存在商户 `UNKNOWN_STORE`
- [ ] 记录该条 `id` 为 `pendingItemId`

#### F6. 处理待归类项，并顺手生成解析规则

- 接口：`POST /api/bill-imports/pending-items/{pendingItemId}/resolve`
- 是否鉴权：是
- 目标：验证人工归类和自动补规则

请求体示例：

```json
{
  "categoryId": {{categoryId}},
  "resolvedByMemberId": {{familyMemberId}},
  "createParseRule": true,
  "priority": 20
}
```

验收点：

- [ ] 返回 `200 OK`
- [ ] `status` 变为 `RESOLVED`
- [ ] `resolvedCategoryId` 等于 `categoryId`

#### F7. 再查待归类列表

- 接口：`GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 刚才那条记录不再出现在 `PENDING` 列表中

#### F8. 上传第二轮账单文件

- 接口：`POST /api/bill-imports/upload`
- 是否鉴权：是
- 目标：验证上一步自动补出的解析规则已经生效

表单字段：

- `familyId = {{familyId}}`
- `accountId = {{accountId}}`
- `sourcePlatform = CSV`
- `file = docs/samples/bill_import_sample_round2.csv`

这个文件中再次包含 `UNKNOWN_STORE`，但交易号不同，不会被流水号去重拦截。

验收点：

- [ ] 返回 `201 Created`
- [ ] `unmatchedCount` 为 `0`
- [ ] 没有新的待归类项产生

#### F9. 再次查询待归类列表

- 接口：`GET /api/bill-imports/pending-items?familyId={familyId}&status=PENDING`
- 是否鉴权：是

验收点：

- [ ] 返回 `200 OK`
- [ ] 列表为空，或至少没有第二轮文件新增的 `UNKNOWN_STORE`

#### F10. 重复上传同一个文件，验证文件级去重

- 接口：`POST /api/bill-imports/upload`
- 是否鉴权：是
- 目标：验证相同文件哈希被拦截

操作方式：

- 重新上传 `docs/samples/bill_import_sample_round2.csv`

验收点：

- [ ] 返回 `409 Conflict`
- [ ] 错误信息说明检测到重复导入文件

## 5. 建议的最终通过标准

如果下面这些点都通过，就可以认为当前项目主线后端已经具备可演示、可答辩说明的完成度：

- [ ] 用户注册、登录、获取当前用户成功
- [ ] 家庭创建成功，并能正确拿到 `OWNER` 身份
- [ ] 账户、分类、预算创建和查询成功
- [ ] 交易创建后，账户余额和预算统计发生联动
- [ ] 债务创建、还款、提醒检查成功
- [ ] 规则创建、规则评估、通知生成成功
- [ ] CSV 导入成功
- [ ] 未识别账单进入待归类队列
- [ ] 人工处理待归类后，能自动补全解析规则
- [ ] 第二轮导入时，新规则能自动生效
- [ ] 同一文件重复上传会被拦截

## 6. 常见失败点

### 6.1 返回 401

通常说明：

- 没有带 `Authorization: Bearer {token}`
- token 已过期
- token 复制不完整

### 6.2 返回 403

通常说明：

- 当前接口只允许家庭成员访问
- 当前接口要求家庭 `OWNER` 权限
- 请求里的 `ownerUserId`、`resolvedByMemberId`、`debtorMemberId` 不属于当前登录用户可操作范围

### 6.3 返回 400

通常说明：

- `familyId`、`categoryId`、`accountId` 之间不属于同一个家庭
- 枚举值写错
- 日期格式不对
- 还款金额不等于本金加利息

当前主线里比较关键的可用枚举值如下：

- `transactionType`: `INCOME` / `EXPENSE` / `TRANSFER`
- `periodType`: `MONTH` / `YEAR`
- `metricType`: `CATEGORY_EXPENSE` / `FAMILY_EXPENSE`
- `timeScope`: `MONTH` / `YEAR`
- `operatorType`: `GT` / `GTE` / `LT` / `LTE` / `EQ`
- `actionType`: `NOTIFY`

### 6.4 返回 409

本项目当前最典型的 `409` 是：

- 重复上传相同账单文件，被文件哈希拦截

## 7. 你做答辩时可以怎么说

如果老师问“你怎么证明系统已经做出来了”，你可以直接按这条线回答：

1. 我先注册并登录，说明认证链路已经打通。
2. 我创建家庭后，系统自动把当前用户写成家庭成员，并授予家庭主权限。
3. 我再创建账户、分类和预算，说明基础财务模型已经能工作。
4. 我录入一笔支出后，账户余额和预算使用率会同步变化，说明业务联动已经存在。
5. 我创建债务并录入还款，说明负债管理已经跑通。
6. 我再创建一条消费规则并手动评估，系统会生成通知，说明规则引擎原型已经可演示。
7. 我最后导入账单，系统可以自动分类、把未识别账单放进待归类队列，并且能阻止重复导入，说明账单导入闭环已经完成。

如果你还要继续往下做，下一步最值得补的是：

- Apifox 接口集合导出
- 自动化接口测试脚本
- 一个最小前端演示页
