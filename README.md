# Graduation Project Finance

鍩轰簬瑙勫垯寮曟搸鐨勫搴储鍔＄鐞嗙郴缁熷悗绔洀褰紝浣跨敤 `Spring Boot + Spring Data JPA + MySQL` 瀹炵幇銆?
褰撳墠浠撳簱宸茬粡琛ュ厖浜嗕袱閮ㄥ垎鍏抽敭鍐呭锛?
- 涓€濂楅潰鍚戞瘯涓氳璁″疄鐜扮殑鏁版嵁搴撹璁℃枃妗ｅ拰寤鸿〃 SQL
- 涓€缁勪笌鏁版嵁搴撹璁″搴旂殑 JPA 瀹炰綋绫伙紝渚夸簬鍚庣画缁х画琛?`repository / service / controller`

## 鐩綍璇存槑

- `sql/finance_schema.sql`
  鏁版嵁搴撳缓琛ㄨ剼鏈?- `docs/database/数据库结构设计说明.md`
  鏁版嵁搴撹〃缁撴瀯璁捐璇存槑
- `docs/database/数据库ER图说明.md`
  ER 鍥捐鏄庝笌 Mermaid 鍥句唬鐮?- `src/main/java/com/example/finance/entity`
  瀹炰綋绫荤洰褰?
## 宸茶ˉ鍏呯殑瀹炰綋

鐩墠宸叉柊澧炶繖浜涙牳蹇冨疄浣擄細

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

涓轰簡閬垮厤鐩存帴鎵撴柇褰撳墠鏃ф帴鍙ｏ紝浠撳簱涓師鏈夌殑 `Transaction` 鍜?`Rule` 鏆傛椂淇濈暀锛屽悗缁彲浠ラ€愭杩佺Щ鍒版柊鐨?`TransactionRecord` 鍜?`RuleDefinition`銆?
## 浣跨敤璇存槑

### 1. 鍒濆鍖栨暟鎹簱

鍏堝湪 MySQL 涓墽琛岋細

```sql
source sql/finance_schema.sql;
```

鎴栬€呯洿鎺ユ妸 `sql/finance_schema.sql` 瀵煎叆 `finance_system` 鏁版嵁搴撱€?
### 2. 淇敼鏁版嵁搴撹繛鎺?
褰撳墠椤圭洰鏁版嵁搴撹繛鎺ラ厤缃綅浜庯細

- `src/main/resources/application.yml`

璇锋牴鎹綘鐨勬湰鏈虹幆澧冭皟鏁达細

- `spring.datasource.url`
- `spring.datasource.username`
- `spring.datasource.password`

### 3. 缂栬瘧椤圭洰

Windows 涓嬪彲鎵ц锛?
```powershell
mvn -DskipTests compile
```

鎴栵細

```powershell
.\mvnw.cmd -DskipTests compile
```

### 4. 鍚庣画寮€鍙戝缓璁?
鎺ㄨ崘鎸変笅闈㈤『搴忕户缁疄鐜帮細

1. 涓烘柊瀹炰綋琛?`Repository`
2. 瀹炵幇瀹跺涵銆佽处鎴枫€佸垎绫汇€佷氦鏄撱€侀绠楀熀纭€鎺ュ彛
3. 灏嗘棫鐗?`Transaction` / `Rule` 閫昏緫閫愭杩佺Щ鍒版柊鐗堝疄浣?4. 鎺ュ叆璐﹀崟瀵煎叆銆佽鍒欒Е鍙戙€佹秷鎭腑蹇?
## 璇存槑

`docs/database/数据库ER图说明.md` 鍐呭寘鍚?Mermaid ER 鍥句唬鐮侊紝鍙互鐩存帴澶嶅埗鍒版敮鎸?Mermaid 鐨勭紪杈戝櫒涓覆鏌擄紝鐢ㄤ簬璁烘枃鎴浘鎴栫郴缁熻璁¤鏄庛€?
