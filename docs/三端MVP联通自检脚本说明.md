# 三端MVP联通自检脚本说明

文件：`scripts/verify_three_end_mvp.ps1`

## 作用

一条命令完成以下联通检查：

1. 登录获取 JWT
2. 导入真实数据
3. 调用 `retail-overview`
4. 调用 `world-bank-trend`
5. 调用 `fred-series`
6. 输出可答辩结论（国家趋势 + 交易结构 + FRED状态）

## 用法

### 方式一：自动创建测试用户（推荐）

```powershell
pwsh -File scripts/verify_three_end_mvp.ps1 -AutoCreateUser
```

### 方式二：使用已有用户

```powershell
pwsh -File scripts/verify_three_end_mvp.ps1 -Username your_user -Password your_password
```

## 常用参数

- `-BaseUrl`：默认 `http://localhost:8088`
- `-ProcessedDir`：默认 `data/processed`
- `-TruncateBeforeImport`：默认 `true`
- `-BatchSize`：默认 `5000`
- `-CountryIso3`：默认 `CHN`
- `-FredSeriesId`：默认 `PCE`

## 成功判定

脚本返回 JSON，满足以下即通过：

1. `import` 返回导入计数。
2. `retailOverview.totalRecords > 0`
3. `worldBankTrend.pointCount > 0`
4. `fredSeries.pointCount >= 0`（为 0 允许，代表抓取软降级）
5. `conclusions` 数组有 3 条结论。
