package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class CategoryApiModels {

    private CategoryApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            Long parentId,
            @NotBlank @Size(max = 50) String categoryName,
            @NotBlank @Size(max = 20) String categoryType,
            @Size(max = 20) String scopeType,
            @Size(max = 50) String iconCode,
            Integer sortOrder
    ) {
    }

    public record UpdateRequest(
            Long parentId,
            @NotBlank @Size(max = 50) String categoryName,
            @NotBlank @Size(max = 20) String categoryType,
            @Size(max = 20) String scopeType,
            @Size(max = 50) String iconCode,
            Integer sortOrder
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long parentId,
            String categoryName,
            String categoryType,
            String scopeType,
            String iconCode,
            Integer sortOrder,
            Integer enabled
    ) {
    }
}
