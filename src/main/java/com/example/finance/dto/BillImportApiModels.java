package com.example.finance.dto;

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
}
