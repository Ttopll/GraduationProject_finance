package com.example.finance.dto;

import java.time.LocalDateTime;

public final class DataExportApiModels {

    private DataExportApiModels() {
    }

    public record Response(
            Long id,
            Long familyId,
            Long requestedByMemberId,
            String exportType,
            String fileFormat,
            String filePath,
            String fileName,
            String status,
            LocalDateTime completedAt,
            LocalDateTime createdAt
    ) {
    }

    public record ExportResponse(
            Response exportLog,
            Integer rowCount
    ) {
    }
}
