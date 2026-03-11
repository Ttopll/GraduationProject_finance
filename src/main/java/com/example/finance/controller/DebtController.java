package com.example.finance.controller;

import com.example.finance.dto.DebtApiModels;
import com.example.finance.entity.Debt;
import com.example.finance.entity.DebtRepayment;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.DebtService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/debts")
public class DebtController {

    private final DebtService debtService;
    private final FamilyAccessService familyAccessService;

    public DebtController(DebtService debtService, FamilyAccessService familyAccessService) {
        this.debtService = debtService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DebtApiModels.Response create(@Valid @RequestBody DebtApiModels.CreateRequest request) {
        familyAccessService.requireFamilyRead(request.familyId());
        DebtApiModels.CreateRequest normalizedRequest = new DebtApiModels.CreateRequest(
                request.familyId(),
                familyAccessService.resolveManagedMemberId(request.familyId(), request.debtorMemberId(), true),
                request.debtName(),
                request.debtType(),
                request.lenderName(),
                request.principalAmount(),
                request.annualRate(),
                request.billingDay(),
                request.repaymentDay(),
                request.dueDate(),
                request.remark()
        );
        return toResponse(debtService.create(normalizedRequest));
    }

    @GetMapping
    public List<DebtApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return debtService.listByFamilyId(familyId).stream()
                .map(this::toResponse)
                .toList();
    }

    @PostMapping("/{debtId}/repayments")
    @ResponseStatus(HttpStatus.CREATED)
    public DebtApiModels.RepaymentResponse repay(
            @PathVariable Long debtId,
            @Valid @RequestBody DebtApiModels.RepaymentCreateRequest request
    ) {
        Debt debt = debtService.getDebt(debtId);
        familyAccessService.requireFamilyRead(debt.getFamilyId());
        DebtApiModels.RepaymentCreateRequest normalizedRequest = new DebtApiModels.RepaymentCreateRequest(
                debt.getFamilyId(),
                request.payAccountId(),
                familyAccessService.resolveActorMemberId(debt.getFamilyId(), request.createdByMemberId(), true),
                request.amount(),
                request.principalPaid(),
                request.interestPaid(),
                request.repaymentTime(),
                request.note()
        );
        return toRepaymentResponse(debtService.repay(debtId, normalizedRequest));
    }

    @GetMapping("/{debtId}/repayments")
    public List<DebtApiModels.RepaymentResponse> repaymentList(@PathVariable Long debtId) {
        familyAccessService.requireFamilyRead(debtService.getDebt(debtId).getFamilyId());
        return debtService.repaymentList(debtId).stream()
                .map(DebtController::toRepaymentResponse)
                .toList();
    }

    @PostMapping("/check-reminders")
    public DebtApiModels.ReminderCheckResponse checkReminders(
            @RequestParam Long familyId,
            @RequestParam(defaultValue = "7") Integer daysAhead
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        return debtService.checkReminders(familyId, daysAhead);
    }

    private DebtApiModels.Response toResponse(Debt debt) {
        LocalDate nextReminderDate = "ACTIVE".equals(debt.getStatus())
                ? debtService.resolveNextReminderDate(debt, LocalDate.now())
                : null;
        return new DebtApiModels.Response(
                debt.getId(),
                debt.getFamilyId(),
                debt.getDebtorMemberId(),
                debt.getDebtName(),
                debt.getDebtType(),
                debt.getLenderName(),
                debt.getPrincipalAmount(),
                debt.getCurrentBalance(),
                debt.getAnnualRate(),
                debt.getBillingDay(),
                debt.getRepaymentDay(),
                debt.getDueDate(),
                debt.getStatus(),
                debt.getRemark(),
                nextReminderDate
        );
    }

    private static DebtApiModels.RepaymentResponse toRepaymentResponse(DebtRepayment debtRepayment) {
        return new DebtApiModels.RepaymentResponse(
                debtRepayment.getId(),
                debtRepayment.getDebtId(),
                debtRepayment.getFamilyId(),
                debtRepayment.getPayAccountId(),
                debtRepayment.getCreatedByMemberId(),
                debtRepayment.getAmount(),
                debtRepayment.getPrincipalPaid(),
                debtRepayment.getInterestPaid(),
                debtRepayment.getRepaymentTime(),
                debtRepayment.getNote()
        );
    }
}
