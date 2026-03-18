package com.example.finance.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

public final class DebtApiModels {

    private DebtApiModels() {
    }

    public record CreateRequest(
            @NotNull Long familyId,
            Long debtorMemberId,
            @NotBlank @Size(max = 100) String debtName,
            @NotBlank @Size(max = 20) String debtType,
            @Size(max = 100) String lenderName,
            @NotNull @Positive BigDecimal principalAmount,
            @DecimalMin("0.00") BigDecimal annualRate,
            Integer billingDay,
            Integer repaymentDay,
            LocalDate dueDate,
            @Size(max = 255) String remark
    ) {
    }

    public record UpdateRequest(
            Long debtorMemberId,
            @NotBlank @Size(max = 100) String debtName,
            @NotBlank @Size(max = 20) String debtType,
            @Size(max = 100) String lenderName,
            @NotNull @Positive BigDecimal principalAmount,
            @DecimalMin("0.00") BigDecimal annualRate,
            Integer billingDay,
            Integer repaymentDay,
            LocalDate dueDate,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            Long familyId,
            Long debtorMemberId,
            String debtName,
            String debtType,
            String lenderName,
            BigDecimal principalAmount,
            BigDecimal currentBalance,
            BigDecimal annualRate,
            Integer billingDay,
            Integer repaymentDay,
            LocalDate dueDate,
            String status,
            String remark,
            LocalDate nextReminderDate
    ) {
    }

    public record RepaymentCreateRequest(
            @NotNull Long familyId,
            Long payAccountId,
            Long createdByMemberId,
            @NotNull @Positive BigDecimal amount,
            BigDecimal principalPaid,
            BigDecimal interestPaid,
            LocalDateTime repaymentTime,
            @Size(max = 255) String note
    ) {
    }

    public record RepaymentResponse(
            Long id,
            Long debtId,
            Long familyId,
            Long payAccountId,
            Long createdByMemberId,
            BigDecimal amount,
            BigDecimal principalPaid,
            BigDecimal interestPaid,
            LocalDateTime repaymentTime,
            String note
    ) {
    }

    public record ReminderCheckResponse(
            LocalDate baseDate,
            Integer daysAhead,
            Integer reminderCount,
            List<String> details
    ) {
    }
}
