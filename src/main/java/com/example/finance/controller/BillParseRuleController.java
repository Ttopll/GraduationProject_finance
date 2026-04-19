package com.example.finance.controller;

import com.example.finance.dto.BillParseRuleApiModels;
import com.example.finance.entity.BillParseRule;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.BillParseRuleService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/bill-parse-rules")
public class BillParseRuleController {

    private final BillParseRuleService billParseRuleService;
    private final FamilyAccessService familyAccessService;

    public BillParseRuleController(
            BillParseRuleService billParseRuleService,
            FamilyAccessService familyAccessService
    ) {
        this.billParseRuleService = billParseRuleService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BillParseRuleApiModels.Response create(@Valid @RequestBody BillParseRuleApiModels.CreateRequest request) {
        familyAccessService.requireFamilyOwner(request.familyId());
        BillParseRule created = billParseRuleService.create(request);
        return billParseRuleService.getResponseById(created.getId());
    }

    @GetMapping
    public List<BillParseRuleApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyOwner(familyId);
        return billParseRuleService.list(familyId);
    }

    @GetMapping("/{ruleId}")
    public BillParseRuleApiModels.Response get(@PathVariable Long ruleId) {
        BillParseRule rule = billParseRuleService.getById(ruleId);
        familyAccessService.requireFamilyOwner(rule.getFamilyId());
        return billParseRuleService.getResponseById(ruleId);
    }

    @PutMapping("/{ruleId}")
    public BillParseRuleApiModels.Response update(
            @PathVariable Long ruleId,
            @Valid @RequestBody BillParseRuleApiModels.UpdateRequest request
    ) {
        BillParseRule rule = billParseRuleService.getById(ruleId);
        familyAccessService.requireFamilyOwner(rule.getFamilyId());
        BillParseRule updated = billParseRuleService.update(ruleId, request);
        return billParseRuleService.getResponseById(updated.getId());
    }

    @PostMapping("/{ruleId}/enable")
    public BillParseRuleApiModels.Response enable(@PathVariable Long ruleId) {
        BillParseRule rule = billParseRuleService.getById(ruleId);
        familyAccessService.requireFamilyOwner(rule.getFamilyId());
        BillParseRule updated = billParseRuleService.changeEnabled(ruleId, true);
        return billParseRuleService.getResponseById(updated.getId());
    }

    @PostMapping("/{ruleId}/disable")
    public BillParseRuleApiModels.Response disable(@PathVariable Long ruleId) {
        BillParseRule rule = billParseRuleService.getById(ruleId);
        familyAccessService.requireFamilyOwner(rule.getFamilyId());
        BillParseRule updated = billParseRuleService.changeEnabled(ruleId, false);
        return billParseRuleService.getResponseById(updated.getId());
    }

    @DeleteMapping("/{ruleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long ruleId) {
        BillParseRule rule = billParseRuleService.getById(ruleId);
        familyAccessService.requireFamilyOwner(rule.getFamilyId());
        billParseRuleService.delete(ruleId);
    }
}
