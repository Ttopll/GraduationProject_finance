package com.example.finance.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public final class FamilyFinancialProfileApiModels {

    private FamilyFinancialProfileApiModels() {
    }

    public record SaveRequest(
            @NotNull Long familyId,
            @Size(max = 20) String riskPreference,
            @DecimalMin(value = "0.00") @DecimalMax(value = "1.00") BigDecimal savingsTargetRate,
            @Positive Integer emergencyFundMonths,
            String investmentPreferenceJson
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            String riskPreference,
            BigDecimal savingsTargetRate,
            Integer emergencyFundMonths,
            String investmentPreferenceJson
    ) {
    }
}
