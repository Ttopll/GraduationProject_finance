package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class FamilyApiModels {

    private FamilyApiModels() {
    }

    public record CreateRequest(
            @NotBlank @Size(max = 100) String familyName,
            @NotNull Long ownerUserId,
            @Size(max = 10) String currencyCode,
            @Size(max = 50) String timezone,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            String familyName,
            Long ownerUserId,
            String inviteCode,
            String currencyCode,
            String timezone,
            Integer status,
            String remark
    ) {
    }
}
