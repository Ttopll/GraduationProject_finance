package com.example.finance.dto;

import java.time.LocalDateTime;

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
}
