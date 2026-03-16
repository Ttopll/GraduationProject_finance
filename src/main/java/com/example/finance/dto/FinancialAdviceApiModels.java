package com.example.finance.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class FinancialAdviceApiModels {

    private FinancialAdviceApiModels() {
    }

    public record Response(
            Long id,
            Long familyId,
            Long ruleId,
            String adviceType,
            String title,
            String content,
            String suggestionLevel,
            String snapshotJson,
            String status,
            LocalDateTime generatedAt
    ) {
    }

    public record GenerateResponse(
            String month,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal savingsAmount,
            BigDecimal savingsRate,
            BigDecimal totalAccountBalance,
            BigDecimal totalDebtBalance,
            Integer generatedCount,
            List<Response> advices
    ) {
    }
}
