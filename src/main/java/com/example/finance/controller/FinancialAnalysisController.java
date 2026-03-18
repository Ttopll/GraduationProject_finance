package com.example.finance.controller;

import com.example.finance.dto.FinancialAnalysisApiModels;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FinancialAnalysisService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/financial-analysis")
public class FinancialAnalysisController {

    private final FinancialAnalysisService financialAnalysisService;
    private final FamilyAccessService familyAccessService;

    public FinancialAnalysisController(
            FinancialAnalysisService financialAnalysisService,
            FamilyAccessService familyAccessService
    ) {
        this.financialAnalysisService = financialAnalysisService;
        this.familyAccessService = familyAccessService;
    }

    @GetMapping("/dashboard")
    public FinancialAnalysisApiModels.DashboardResponse dashboard(
            @RequestParam Long familyId,
            @RequestParam(required = false) String month,
            @RequestParam(required = false) Integer trendMonths
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return financialAnalysisService.getDashboard(familyId, month, trendMonths);
    }
}
