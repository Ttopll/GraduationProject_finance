# 家庭财务管理系统数据库表结构设计

## 1. 设计目标

这版表结构直接对齐你的开题报告，目标是支撑下面几类核心功能：

- 家庭单位、多成员、权限隔离
- 多账户收支记录
- 预算管理
- 债务管理与还款提醒
- 固定资产管理
- 支付宝/微信账单导入与商户归类
- 基于规则引擎的预警和理财建议
- 消息中心
- 数据导出与管理员配置

数据库建议使用 `MySQL 8.0`，字符集使用 `utf8mb4`。

## 2. 总体设计原则

- 以 `family_id` 作为家庭数据隔离的核心字段，业务数据基本都挂在家庭下面。
- 用户和家庭成员关系分离：`sys_user` 表示登录账号，`family_member` 表示账号在某个家庭中的身份。
- 账单导入、规则引擎、消息中心单独建表，方便后期扩展，不把所有功能硬塞到交易表。
- 预算、规则、理财建议尽量采用“配置表 + 运行结果表”的方式，便于管理员维护和论文描述。
- 所有核心业务表保留 `created_at`、`updated_at`，便于审计和后续接口开发。

## 3. 核心实体关系

主要关系如下：

- 一个 `sys_user` 可以加入多个 `family`
- 一个 `family` 有多个 `family_member`
- 一个 `family` 有多个 `account`
- 一个 `family` 有多个 `category`
- 一个 `account` 下有多条 `transaction_record`
- 一个 `family` 可以配置多条 `budget_plan`
- 一个 `family` 可以配置多条 `rule_definition`
- 一次 `bill_import_batch` 可以导入多条 `transaction_record`
- 一条 `rule_definition` 可以产出多条 `rule_execution_log`
- 一个 `family_member` 可以收到多条 `notification`

## 4. 表清单

### 4.1 用户与家庭

1. `sys_user`
- 用途：系统登录用户表
- 关键字段：`username`、`password_hash`、`phone`、`email`、`user_type`、`status`

2. `family`
- 用途：家庭单元主表
- 关键字段：`family_name`、`owner_user_id`、`invite_code`、`currency_code`

3. `family_member`
- 用途：家庭成员关系表
- 关键字段：`family_id`、`user_id`、`role_code`、`permission_json`、`status`
- 说明：`role_code` 建议取值 `OWNER / ADMIN / MEMBER / VIEWER`

### 4.2 基础数据

4. `category`
- 用途：收支分类表
- 关键字段：`family_id`、`category_name`、`category_type`、`parent_id`、`scope_type`
- 说明：支持系统预置分类和家庭自定义分类

5. `account`
- 用途：资金账户表
- 关键字段：`family_id`、`account_name`、`account_type`、`current_balance`
- 说明：支持现金、银行卡、信用卡、支付宝、微信等

### 4.3 收支与账单导入

6. `bill_import_batch`
- 用途：账单导入批次表
- 关键字段：`source_platform`、`original_file_name`、`file_hash`、`import_status`
- 说明：记录一次导入任务的整体情况

7. `bill_parse_rule`
- 用途：商户归类规则表
- 关键字段：`merchant_keyword`、`regex_pattern`、`category_id`、`priority`
- 说明：这是“账单智能解析”的关键表

8. `transaction_record`
- 用途：交易流水表
- 关键字段：`family_id`、`account_id`、`target_account_id`、`category_id`、`transaction_type`、`amount`、`transaction_time`
- 说明：支持收入、支出、转账三种类型

### 4.4 预算、债务、资产

9. `budget_plan`
- 用途：预算计划表
- 关键字段：`category_id`、`period_type`、`amount`、`alert_ratio`
- 说明：预算执行进度建议实时按流水统计，不必单独建预算明细表

10. `debt`
- 用途：债务主表
- 关键字段：`debt_type`、`principal_amount`、`current_balance`、`annual_rate`、`repayment_day`

11. `debt_repayment`
- 用途：债务还款记录表
- 关键字段：`debt_id`、`pay_account_id`、`amount`、`principal_paid`、`interest_paid`

12. `fixed_asset`
- 用途：固定资产表
- 关键字段：`asset_type`、`purchase_amount`、`purchase_date`
- 说明：当前只记录原始信息，是否估值可先不做自动化

### 4.5 规则引擎与消息

13. `rule_definition`
- 用途：规则定义表
- 关键字段：`rule_type`、`metric_type`、`operator_type`、`threshold_value`、`action_type`
- 说明：后端规则引擎应优先读取这个表，而不是把规则写死在代码里

14. `rule_execution_log`
- 用途：规则执行日志表
- 关键字段：`rule_id`、`result_status`、`metric_value`、`trigger_time`

15. `notification`
- 用途：消息中心表
- 关键字段：`target_member_id`、`source_type`、`level_code`、`read_status`

16. `family_financial_profile`
- 用途：家庭财务画像表
- 关键字段：`risk_preference`、`savings_target_rate`、`emergency_fund_months`
- 说明：为理财建议生成提供输入

17. `financial_advice`
- 用途：理财建议表
- 关键字段：`advice_type`、`title`、`content`、`suggestion_level`

18. `data_export_log`
- 用途：数据导出记录表
- 关键字段：`export_type`、`file_format`、`status`

## 5. 第一版开发建议优先级

如果你要尽快把后端做成“能演示”的版本，建议先实现这 10 张表：

1. `sys_user`
2. `family`
3. `family_member`
4. `category`
5. `account`
6. `transaction_record`
7. `budget_plan`
8. `debt`
9. `rule_definition`
10. `notification`

账单导入相关的 `bill_import_batch`、`bill_parse_rule` 可以作为第二阶段；`fixed_asset`、`financial_advice`、`data_export_log` 可以作为第三阶段。

## 6. 对你当前项目的改造建议

你现在后端里已有的 `Transaction` 和 `Rule` 结构太薄，后续建议这样改：

- 现有 `transaction` 表建议改名为 `transaction_record`
- `Transaction` 实体至少补上 `family_id`、`account_id`、`category_id`、`target_account_id`、`merchant_name`、`source_platform`
- 现有 `Rule` 实体建议升级为 `rule_definition`
- `CsvParserUtil` 不应直接写死解析逻辑，后面应接入 `bill_parse_rule`
- 当前业务表都没有家庭隔离字段，后面必须补上 `family_id`

## 7. 文件说明

配套 SQL 文件已输出为：

- `finance_schema.sql`

这份 SQL 是“毕业设计可落地版本”，可以直接作为你后面数据库建模、论文数据库设计章节、后端实体改造的基础。
