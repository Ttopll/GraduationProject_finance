package com.example.finance.service;

import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Debt;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.FixedAsset;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.DebtRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FixedAssetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
public class FixedAssetService {

    private static final Integer ACTIVE_STATUS = 1;
    private static final String ACTIVE_DEBT_STATUS = "ACTIVE";

    private final FixedAssetRepository fixedAssetRepository;
    private final AccountRepository accountRepository;
    private final DebtRepository debtRepository;
    private final FamilyService familyService;
    private final FamilyMemberRepository familyMemberRepository;

    public FixedAssetService(
            FixedAssetRepository fixedAssetRepository,
            AccountRepository accountRepository,
            DebtRepository debtRepository,
            FamilyService familyService,
            FamilyMemberRepository familyMemberRepository
    ) {
        this.fixedAssetRepository = fixedAssetRepository;
        this.accountRepository = accountRepository;
        this.debtRepository = debtRepository;
        this.familyService = familyService;
        this.familyMemberRepository = familyMemberRepository;
    }

    public FixedAsset create(FixedAssetApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateOwnerMember(request.familyId(), request.ownerMemberId());
        validateValuation(request.valuationAmount(), request.valuationDate());

        FixedAsset fixedAsset = new FixedAsset();
        fixedAsset.setFamilyId(request.familyId());
        fixedAsset.setOwnerMemberId(request.ownerMemberId());
        fixedAsset.setAssetName(request.assetName().trim());
        fixedAsset.setAssetType(request.assetType().trim().toUpperCase(Locale.ROOT));
        fixedAsset.setPurchaseAmount(request.purchaseAmount());
        fixedAsset.setPurchaseDate(request.purchaseDate());
        fixedAsset.setValuationAmount(request.valuationAmount());
        fixedAsset.setValuationDate(request.valuationAmount() == null ? null : request.valuationDate());
        fixedAsset.setRemark(normalize(request.remark()));
        fixedAsset.setStatus(ACTIVE_STATUS);
        return fixedAssetRepository.save(fixedAsset);
    }

    @Transactional
    public FixedAsset update(Long assetId, FixedAssetApiModels.UpdateRequest request) {
        FixedAsset fixedAsset = getById(assetId);
        familyService.getById(fixedAsset.getFamilyId());
        validateOwnerMember(fixedAsset.getFamilyId(), request.ownerMemberId());
        validateValuation(request.valuationAmount(), request.valuationDate());

        fixedAsset.setOwnerMemberId(request.ownerMemberId());
        fixedAsset.setAssetName(request.assetName().trim());
        fixedAsset.setAssetType(request.assetType().trim().toUpperCase(Locale.ROOT));
        fixedAsset.setPurchaseAmount(request.purchaseAmount());
        fixedAsset.setPurchaseDate(request.purchaseDate());
        fixedAsset.setValuationAmount(request.valuationAmount());
        fixedAsset.setValuationDate(request.valuationAmount() == null ? null : request.valuationDate());
        fixedAsset.setRemark(normalize(request.remark()));
        return fixedAssetRepository.save(fixedAsset);
    }

    @Transactional
    public FixedAsset changeStatus(Long assetId, boolean active) {
        FixedAsset fixedAsset = getById(assetId);
        familyService.getById(fixedAsset.getFamilyId());
        fixedAsset.setStatus(active ? ACTIVE_STATUS : 0);
        return fixedAssetRepository.save(fixedAsset);
    }

    @Transactional
    public void delete(Long assetId) {
        FixedAsset fixedAsset = getById(assetId);
        familyService.getById(fixedAsset.getFamilyId());
        fixedAssetRepository.delete(fixedAsset);
    }

    public FixedAsset getById(Long assetId) {
        return fixedAssetRepository.findById(assetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "fixed asset not found"));
    }

    public List<FixedAsset> listByFamilyId(Long familyId, Integer status) {
        familyService.getById(familyId);
        if (status == null) {
            return fixedAssetRepository.findByFamilyIdOrderByPurchaseDateDescIdDesc(familyId);
        }
        return fixedAssetRepository.findByFamilyIdAndStatusOrderByPurchaseDateDescIdDesc(familyId, status);
    }

    public FixedAssetApiModels.OverviewResponse getOverview(Long familyId) {
        familyService.getById(familyId);

        List<Account> accounts = accountRepository.findByFamilyIdOrderByIdDesc(familyId);
        List<FixedAsset> fixedAssets = fixedAssetRepository.findByFamilyIdAndStatusOrderByPurchaseDateDescIdDesc(
                familyId,
                ACTIVE_STATUS
        );
        List<Debt> debts = debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, ACTIVE_DEBT_STATUS);

        List<FixedAssetApiModels.AccountBalanceItem> accountItems = accounts.stream()
                .map(account -> new FixedAssetApiModels.AccountBalanceItem(
                        account.getId(),
                        account.getAccountName(),
                        account.getAccountType(),
                        defaultAmount(account.getCurrentBalance())
                ))
                .toList();

        List<FixedAssetApiModels.FixedAssetValueItem> fixedAssetItems = fixedAssets.stream()
                .map(asset -> new FixedAssetApiModels.FixedAssetValueItem(
                        asset.getId(),
                        asset.getAssetName(),
                        asset.getAssetType(),
                        defaultAmount(asset.getPurchaseAmount()),
                        asset.getValuationAmount(),
                        effectiveValue(asset),
                        asset.getPurchaseDate(),
                        asset.getValuationDate()
                ))
                .toList();

        List<FixedAssetApiModels.DebtBalanceItem> debtItems = debts.stream()
                .map(debt -> new FixedAssetApiModels.DebtBalanceItem(
                        debt.getId(),
                        debt.getDebtName(),
                        debt.getDebtType(),
                        defaultAmount(debt.getCurrentBalance()),
                        debt.getDueDate(),
                        debt.getStatus()
                ))
                .toList();

        BigDecimal totalAccountBalance = accountItems.stream()
                .map(FixedAssetApiModels.AccountBalanceItem::currentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalFixedAssetValue = fixedAssetItems.stream()
                .map(FixedAssetApiModels.FixedAssetValueItem::effectiveValue)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebtBalance = debtItems.stream()
                .map(FixedAssetApiModels.DebtBalanceItem::currentBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalAssetValue = totalAccountBalance.add(totalFixedAssetValue);

        return new FixedAssetApiModels.OverviewResponse(
                familyId,
                totalAccountBalance,
                totalFixedAssetValue,
                totalDebtBalance,
                totalAssetValue,
                totalAssetValue.subtract(totalDebtBalance),
                accountItems.size(),
                fixedAssetItems.size(),
                debtItems.size(),
                accountItems,
                fixedAssetItems,
                debtItems
        );
    }

    private void validateOwnerMember(Long familyId, Long ownerMemberId) {
        if (ownerMemberId == null) {
            return;
        }
        FamilyMember ownerMember = familyMemberRepository.findById(ownerMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Asset owner member not found"));
        if (!familyId.equals(ownerMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Asset owner member does not belong to family");
        }
    }

    private void validateValuation(BigDecimal valuationAmount, LocalDate valuationDate) {
        if (valuationDate != null && valuationAmount == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "valuationAmount is required when valuationDate is provided"
            );
        }
    }

    private BigDecimal effectiveValue(FixedAsset asset) {
        return asset.getValuationAmount() == null
                ? defaultAmount(asset.getPurchaseAmount())
                : asset.getValuationAmount();
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
