package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;

public final class RuleDefinitionApiModels {

    private RuleDefinitionApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            Long categoryId,
            Long createdByMemberId,
            @NotBlank @Size(max = 100) String ruleName,
            @NotBlank @Size(max = 30) String ruleType,
            @NotBlank @Size(max = 30) String metricType,
            @NotBlank @Size(max = 20) String timeScope,
            @NotBlank @Size(max = 10) String operatorType,
            @NotNull @Positive BigDecimal thresholdValue,
            @Size(max = 1000) String thresholdJson,
            @NotBlank @Size(max = 20) String actionType,
            @NotBlank @Size(max = 255) String messageTemplate,
            Integer priority
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long categoryId,
            Long createdByMemberId,
            String ruleName,
            String ruleType,
            String metricType,
            String timeScope,
            String operatorType,
            BigDecimal thresholdValue,
            String thresholdJson,
            String actionType,
            String messageTemplate,
            Integer enabled,
            Integer priority
    ) {
    }

    public record EvaluateResponse(
            String month,
            Integer budgetAlertCount,
            Integer triggeredRuleCount,
            Integer generatedNotificationCount,
            List<String> details
    ) {
    }
}
