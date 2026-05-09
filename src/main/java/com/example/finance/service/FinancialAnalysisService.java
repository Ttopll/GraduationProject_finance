package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.FinancialAnalysisApiModels;
import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.util.PeriodRangeUtil;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class FinancialAnalysisService {

    private static final String INCOME = "INCOME";
    private static final String EXPENSE = "EXPENSE";
    private static final String UNCATEGORIZED = "未分类";
    private static final int DEFAULT_TREND_MONTHS = 6;
    private static final int MAX_TREND_MONTHS = 24;
    private static final int RATIO_SCALE = 4;
    private static final BigDecimal ZERO_POINT_ONE = new BigDecimal("0.10");
    private static final BigDecimal ZERO_POINT_TWO = new BigDecimal("0.20");
    private static final BigDecimal ZERO_POINT_THREE = new BigDecimal("0.30");
    private static final BigDecimal ZERO_POINT_FIVE = new BigDecimal("0.50");
    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final Set<String> FOOD_CATEGORY_KEYWORDS = Set.of(
            "餐", "饮", "食", "饭", "food", "meal", "grocery", "grocer", "dining", "breakfast", "lunch", "dinner"
    );

    private final TransactionRecordRepository transactionRecordRepository;
    private final CategoryRepository categoryRepository;
    private final BudgetService budgetService;
    private final FixedAssetService fixedAssetService;
    private final FamilyService familyService;

    public FinancialAnalysisService(
            TransactionRecordRepository transactionRecordRepository,
            CategoryRepository categoryRepository,
            BudgetService budgetService,
            FixedAssetService fixedAssetService,
            FamilyService familyService
    ) {
        this.transactionRecordRepository = transactionRecordRepository;
        this.categoryRepository = categoryRepository;
        this.budgetService = budgetService;
        this.fixedAssetService = fixedAssetService;
        this.familyService = familyService;
    }

    public FinancialAnalysisApiModels.DashboardResponse getDashboard(Long familyId, String monthText, Integer trendMonths) {
        familyService.getById(familyId);

        YearMonth month = PeriodRangeUtil.resolveMonth(monthText);
        LocalDateTime[] monthRange = PeriodRangeUtil.monthRange(month);
        List<TransactionRecord> monthRecords = transactionRecordRepository
                .findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(familyId, monthRange[0], monthRange[1]);

        FinancialAnalysisApiModels.Overview overview = buildOverview(monthRecords);
        List<FinancialAnalysisApiModels.ExpenseStructureItem> expenseStructure = buildExpenseStructure(
                familyId,
                monthRecords,
                overview.totalExpense()
        );
        FixedAssetApiModels.OverviewResponse assetOverview = fixedAssetService.getOverview(familyId);
        FinancialAnalysisApiModels.AssetSnapshot assetSnapshot = new FinancialAnalysisApiModels.AssetSnapshot(
                assetOverview.totalAccountBalance(),
                assetOverview.totalFixedAssetValue(),
                assetOverview.totalDebtBalance(),
                assetOverview.totalAssetValue(),
                assetOverview.netAssetValue()
        );

        List<BudgetApiModels.UsageResponse> budgetUsage = budgetService.getUsage(familyId, month.toString());

        FinancialAnalysisApiModels.KeyIndicators keyIndicators = buildKeyIndicators(overview, assetSnapshot, expenseStructure, budgetUsage);

        FinancialAnalysisApiModels.HealthScore healthScore = buildHealthScore(overview, keyIndicators);
        List<FinancialAnalysisApiModels.BudgetProgressItem> budgetProgress = budgetUsage.stream()
                .map(this::toBudgetProgressItem)
                .toList();

        return new FinancialAnalysisApiModels.DashboardResponse(
                month.toString(),
                overview,
                assetSnapshot,
                keyIndicators,
                healthScore,
                buildMonthlyReport(month, overview, assetSnapshot, keyIndicators, healthScore, budgetProgress, expenseStructure),
                buildMonthlyTrend(familyId, month, trendMonths),
                expenseStructure,
                budgetProgress
        );
    }

    private FinancialAnalysisApiModels.MonthlyReport buildMonthlyReport(
            YearMonth month,
            FinancialAnalysisApiModels.Overview overview,
            FinancialAnalysisApiModels.AssetSnapshot assetSnapshot,
            FinancialAnalysisApiModels.KeyIndicators keyIndicators,
            FinancialAnalysisApiModels.HealthScore healthScore,
            List<FinancialAnalysisApiModels.BudgetProgressItem> budgetProgress,
            List<FinancialAnalysisApiModels.ExpenseStructureItem> expenseStructure
    ) {
        List<String> actionItems = new ArrayList<>();
        String cashFlowConclusion = overview.netCashFlow().compareTo(BigDecimal.ZERO) >= 0
                ? String.format(
                Locale.ROOT,
                "本月收入 %.2f，支出 %.2f，现金流为正，结余率为 %s。",
                overview.totalIncome(),
                overview.totalExpense(),
                percentText(overview.savingsRate())
        )
                : String.format(
                Locale.ROOT,
                "本月支出 %.2f 高于收入 %.2f，现金流为负，需要优先控制支出。",
                overview.totalExpense(),
                overview.totalIncome()
        );
        if (overview.netCashFlow().compareTo(BigDecimal.ZERO) < 0 || scoreSavingsRate(overview.savingsRate()) < 20) {
            actionItems.add("优先复盘本月大额支出，并设置固定储蓄比例。");
        }

        String budgetConclusion;
        if (keyIndicators.exceededBudgetCount() != null && keyIndicators.exceededBudgetCount() > 0) {
            budgetConclusion = String.format(
                    Locale.ROOT,
                    "本月共有 %d 项预算超支，%d 项预算触发预警，预算执行需要重点处理。",
                    keyIndicators.exceededBudgetCount(),
                    keyIndicators.alertBudgetCount()
            );
            actionItems.add("查看超支预算对应分类，减少非必要消费或调整预算额度。");
        } else if (keyIndicators.alertBudgetCount() != null && keyIndicators.alertBudgetCount() > 0) {
            budgetConclusion = String.format(
                    Locale.ROOT,
                    "本月有 %d 项预算接近上限，整体尚未超支，但需要持续观察。",
                    keyIndicators.alertBudgetCount()
            );
            actionItems.add("对预警预算设置消费提醒，避免月底集中超支。");
        } else if (budgetProgress.isEmpty()) {
            budgetConclusion = "本月尚未配置预算，无法形成预算执行评价。";
            actionItems.add("为餐饮、交通、购物等主要支出分类补充月度预算。");
        } else {
            budgetConclusion = "本月预算执行稳定，暂未发现超支或明显预警。";
        }

        String expenseConclusion = expenseStructure.isEmpty()
                ? "本月暂无可分析的支出分类数据。"
                : String.format(
                Locale.ROOT,
                "本月最大支出分类为%s，金额 %.2f，占总支出 %s。",
                keyIndicators.topExpenseCategory(),
                keyIndicators.topExpenseAmount(),
                percentText(keyIndicators.topExpenseRatio())
        );
        if (keyIndicators.topExpenseRatio() != null && keyIndicators.topExpenseRatio().compareTo(ZERO_POINT_FIVE) > 0) {
            actionItems.add("最大支出分类占比超过 50%，建议拆分明细并判断是否可压缩。");
        }

        String assetDebtConclusion = String.format(
                Locale.ROOT,
                "当前总资产 %.2f，负债 %.2f，净资产 %.2f，负债率为 %s。",
                assetSnapshot.totalAssetValue(),
                assetSnapshot.totalDebtBalance(),
                assetSnapshot.netAssetValue(),
                percentText(keyIndicators.debtToAssetRatio())
        );
        if (keyIndicators.debtToAssetRatio() != null && keyIndicators.debtToAssetRatio().compareTo(ZERO_POINT_FIVE) > 0) {
            actionItems.add("负债率偏高，优先偿还高利率或短期债务。");
        }
        if (keyIndicators.liquidityCoverageMonths() != null && keyIndicators.liquidityCoverageMonths().compareTo(new BigDecimal("3")) < 0) {
            actionItems.add("流动资金覆盖不足 3 个月支出，建议优先补足应急资金。");
        }

        String adviceConclusion = String.format(
                Locale.ROOT,
                "财务健康评分为 %d 分，评级为%s，建议优先改善评分较低的指标。",
                healthScore.score(),
                healthScore.levelLabel()
        );
        actionItems.addAll(healthScore.improvementSuggestions());

        List<String> distinctActionItems = actionItems.stream()
                .distinct()
                .limit(6)
                .toList();

        String overallConclusion = resolveMonthlyOverallConclusion(healthScore, overview);
        return new FinancialAnalysisApiModels.MonthlyReport(
                month + " 家庭财务月报",
                overallConclusion,
                cashFlowConclusion,
                budgetConclusion,
                expenseConclusion,
                assetDebtConclusion,
                adviceConclusion,
                distinctActionItems
        );
    }

    private FinancialAnalysisApiModels.Overview buildOverview(List<TransactionRecord> records) {
        BigDecimal totalIncome = BigDecimal.ZERO;
        BigDecimal totalExpense = BigDecimal.ZERO;
        int incomeCount = 0;
        int expenseCount = 0;

        for (TransactionRecord record : records) {
            if (INCOME.equals(record.getTransactionType())) {
                totalIncome = totalIncome.add(defaultAmount(record.getAmount()));
                incomeCount++;
            } else if (EXPENSE.equals(record.getTransactionType())) {
                totalExpense = totalExpense.add(defaultAmount(record.getAmount()));
                expenseCount++;
            }
        }

        BigDecimal netCashFlow = totalIncome.subtract(totalExpense);
        BigDecimal savingsRate = totalIncome.compareTo(BigDecimal.ZERO) > 0
                ? safeDivide(netCashFlow, totalIncome)
                : null;
        return new FinancialAnalysisApiModels.Overview(
                totalIncome,
                totalExpense,
                netCashFlow,
                netCashFlow,
                savingsRate,
                incomeCount,
                expenseCount
        );
    }

    private FinancialAnalysisApiModels.HealthScore buildHealthScore(
            FinancialAnalysisApiModels.Overview overview,
            FinancialAnalysisApiModels.KeyIndicators keyIndicators
    ) {
        List<FinancialAnalysisApiModels.HealthScoreFactor> factors = new ArrayList<>();
        List<String> suggestions = new ArrayList<>();

        int savingsScore = scoreSavingsRate(overview.savingsRate());
        factors.add(new FinancialAnalysisApiModels.HealthScoreFactor(
                "SAVINGS_RATE",
                "储蓄率",
                savingsScore,
                25,
                savingsScore >= 20 ? "结余能力较好" : "结余能力仍需提升"
        ));
        if (savingsScore < 20) {
            suggestions.add("提高固定储蓄比例，优先压缩弹性消费。");
        }

        int debtScore = scoreDebtRatio(keyIndicators.debtToAssetRatio());
        factors.add(new FinancialAnalysisApiModels.HealthScoreFactor(
                "DEBT_RATIO",
                "负债率",
                debtScore,
                20,
                debtScore >= 16 ? "负债水平可控" : "负债压力偏高"
        ));
        if (debtScore < 16) {
            suggestions.add("优先偿还高利率债务，避免继续扩大分期和借款。");
        }

        int liquidityScore = scoreLiquidity(keyIndicators.liquidityCoverageMonths());
        factors.add(new FinancialAnalysisApiModels.HealthScoreFactor(
                "LIQUIDITY",
                "应急资金覆盖",
                liquidityScore,
                20,
                liquidityScore >= 16 ? "流动资金较安全" : "应急资金覆盖不足"
        ));
        if (liquidityScore < 16) {
            suggestions.add("将至少 3 个月支出作为应急资金目标。");
        }

        int budgetScore = scoreBudgetRisk(keyIndicators.alertBudgetCount(), keyIndicators.exceededBudgetCount());
        factors.add(new FinancialAnalysisApiModels.HealthScoreFactor(
                "BUDGET_RISK",
                "预算执行",
                budgetScore,
                20,
                budgetScore >= 16 ? "预算执行稳定" : "预算存在预警或超支"
        ));
        if (budgetScore < 16) {
            suggestions.add("复盘超支分类，调整预算或减少对应支出。");
        }

        int concentrationScore = scoreExpenseConcentration(keyIndicators.topExpenseRatio());
        factors.add(new FinancialAnalysisApiModels.HealthScoreFactor(
                "EXPENSE_STRUCTURE",
                "消费结构",
                concentrationScore,
                15,
                concentrationScore >= 12 ? "支出结构较均衡" : "支出集中度偏高"
        ));
        if (concentrationScore < 12) {
            suggestions.add("检查最大支出分类，判断是否存在可压缩空间。");
        }

        int totalScore = factors.stream()
                .mapToInt(FinancialAnalysisApiModels.HealthScoreFactor::factorScore)
                .sum();
        String level = resolveHealthLevel(totalScore);
        if (suggestions.isEmpty()) {
            suggestions.add("当前财务状态较稳定，可继续保持预算复盘和定期储蓄。");
        }
        return new FinancialAnalysisApiModels.HealthScore(
                totalScore,
                level,
                resolveHealthLevelLabel(level),
                factors,
                suggestions
        );
    }

    private int scoreSavingsRate(BigDecimal savingsRate) {
        if (savingsRate == null) {
            return 8;
        }
        if (savingsRate.compareTo(ZERO_POINT_TWO) >= 0) {
            return 25;
        }
        if (savingsRate.compareTo(ZERO_POINT_ONE) >= 0) {
            return 18;
        }
        if (savingsRate.compareTo(BigDecimal.ZERO) >= 0) {
            return 12;
        }
        return 4;
    }

    private int scoreDebtRatio(BigDecimal debtToAssetRatio) {
        if (debtToAssetRatio == null || debtToAssetRatio.compareTo(BigDecimal.ZERO) == 0) {
            return 20;
        }
        if (debtToAssetRatio.compareTo(ZERO_POINT_THREE) <= 0) {
            return 18;
        }
        if (debtToAssetRatio.compareTo(ZERO_POINT_FIVE) <= 0) {
            return 12;
        }
        return 6;
    }

    private int scoreLiquidity(BigDecimal liquidityCoverageMonths) {
        if (liquidityCoverageMonths == null) {
            return 8;
        }
        if (liquidityCoverageMonths.compareTo(new BigDecimal("6")) >= 0) {
            return 20;
        }
        if (liquidityCoverageMonths.compareTo(new BigDecimal("3")) >= 0) {
            return 16;
        }
        if (liquidityCoverageMonths.compareTo(BigDecimal.ONE) >= 0) {
            return 10;
        }
        return 4;
    }

    private int scoreBudgetRisk(Integer alertBudgetCount, Integer exceededBudgetCount) {
        int alerts = alertBudgetCount == null ? 0 : alertBudgetCount;
        int exceeded = exceededBudgetCount == null ? 0 : exceededBudgetCount;
        if (exceeded > 0) {
            return 6;
        }
        if (alerts > 2) {
            return 10;
        }
        if (alerts > 0) {
            return 15;
        }
        return 20;
    }

    private int scoreExpenseConcentration(BigDecimal topExpenseRatio) {
        if (topExpenseRatio == null) {
            return 10;
        }
        if (topExpenseRatio.compareTo(ZERO_POINT_THREE) <= 0) {
            return 15;
        }
        if (topExpenseRatio.compareTo(ZERO_POINT_FIVE) <= 0) {
            return 10;
        }
        return 5;
    }

    private String resolveHealthLevel(int score) {
        if (score >= 85) {
            return "EXCELLENT";
        }
        if (score >= 70) {
            return "GOOD";
        }
        if (score >= 55) {
            return "WATCH";
        }
        return "RISK";
    }

    private String resolveHealthLevelLabel(String level) {
        return switch (level) {
            case "EXCELLENT" -> "健康";
            case "GOOD" -> "良好";
            case "WATCH" -> "关注";
            default -> "风险";
        };
    }

    private String resolveMonthlyOverallConclusion(
            FinancialAnalysisApiModels.HealthScore healthScore,
            FinancialAnalysisApiModels.Overview overview
    ) {
        if (healthScore.score() >= 85 && overview.netCashFlow().compareTo(BigDecimal.ZERO) >= 0) {
            return "本月家庭财务状态健康，收支结余、预算执行和资产负债结构整体表现较好。";
        }
        if (healthScore.score() >= 70) {
            return "本月家庭财务状态整体良好，但仍需要关注预算执行和消费结构变化。";
        }
        if (healthScore.score() >= 55) {
            return "本月家庭财务状态需要关注，建议优先处理结余、预算或负债方面的短板。";
        }
        return "本月家庭财务风险较高，需要优先控制支出、偿还债务并补足应急资金。";
    }

    private List<FinancialAnalysisApiModels.MonthlyTrendItem> buildMonthlyTrend(
            Long familyId,
            YearMonth endMonth,
            Integer trendMonths
    ) {
        int safeTrendMonths = (trendMonths == null || trendMonths < 1)
                ? DEFAULT_TREND_MONTHS
                : Math.min(trendMonths, MAX_TREND_MONTHS);

        YearMonth startMonth = endMonth.minusMonths(safeTrendMonths - 1L);
        LocalDateTime start = startMonth.atDay(1).atStartOfDay();
        LocalDateTime end = PeriodRangeUtil.monthRange(endMonth)[1];

        List<TransactionRecord> trendRecords = transactionRecordRepository
                .findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(familyId, start, end);

        Map<YearMonth, TrendBucket> trendMap = new LinkedHashMap<>();
        YearMonth cursor = startMonth;
        while (!cursor.isAfter(endMonth)) {
            trendMap.put(cursor, new TrendBucket());
            cursor = cursor.plusMonths(1);
        }

        for (TransactionRecord record : trendRecords) {
            YearMonth month = YearMonth.from(record.getTransactionTime());
            TrendBucket bucket = trendMap.get(month);
            if (bucket == null) {
                continue;
            }
            if (INCOME.equals(record.getTransactionType())) {
                bucket.income = bucket.income.add(defaultAmount(record.getAmount()));
            } else if (EXPENSE.equals(record.getTransactionType())) {
                bucket.expense = bucket.expense.add(defaultAmount(record.getAmount()));
            }
        }

        List<FinancialAnalysisApiModels.MonthlyTrendItem> result = new ArrayList<>();
        for (Map.Entry<YearMonth, TrendBucket> entry : trendMap.entrySet()) {
            TrendBucket bucket = entry.getValue();
            result.add(new FinancialAnalysisApiModels.MonthlyTrendItem(
                    entry.getKey().format(MONTH_FORMATTER),
                    bucket.income,
                    bucket.expense,
                    bucket.income.subtract(bucket.expense)
            ));
        }
        return result;
    }

    private List<FinancialAnalysisApiModels.ExpenseStructureItem> buildExpenseStructure(
            Long familyId,
            List<TransactionRecord> records,
            BigDecimal totalExpense
    ) {
        if (totalExpense.compareTo(BigDecimal.ZERO) <= 0) {
            return List.of();
        }

        Map<Long, String> categoryNameMap = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            categoryNameMap.put(category.getId(), category.getCategoryName());
        }

        Map<Long, BigDecimal> expenseByCategory = new HashMap<>();
        for (TransactionRecord record : records) {
            if (!EXPENSE.equals(record.getTransactionType())) {
                continue;
            }
            expenseByCategory.merge(record.getCategoryId(), defaultAmount(record.getAmount()), BigDecimal::add);
        }

        return expenseByCategory.entrySet().stream()
                .map(entry -> new FinancialAnalysisApiModels.ExpenseStructureItem(
                        entry.getKey(),
                        resolveCategoryName(categoryNameMap, entry.getKey()),
                        entry.getValue(),
                        safeDivide(entry.getValue(), totalExpense)
                ))
                .sorted((left, right) -> {
                    int amountCompare = right.amount().compareTo(left.amount());
                    if (amountCompare != 0) {
                        return amountCompare;
                    }
                    return left.categoryName().compareTo(right.categoryName());
                })
                .toList();
    }

    private FinancialAnalysisApiModels.KeyIndicators buildKeyIndicators(
            FinancialAnalysisApiModels.Overview overview,
            FinancialAnalysisApiModels.AssetSnapshot assetSnapshot,
            List<FinancialAnalysisApiModels.ExpenseStructureItem> expenseStructure,
            List<BudgetApiModels.UsageResponse> budgetUsage
    ) {
        FinancialAnalysisApiModels.ExpenseStructureItem topExpense = expenseStructure.isEmpty() ? null : expenseStructure.get(0);
        long alertBudgetCount = budgetUsage.stream().filter(usage -> Boolean.TRUE.equals(usage.alertTriggered())).count();
        long exceededBudgetCount = budgetUsage.stream().filter(usage -> Boolean.TRUE.equals(usage.exceeded())).count();

        BigDecimal foodExpense = expenseStructure.stream()
                .filter(item -> isFoodLikeCategory(item.categoryName()))
                .map(FinancialAnalysisApiModels.ExpenseStructureItem::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal engelCoefficient = overview.totalExpense().compareTo(BigDecimal.ZERO) > 0
                && foodExpense.compareTo(BigDecimal.ZERO) > 0
                ? safeDivide(foodExpense, overview.totalExpense())
                : null;
        BigDecimal debtToAssetRatio = assetSnapshot.totalAssetValue().compareTo(BigDecimal.ZERO) > 0
                ? safeDivide(assetSnapshot.totalDebtBalance(), assetSnapshot.totalAssetValue())
                : null;
        BigDecimal liquidityCoverageMonths = overview.totalExpense().compareTo(BigDecimal.ZERO) > 0
                ? safeDivide(assetSnapshot.totalAccountBalance(), overview.totalExpense())
                : null;

        return new FinancialAnalysisApiModels.KeyIndicators(
                engelCoefficient,
                debtToAssetRatio,
                liquidityCoverageMonths,
                topExpense == null ? null : topExpense.categoryName(),
                topExpense == null ? null : topExpense.amount(),
                topExpense == null ? null : topExpense.ratio(),
                budgetUsage.size(),
                Math.toIntExact(alertBudgetCount),
                Math.toIntExact(exceededBudgetCount)
        );
    }

    private FinancialAnalysisApiModels.BudgetProgressItem toBudgetProgressItem(BudgetApiModels.UsageResponse usage) {
        return new FinancialAnalysisApiModels.BudgetProgressItem(
                usage.budgetId(),
                usage.budgetName(),
                usage.categoryId(),
                usage.categoryName(),
                usage.month(),
                usage.budgetAmount(),
                usage.spentAmount(),
                usage.remainingAmount(),
                usage.usageRatio(),
                usage.alertTriggered(),
                usage.exceeded()
        );
    }

    private boolean isFoodLikeCategory(String categoryName) {
        if (categoryName == null) {
            return false;
        }
        String normalized = categoryName.trim().toLowerCase(Locale.ROOT);
        for (String keyword : FOOD_CATEGORY_KEYWORDS) {
            if (normalized.contains(keyword.toLowerCase(Locale.ROOT))) {
                return true;
            }
        }
        return false;
    }

    private String resolveCategoryName(Map<Long, String> categoryNameMap, Long categoryId) {
        if (categoryId == null) {
            return UNCATEGORIZED;
        }
        return categoryNameMap.getOrDefault(categoryId, UNCATEGORIZED);
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal safeDivide(BigDecimal dividend, BigDecimal divisor) {
        return dividend.divide(divisor, RATIO_SCALE, RoundingMode.HALF_UP);
    }

    private String percentText(BigDecimal value) {
        if (value == null) {
            return "暂无";
        }
        return value.multiply(new BigDecimal("100")).setScale(1, RoundingMode.HALF_UP) + "%";
    }

    private static class TrendBucket {
        private BigDecimal income = BigDecimal.ZERO;
        private BigDecimal expense = BigDecimal.ZERO;
    }
}
