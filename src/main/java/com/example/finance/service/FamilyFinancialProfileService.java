package com.example.finance.service;

import com.example.finance.dto.FamilyFinancialProfileApiModels;
import com.example.finance.entity.FamilyFinancialProfile;
import com.example.finance.repository.FamilyFinancialProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
public class FamilyFinancialProfileService {

    private static final List<String> SUPPORTED_RISK_PREFERENCES = List.of("LOW", "MEDIUM", "HIGH");

    private final FamilyFinancialProfileRepository familyFinancialProfileRepository;
    private final FamilyService familyService;

    public FamilyFinancialProfileService(
            FamilyFinancialProfileRepository familyFinancialProfileRepository,
            FamilyService familyService
    ) {
        this.familyFinancialProfileRepository = familyFinancialProfileRepository;
        this.familyService = familyService;
    }

    public FamilyFinancialProfile getByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return familyFinancialProfileRepository.findByFamilyId(familyId)
                .orElseGet(() -> buildDefaultProfile(familyId));
    }

    public FamilyFinancialProfile save(FamilyFinancialProfileApiModels.SaveRequest request) {
        familyService.getById(request.familyId());

        FamilyFinancialProfile profile = familyFinancialProfileRepository.findByFamilyId(request.familyId())
                .orElseGet(() -> {
                    FamilyFinancialProfile created = new FamilyFinancialProfile();
                    created.setFamilyId(request.familyId());
                    return created;
                });

        profile.setRiskPreference(normalizeRiskPreference(request.riskPreference(), profile.getRiskPreference()));
        profile.setSavingsTargetRate(request.savingsTargetRate());
        profile.setEmergencyFundMonths(request.emergencyFundMonths());
        profile.setInvestmentPreferenceJson(normalize(request.investmentPreferenceJson()));
        return familyFinancialProfileRepository.save(profile);
    }

    @Transactional
    public long deleteByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return familyFinancialProfileRepository.deleteByFamilyId(familyId);
    }

    private FamilyFinancialProfile buildDefaultProfile(Long familyId) {
        FamilyFinancialProfile profile = new FamilyFinancialProfile();
        profile.setFamilyId(familyId);
        profile.setRiskPreference("LOW");
        return profile;
    }

    private String normalizeRiskPreference(String riskPreference, String existingRiskPreference) {
        String normalized = StringUtils.hasText(riskPreference)
                ? riskPreference.trim().toUpperCase(Locale.ROOT)
                : StringUtils.hasText(existingRiskPreference)
                ? existingRiskPreference.trim().toUpperCase(Locale.ROOT)
                : "LOW";
        if (!SUPPORTED_RISK_PREFERENCES.contains(normalized)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "riskPreference only supports LOW, MEDIUM, HIGH");
        }
        return normalized;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
