package com.example.finance.controller;

import com.example.finance.dto.FinancialAdviceApiModels;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FinancialAdviceService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/financial-advices")
public class FinancialAdviceController {

    private final FinancialAdviceService financialAdviceService;
    private final FamilyAccessService familyAccessService;

    public FinancialAdviceController(
            FinancialAdviceService financialAdviceService,
            FamilyAccessService familyAccessService
    ) {
        this.financialAdviceService = financialAdviceService;
        this.familyAccessService = familyAccessService;
    }

    @GetMapping
    public List<FinancialAdviceApiModels.Response> list(
            @RequestParam Long familyId,
            @RequestParam(required = false) String status
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return financialAdviceService.list(familyId, status).stream()
                .map(FinancialAdviceService::toResponse)
                .toList();
    }

    @PostMapping("/generate")
    public FinancialAdviceApiModels.GenerateResponse generate(
            @RequestParam Long familyId,
            @RequestParam(required = false) String month
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        return financialAdviceService.generate(familyId, month);
    }

    @PostMapping("/{adviceId}/read")
    public FinancialAdviceApiModels.Response markRead(@PathVariable Long adviceId) {
        return FinancialAdviceService.toResponse(financialAdviceService.markRead(adviceId));
    }
}
