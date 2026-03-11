package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public final class AccountApiModels {

    private AccountApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            Long ownerMemberId,
            @NotBlank @Size(max = 50) String accountName,
            @NotBlank @Size(max = 20) String accountType,
            @Size(max = 100) String institutionName,
            @Size(max = 64) String accountNoMask,
            BigDecimal currentBalance,
            BigDecimal creditLimit,
            Integer billingDay,
            Integer repaymentDay,
            Integer isShared,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long ownerMemberId,
            String accountName,
            String accountType,
            String institutionName,
            String accountNoMask,
            BigDecimal currentBalance,
            BigDecimal creditLimit,
            Integer billingDay,
            Integer repaymentDay,
            Integer isShared,
            Integer status,
            String remark
    ) {
    }
}
