# Graduation Project Finance

基于规则引擎的家庭财务管理系统后端雏形，使用 `Spring Boot + Spring Data JPA + MySQL` 实现。

当前仓库已经补充了两部分关键内容：

- 一套面向毕业设计实现的数据库设计文档和建表 SQL
- 一组与数据库设计对应的 JPA 实体类，便于后续继续补 `repository / service / controller`

## 目录说明

- `sql/finance_schema.sql`
  数据库建表脚本
- `docs/database/db_schema_design.md`
  数据库表结构设计说明
- `docs/database/finance_er_diagram.md`
  ER 图说明与 Mermaid 图代码
- `src/main/java/com/example/finance/entity`
  实体类目录

## 已补充的实体

目前已新增这些核心实体：

- `AbstractAuditEntity`
- `SysUser`
- `Family`
- `FamilyMember`
- `Category`
- `Account`
- `BillImportBatch`
- `BillParseRule`
- `TransactionRecord`
- `BudgetPlan`
- `Debt`
- `DebtRepayment`
- `FixedAsset`
- `RuleDefinition`
- `RuleExecutionLog`
- `Notification`
- `FamilyFinancialProfile`
- `FinancialAdvice`
- `DataExportLog`

为了避免直接打断当前旧接口，仓库中原有的 `Transaction` 和 `Rule` 暂时保留，后续可以逐步迁移到新的 `TransactionRecord` 和 `RuleDefinition`。

## 使用说明

### 1. 初始化数据库

先在 MySQL 中执行：

```sql
source sql/finance_schema.sql;
```

或者直接把 `sql/finance_schema.sql` 导入 `finance_system` 数据库。

### 2. 修改数据库连接

当前项目数据库连接配置位于：

- `src/main/resources/application.yml`

请根据你的本机环境调整：

- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`

### 3. 编译项目

Windows 下可执行：

```powershell
mvn -DskipTests compile
```

或：

```powershell
.\mvnw.cmd -DskipTests compile
```

### 4. 后续开发建议

推荐按下面顺序继续实现：

1. 为新实体补 `Repository`
2. 实现家庭、账户、分类、交易、预算基础接口
3. 将旧版 `Transaction` / `Rule` 逻辑逐步迁移到新版实体
4. 接入账单导入、规则触发、消息中心

## 说明

`docs/database/finance_er_diagram.md` 内包含 Mermaid ER 图代码，可以直接复制到支持 Mermaid 的编辑器中渲染，用于论文截图或系统设计说明。
