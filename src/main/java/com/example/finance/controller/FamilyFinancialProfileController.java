package com.example.finance.controller;

import com.example.finance.dto.FamilyFinancialProfileApiModels;
import com.example.finance.entity.FamilyFinancialProfile;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FamilyFinancialProfileService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/family-financial-profile")
public class FamilyFinancialProfileController {

    private final FamilyFinancialProfileService familyFinancialProfileService;
    private final FamilyAccessService familyAccessService;

    public FamilyFinancialProfileController(
            FamilyFinancialProfileService familyFinancialProfileService,
            FamilyAccessService familyAccessService
    ) {
        this.familyFinancialProfileService = familyFinancialProfileService;
        this.familyAccessService = familyAccessService;
    }

    @GetMapping
    public FamilyFinancialProfileApiModels.Response get(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return toResponse(familyFinancialProfileService.getByFamilyId(familyId));
    }

    @PutMapping
    public FamilyFinancialProfileApiModels.Response save(@Valid @RequestBody FamilyFinancialProfileApiModels.SaveRequest request) {
        familyAccessService.requireFamilyOwner(request.familyId());
        return toResponse(familyFinancialProfileService.save(request));
    }

    @DeleteMapping
    public FamilyFinancialProfileApiModels.DeleteResponse delete(@RequestParam Long familyId) {
        familyAccessService.requireFamilyOwner(familyId);
        long affectedCount = familyFinancialProfileService.deleteByFamilyId(familyId);
        return new FamilyFinancialProfileApiModels.DeleteResponse(familyId, affectedCount);
    }

    private static FamilyFinancialProfileApiModels.Response toResponse(FamilyFinancialProfile profile) {
        return new FamilyFinancialProfileApiModels.Response(
                profile.getId(),
                profile.getFamilyId(),
                profile.getRiskPreference(),
                profile.getSavingsTargetRate(),
                profile.getEmergencyFundMonths(),
                profile.getInvestmentPreferenceJson()
        );
    }
}
