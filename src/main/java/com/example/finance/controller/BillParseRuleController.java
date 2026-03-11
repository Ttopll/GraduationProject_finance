package com.example.finance.controller;

import com.example.finance.dto.BillParseRuleApiModels;
import com.example.finance.entity.BillParseRule;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.BillParseRuleService;
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
        return billParseRuleService.list(request.familyId()).stream()
                .filter(rule -> rule.id().equals(created.getId()))
                .findFirst()
                .orElse(new BillParseRuleApiModels.Response(
                        created.getId(),
                        created.getFamilyId(),
                        created.getCategoryId(),
                        null,
                        created.getMerchantKeyword(),
                        created.getRegexPattern(),
                        created.getPriority(),
                        created.getEnabled(),
                        created.getHitCount(),
                        created.getLastHitAt()
                ));
    }

    @GetMapping
    public List<BillParseRuleApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyOwner(familyId);
        return billParseRuleService.list(familyId);
    }
}
