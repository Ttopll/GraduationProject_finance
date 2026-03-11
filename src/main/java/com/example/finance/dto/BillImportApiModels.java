package com.example.finance.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public final class BillImportApiModels {

    private BillImportApiModels() {
    }

    public record BatchResponse(
            Long id,
            Long familyId,
            Long uploadedByMemberId,
            String sourcePlatform,
            String originalFileName,
            String fileHash,
            Integer totalCount,
            Integer successCount,
            Integer failCount,
            String importStatus,
            String errorSummary,
            LocalDateTime importedAt,
            Integer unmatchedCount
    ) {
    }

    public record UploadResponse(
            BatchResponse batch,
            Integer importedCount,
            Integer failedCount,
            Integer unmatchedCount,
            List<String> warnings
    ) {
    }

    public record PendingItemResponse(
            Long id,
            Long familyId,
            Long sourceBatchId,
            Long transactionRecordId,
            String sourcePlatform,
            String externalTradeNo,
            String merchantName,
            String rawCategoryName,
            String transactionType,
            BigDecimal amount,
            LocalDateTime transactionTime,
            String note,
            String rawLine,
            String status,
            Long resolvedCategoryId,
            String resolvedCategoryName,
            Long resolvedByMemberId,
            LocalDateTime resolvedAt,
            LocalDateTime createdAt
    ) {
    }

    public record ResolvePendingRequest(
            @NotNull Long categoryId,
            Long resolvedByMemberId,
            Boolean createParseRule,
            Integer priority
    ) {
    }
}
