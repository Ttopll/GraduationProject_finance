package com.example.finance.dto;

import java.math.BigDecimal;
import java.util.List;

public final class FinancialAnalysisApiModels {

    private FinancialAnalysisApiModels() {
    }

    public record DashboardResponse(
            String month,
            Overview overview,
            AssetSnapshot assetSnapshot,
            KeyIndicators keyIndicators,
            HealthScore healthScore,
            List<MonthlyTrendItem> monthlyTrend,
            List<ExpenseStructureItem> expenseStructure,
            List<BudgetProgressItem> budgetProgress
    ) {
    }

    public record Overview(
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal netCashFlow,
            BigDecimal savingsAmount,
            BigDecimal savingsRate,
            Integer incomeTransactionCount,
            Integer expenseTransactionCount
    ) {
    }

    public record AssetSnapshot(
            BigDecimal totalAccountBalance,
            BigDecimal totalFixedAssetValue,
            BigDecimal totalDebtBalance,
            BigDecimal totalAssetValue,
            BigDecimal netAssetValue
    ) {
    }

    public record KeyIndicators(
            BigDecimal engelCoefficient,
            BigDecimal debtToAssetRatio,
            BigDecimal liquidityCoverageMonths,
            String topExpenseCategory,
            BigDecimal topExpenseAmount,
            BigDecimal topExpenseRatio,
            Integer activeBudgetCount,
            Integer alertBudgetCount,
            Integer exceededBudgetCount
    ) {
    }

    public record HealthScore(
            Integer score,
            String level,
            String levelLabel,
            List<HealthScoreFactor> factors,
            List<String> improvementSuggestions
    ) {
    }

    public record HealthScoreFactor(
            String factorCode,
            String factorName,
            Integer factorScore,
            Integer maxScore,
            String conclusion
    ) {
    }

    public record MonthlyTrendItem(
            String month,
            BigDecimal income,
            BigDecimal expense,
            BigDecimal netAmount
    ) {
    }

    public record ExpenseStructureItem(
            Long categoryId,
            String categoryName,
            BigDecimal amount,
            BigDecimal ratio
    ) {
    }

    public record BudgetProgressItem(
            Long budgetId,
            String budgetName,
            Long categoryId,
            String categoryName,
            String month,
            BigDecimal budgetAmount,
            BigDecimal spentAmount,
            BigDecimal remainingAmount,
            BigDecimal usageRatio,
            Boolean alertTriggered,
            Boolean exceeded
    ) {
    }
}
