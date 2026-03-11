package com.example.finance.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;

public final class BudgetApiModels {

    private BudgetApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            @NotNull Long categoryId,
            Long createdByMemberId,
            @NotBlank @Size(max = 100) String budgetName,
            @NotBlank @Size(max = 20) String periodType,
            @NotNull @Positive BigDecimal amount,
            @DecimalMin("0.00") @DecimalMax("1.00") BigDecimal alertRatio,
            @NotNull LocalDate startDate,
            LocalDate endDate,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long categoryId,
            Long createdByMemberId,
            String budgetName,
            String periodType,
            BigDecimal amount,
            BigDecimal alertRatio,
            LocalDate startDate,
            LocalDate endDate,
            Integer enabled,
            String remark
    ) {
    }

    public record UsageResponse(
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
