package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class TransactionRecordApiModels {

    private TransactionRecordApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            @NotNull Long accountId,
            Long targetAccountId,
            Long categoryId,
            Long createdByMemberId,
            Long sourceBatchId,
            @NotBlank @Size(max = 20) String transactionType,
            @NotNull @Positive BigDecimal amount,
            LocalDateTime transactionTime,
            @Size(max = 100) String merchantName,
            @Size(max = 100) String counterpartyName,
            @Size(max = 20) String sourcePlatform,
            @Size(max = 64) String externalTradeNo,
            @Size(max = 255) String note
    ) {
    }

    public record UpdateRequest(
            @NotNull Long accountId,
            Long targetAccountId,
            Long categoryId,
            Long createdByMemberId,
            @NotBlank @Size(max = 20) String transactionType,
            @NotNull @Positive BigDecimal amount,
            @NotNull LocalDateTime transactionTime,
            @Size(max = 100) String merchantName,
            @Size(max = 100) String counterpartyName,
            @Size(max = 20) String sourcePlatform,
            @Size(max = 64) String externalTradeNo,
            @Size(max = 255) String note
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long accountId,
            Long targetAccountId,
            Long categoryId,
            Long createdByMemberId,
            Long sourceBatchId,
            String transactionType,
            BigDecimal amount,
            LocalDateTime transactionTime,
            String merchantName,
            String counterpartyName,
            String sourcePlatform,
            String externalTradeNo,
            String note,
            Integer status
    ) {
    }

    public record MonthlySummaryResponse(
            String month,
            BigDecimal income,
            BigDecimal expense,
            BigDecimal netAmount
    ) {
    }

    public record SearchPageResponse(
            List<Response> items,
            Integer page,
            Integer size,
            Long totalElements,
            Integer totalPages
    ) {
    }
}
