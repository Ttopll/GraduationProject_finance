# 三端MVP验收报告生成脚本说明

文件：`scripts/generate_three_end_mvp_report.ps1`

## 作用

在执行联通自检后，自动生成一份中文 Markdown 验收报告，输出到 `docs/reports`。

## 用法

### 自动创建用户并生成报告（推荐）

```powershell
pwsh -File scripts/generate_three_end_mvp_report.ps1 -AutoCreateUser
```

### 使用已有用户并生成报告

```powershell
pwsh -File scripts/generate_three_end_mvp_report.ps1 -Username your_user -Password your_password
```

## 生成结果

- 输出目录：`docs/reports`
- 文件名格式：`三端联通验收报告_yyyyMMdd_HHmmss.md`
- 报告内容包含：
  1. 导入结果计数
  2. 三个分析接口结果摘要
  3. 自动结论
  4. 原始 JSON 回执
