package com.example.finance.service;

import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Debt;
import com.example.finance.entity.Family;
import com.example.finance.entity.FixedAsset;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.DebtRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FixedAssetRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FixedAssetServiceTests {

    @Mock
    private FixedAssetRepository fixedAssetRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private DebtRepository debtRepository;

    @Mock
    private FamilyService familyService;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @InjectMocks
    private FixedAssetService fixedAssetService;

    @Test
    void getOverviewShouldAggregateAccountsAssetsAndDebts() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        Account cash = new Account();
        cash.setId(11L);
        cash.setAccountName("Cash");
        cash.setAccountType("CASH");
        cash.setCurrentBalance(new BigDecimal("1200.50"));

        Account savings = new Account();
        savings.setId(12L);
        savings.setAccountName("Savings");
        savings.setAccountType("SAVINGS");
        savings.setCurrentBalance(new BigDecimal("5800.00"));

        FixedAsset house = new FixedAsset();
        house.setId(21L);
        house.setAssetName("House");
        house.setAssetType("HOUSE");
        house.setPurchaseAmount(new BigDecimal("500000.00"));
        house.setValuationAmount(new BigDecimal("620000.00"));
        house.setValuationDate(LocalDate.of(2026, 3, 1));

        FixedAsset car = new FixedAsset();
        car.setId(22L);
        car.setAssetName("Car");
        car.setAssetType("CAR");
        car.setPurchaseAmount(new BigDecimal("80000.00"));

        Debt mortgage = new Debt();
        mortgage.setId(31L);
        mortgage.setDebtName("Mortgage");
        mortgage.setDebtType("LOAN");
        mortgage.setCurrentBalance(new BigDecimal("300000.00"));
        mortgage.setStatus("ACTIVE");

        when(accountRepository.findByFamilyIdOrderByIdDesc(familyId)).thenReturn(List.of(cash, savings));
        when(fixedAssetRepository.findByFamilyIdAndStatusOrderByPurchaseDateDescIdDesc(familyId, 1))
                .thenReturn(List.of(house, car));
        when(debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, "ACTIVE"))
                .thenReturn(List.of(mortgage));

        FixedAssetApiModels.OverviewResponse overview = fixedAssetService.getOverview(familyId);

        assertEquals(new BigDecimal("7000.50"), overview.totalAccountBalance());
        assertEquals(new BigDecimal("700000.00"), overview.totalFixedAssetValue());
        assertEquals(new BigDecimal("300000.00"), overview.totalDebtBalance());
        assertEquals(new BigDecimal("707000.50"), overview.totalAssetValue());
        assertEquals(new BigDecimal("407000.50"), overview.netAssetValue());
        assertEquals(2, overview.accountCount());
        assertEquals(2, overview.fixedAssetCount());
        assertEquals(1, overview.debtCount());
        assertEquals(new BigDecimal("80000.00"), overview.fixedAssets().get(1).effectiveValue());
    }

    @Test
    void createShouldRejectValuationDateWithoutValuationAmount() {
        FixedAssetApiModels.CreateRequest request = new FixedAssetApiModels.CreateRequest(
                1L,
                null,
                "House",
                "house",
                new BigDecimal("500000.00"),
                LocalDate.of(2020, 1, 1),
                null,
                LocalDate.of(2026, 3, 1),
                "Primary residence"
        );

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> fixedAssetService.create(request)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("valuationAmount is required when valuationDate is provided", exception.getReason());
    }

    @Test
    void updateShouldModifyAssetFields() {
        Long familyId = 1L;
        Long assetId = 100L;

        Family family = new Family();
        family.setId(familyId);

        FixedAsset asset = new FixedAsset();
        asset.setId(assetId);
        asset.setFamilyId(familyId);
        asset.setOwnerMemberId(11L);
        asset.setAssetName("Old Asset");
        asset.setAssetType("CAR");
        asset.setPurchaseAmount(new BigDecimal("10000.00"));
        asset.setStatus(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(fixedAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));
        when(fixedAssetRepository.save(any(FixedAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FixedAsset updated = fixedAssetService.update(
                assetId,
                new FixedAssetApiModels.UpdateRequest(
                        11L,
                        "New Asset",
                        "house",
                        new BigDecimal("20000.00"),
                        LocalDate.of(2024, 1, 1),
                        new BigDecimal("25000.00"),
                        LocalDate.of(2026, 4, 1),
                        "updated"
                )
        );

        assertEquals("New Asset", updated.getAssetName());
        assertEquals("HOUSE", updated.getAssetType());
        assertEquals(new BigDecimal("20000.00"), updated.getPurchaseAmount());
        assertEquals(new BigDecimal("25000.00"), updated.getValuationAmount());
        assertEquals("updated", updated.getRemark());
    }

    @Test
    void changeStatusShouldDisableAsset() {
        Long familyId = 1L;
        Long assetId = 101L;

        Family family = new Family();
        family.setId(familyId);

        FixedAsset asset = new FixedAsset();
        asset.setId(assetId);
        asset.setFamilyId(familyId);
        asset.setStatus(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(fixedAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));
        when(fixedAssetRepository.save(any(FixedAsset.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FixedAsset disabled = fixedAssetService.changeStatus(assetId, false);

        assertEquals(0, disabled.getStatus());
    }

    @Test
    void deleteShouldRemoveAsset() {
        Long familyId = 1L;
        Long assetId = 102L;

        Family family = new Family();
        family.setId(familyId);

        FixedAsset asset = new FixedAsset();
        asset.setId(assetId);
        asset.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(fixedAssetRepository.findById(assetId)).thenReturn(Optional.of(asset));

        fixedAssetService.delete(assetId);

        verify(fixedAssetRepository).delete(asset);
    }
}
