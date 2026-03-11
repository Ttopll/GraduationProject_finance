package com.example.finance.controller;

import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.RuleDefinitionService;
import com.example.finance.service.RuleEvaluationService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rules")
public class RuleDefinitionController {

    private final RuleDefinitionService ruleDefinitionService;
    private final RuleEvaluationService ruleEvaluationService;
    private final FamilyAccessService familyAccessService;

    public RuleDefinitionController(
            RuleDefinitionService ruleDefinitionService,
            RuleEvaluationService ruleEvaluationService,
            FamilyAccessService familyAccessService
    ) {
        this.ruleDefinitionService = ruleDefinitionService;
        this.ruleEvaluationService = ruleEvaluationService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RuleDefinitionApiModels.Response create(@Valid @RequestBody RuleDefinitionApiModels.CreateRequest request) {
        familyAccessService.requireFamilyOwner(request.familyId());
        RuleDefinitionApiModels.CreateRequest normalizedRequest = new RuleDefinitionApiModels.CreateRequest(
                request.familyId(),
                request.categoryId(),
                familyAccessService.resolveActorMemberId(request.familyId(), request.createdByMemberId(), true),
                request.ruleName(),
                request.ruleType(),
                request.metricType(),
                request.timeScope(),
                request.operatorType(),
                request.thresholdValue(),
                request.actionType(),
                request.messageTemplate(),
                request.priority()
        );
        return toResponse(ruleDefinitionService.create(normalizedRequest));
    }

    @GetMapping
    public List<RuleDefinitionApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return ruleDefinitionService.listByFamilyId(familyId).stream()
                .map(RuleDefinitionController::toResponse)
                .toList();
    }

    @PostMapping("/evaluate")
    public RuleDefinitionApiModels.EvaluateResponse evaluate(
            @RequestParam Long familyId,
            @RequestParam(required = false) String month
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        return ruleEvaluationService.evaluate(familyId, month);
    }

    private static RuleDefinitionApiModels.Response toResponse(RuleDefinition ruleDefinition) {
        return new RuleDefinitionApiModels.Response(
                ruleDefinition.getId(),
                ruleDefinition.getFamilyId(),
                ruleDefinition.getCategoryId(),
                ruleDefinition.getCreatedByMemberId(),
                ruleDefinition.getRuleName(),
                ruleDefinition.getRuleType(),
                ruleDefinition.getMetricType(),
                ruleDefinition.getTimeScope(),
                ruleDefinition.getOperatorType(),
                ruleDefinition.getThresholdValue(),
                ruleDefinition.getActionType(),
                ruleDefinition.getMessageTemplate(),
                ruleDefinition.getEnabled(),
                ruleDefinition.getPriority()
        );
    }
}
