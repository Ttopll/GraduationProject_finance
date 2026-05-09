package com.example.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public final class FixedAssetApiModels {

    private FixedAssetApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            Long ownerMemberId,
            @NotBlank @Size(max = 100) String assetName,
            @NotBlank @Size(max = 20) String assetType,
            @NotNull @DecimalMin(value = "0.01") BigDecimal purchaseAmount,
            LocalDate purchaseDate,
            @DecimalMin(value = "0.00") BigDecimal valuationAmount,
            LocalDate valuationDate,
            @Size(max = 255) String remark
    ) {
    }

    public record UpdateRequest(
            Long ownerMemberId,
            @NotBlank @Size(max = 100) String assetName,
            @NotBlank @Size(max = 20) String assetType,
            @NotNull @DecimalMin(value = "0.01") BigDecimal purchaseAmount,
            LocalDate purchaseDate,
            @DecimalMin(value = "0.00") BigDecimal valuationAmount,
            LocalDate valuationDate,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long ownerMemberId,
            String assetName,
            String assetType,
            BigDecimal purchaseAmount,
            LocalDate purchaseDate,
            BigDecimal valuationAmount,
            LocalDate valuationDate,
            BigDecimal effectiveValue,
            String remark,
            Integer status
    ) {
    }

    public record OverviewResponse(
            Long familyId,
            BigDecimal totalAccountBalance,
            BigDecimal totalFixedAssetValue,
            BigDecimal totalDebtBalance,
            BigDecimal totalAssetValue,
            BigDecimal netAssetValue,
            BigDecimal debtToAssetRatio,
            BigDecimal fixedAssetRatio,
            Integer dueDebtCount,
            Integer overdueDebtCount,
            String riskLevel,
            String riskConclusion,
            List<String> diagnosisSuggestions,
            Integer accountCount,
            Integer fixedAssetCount,
            Integer debtCount,
            List<AccountBalanceItem> accounts,
            List<FixedAssetValueItem> fixedAssets,
            List<DebtBalanceItem> debts
    ) {
    }

    public record AccountBalanceItem(
            Long accountId,
            String accountName,
            String accountType,
            BigDecimal currentBalance
    ) {
    }

    public record FixedAssetValueItem(
            Long assetId,
            String assetName,
            String assetType,
            BigDecimal purchaseAmount,
            BigDecimal valuationAmount,
            BigDecimal effectiveValue,
            LocalDate purchaseDate,
            LocalDate valuationDate
    ) {
    }

    public record DebtBalanceItem(
            Long debtId,
            String debtName,
            String debtType,
            BigDecimal currentBalance,
            LocalDate dueDate,
            String status
    ) {
    }
}
