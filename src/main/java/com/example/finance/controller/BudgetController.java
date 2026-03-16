package com.example.finance.controller;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.entity.BudgetPlan;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.BudgetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/budgets")
public class BudgetController {

    private final BudgetService budgetService;
    private final FamilyAccessService familyAccessService;

    public BudgetController(BudgetService budgetService, FamilyAccessService familyAccessService) {
        this.budgetService = budgetService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BudgetApiModels.Response create(@Valid @RequestBody BudgetApiModels.CreateRequest request) {
        familyAccessService.requireFamilyRead(request.familyId());
        BudgetApiModels.CreateRequest normalizedRequest = new BudgetApiModels.CreateRequest(
                request.familyId(),
                request.categoryId(),
                familyAccessService.resolveActorMemberId(request.familyId(), request.createdByMemberId(), true),
                request.budgetName(),
                request.periodType(),
                request.amount(),
                request.alertRatio(),
                request.startDate(),
                request.endDate(),
                request.remark()
        );
        return toResponse(budgetService.create(normalizedRequest));
    }

    @GetMapping
    public List<BudgetApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return budgetService.listByFamilyId(familyId).stream()
                .map(BudgetController::toResponse)
                .toList();
    }

    @PutMapping("/{budgetId}")
    public BudgetApiModels.Response update(
            @PathVariable Long budgetId,
            @Valid @RequestBody BudgetApiModels.UpdateRequest request
    ) {
        BudgetPlan budgetPlan = budgetService.getBudget(budgetId);
        familyAccessService.requireFamilyRead(budgetPlan.getFamilyId());
        return toResponse(budgetService.update(budgetId, request));
    }

    @PostMapping("/{budgetId}/enable")
    public BudgetApiModels.Response enable(@PathVariable Long budgetId) {
        BudgetPlan budgetPlan = budgetService.getBudget(budgetId);
        familyAccessService.requireFamilyRead(budgetPlan.getFamilyId());
        return toResponse(budgetService.changeEnabled(budgetId, true));
    }

    @PostMapping("/{budgetId}/disable")
    public BudgetApiModels.Response disable(@PathVariable Long budgetId) {
        BudgetPlan budgetPlan = budgetService.getBudget(budgetId);
        familyAccessService.requireFamilyRead(budgetPlan.getFamilyId());
        return toResponse(budgetService.changeEnabled(budgetId, false));
    }

    @GetMapping("/usage")
    public List<BudgetApiModels.UsageResponse> usage(
            @RequestParam Long familyId,
            @RequestParam(required = false) String month
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return budgetService.getUsage(familyId, month);
    }

    private static BudgetApiModels.Response toResponse(BudgetPlan budgetPlan) {
        return new BudgetApiModels.Response(
                budgetPlan.getId(),
                budgetPlan.getFamilyId(),
                budgetPlan.getCategoryId(),
                budgetPlan.getCreatedByMemberId(),
                budgetPlan.getBudgetName(),
                budgetPlan.getPeriodType(),
                budgetPlan.getAmount(),
                budgetPlan.getAlertRatio(),
                budgetPlan.getStartDate(),
                budgetPlan.getEndDate(),
                budgetPlan.getEnabled(),
                budgetPlan.getRemark()
        );
    }
}
