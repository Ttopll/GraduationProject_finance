package com.example.finance.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class BillParseRuleApiModels {

    private BillParseRuleApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            @NotNull Long categoryId,
            @Size(max = 100) String merchantKeyword,
            @Size(max = 255) String regexPattern,
            Integer priority
    ) {
    }

    public record UpdateRequest(
            @NotNull Long categoryId,
            @Size(max = 100) String merchantKeyword,
            @Size(max = 255) String regexPattern,
            Integer priority
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long categoryId,
            String categoryName,
            String merchantKeyword,
            String regexPattern,
            Integer priority,
            Integer enabled,
            Integer hitCount,
            LocalDateTime lastHitAt
    ) {
    }
}
