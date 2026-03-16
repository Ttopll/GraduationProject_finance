package com.example.finance.service;

import com.example.finance.dto.FamilyFinancialProfileApiModels;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyFinancialProfile;
import com.example.finance.repository.FamilyFinancialProfileRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FamilyFinancialProfileServiceTests {

    @Mock
    private FamilyFinancialProfileRepository familyFinancialProfileRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private FamilyFinancialProfileService familyFinancialProfileService;

    @Test
    void saveShouldCreateAndNormalizeRiskPreference() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);
        when(familyFinancialProfileRepository.findByFamilyId(familyId)).thenReturn(Optional.empty());
        when(familyFinancialProfileRepository.save(any(FamilyFinancialProfile.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        FamilyFinancialProfileApiModels.SaveRequest request = new FamilyFinancialProfileApiModels.SaveRequest(
                familyId,
                "medium",
                new BigDecimal("0.25"),
                6,
                "{\"style\":\"balanced\"}"
        );

        FamilyFinancialProfile saved = familyFinancialProfileService.save(request);

        assertEquals(familyId, saved.getFamilyId());
        assertEquals("MEDIUM", saved.getRiskPreference());
        assertEquals(new BigDecimal("0.25"), saved.getSavingsTargetRate());
        assertEquals(6, saved.getEmergencyFundMonths());
        assertEquals("{\"style\":\"balanced\"}", saved.getInvestmentPreferenceJson());
    }

    @Test
    void saveShouldRejectUnsupportedRiskPreference() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);
        when(familyFinancialProfileRepository.findByFamilyId(familyId)).thenReturn(Optional.empty());

        FamilyFinancialProfileApiModels.SaveRequest request = new FamilyFinancialProfileApiModels.SaveRequest(
                familyId,
                "extreme",
                null,
                null,
                null
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> familyFinancialProfileService.save(request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("riskPreference only supports LOW, MEDIUM, HIGH", exception.getReason());
    }

    @Test
    void getByFamilyIdShouldReturnDefaultProfileWhenMissing() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);
        when(familyFinancialProfileRepository.findByFamilyId(familyId)).thenReturn(Optional.empty());

        FamilyFinancialProfile profile = familyFinancialProfileService.getByFamilyId(familyId);

        assertNull(profile.getId());
        assertEquals(familyId, profile.getFamilyId());
        assertEquals("LOW", profile.getRiskPreference());
    }
}
