package com.example.finance.dto;

import java.time.LocalDateTime;
import java.util.List;

public final class NotificationApiModels {

    private NotificationApiModels() {
    }

    public record Response(
            Long id,
            Long familyId,
            Long targetMemberId,
            String sourceType,
            Long sourceId,
            String title,
            String content,
            String levelCode,
            Integer readStatus,
            LocalDateTime sentAt,
            LocalDateTime createdAt
    ) {
    }

    public record BulkActionResponse(
            Integer affectedCount
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
