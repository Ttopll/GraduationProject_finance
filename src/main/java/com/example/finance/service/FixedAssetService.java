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
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
public class FixedAssetService {

    private static final Integer ACTIVE_STATUS = 1;
    private static final String ACTIVE_DEBT_STATUS = "ACTIVE";
    private static final int RATIO_SCALE = 4;

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
        BigDecimal netAssetValue = totalAssetValue.subtract(totalDebtBalance);
        BigDecimal debtToAssetRatio = totalAssetValue.compareTo(BigDecimal.ZERO) > 0
                ? totalDebtBalance.divide(totalAssetValue, RATIO_SCALE, RoundingMode.HALF_UP)
                : null;
        BigDecimal fixedAssetRatio = totalAssetValue.compareTo(BigDecimal.ZERO) > 0
                ? totalFixedAssetValue.divide(totalAssetValue, RATIO_SCALE, RoundingMode.HALF_UP)
                : null;
        DebtRisk debtRisk = buildDebtRisk(debtItems, netAssetValue, debtToAssetRatio, fixedAssetRatio);

        return new FixedAssetApiModels.OverviewResponse(
                familyId,
                totalAccountBalance,
                totalFixedAssetValue,
                totalDebtBalance,
                totalAssetValue,
                netAssetValue,
                debtToAssetRatio,
                fixedAssetRatio,
                debtRisk.dueDebtCount,
                debtRisk.overdueDebtCount,
                debtRisk.riskLevel,
                debtRisk.riskConclusion,
                debtRisk.suggestions,
                accountItems.size(),
                fixedAssetItems.size(),
                debtItems.size(),
                accountItems,
                fixedAssetItems,
                debtItems
        );
    }

    private DebtRisk buildDebtRisk(
            List<FixedAssetApiModels.DebtBalanceItem> debtItems,
            BigDecimal netAssetValue,
            BigDecimal debtToAssetRatio,
            BigDecimal fixedAssetRatio
    ) {
        LocalDate today = LocalDate.now();
        LocalDate dueWindowEnd = today.plusDays(30);
        int dueDebtCount = 0;
        int overdueDebtCount = 0;
        for (FixedAssetApiModels.DebtBalanceItem debtItem : debtItems) {
            if (debtItem.dueDate() == null || debtItem.currentBalance().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            if (debtItem.dueDate().isBefore(today)) {
                overdueDebtCount++;
            } else if (!debtItem.dueDate().isAfter(dueWindowEnd)) {
                dueDebtCount++;
            }
        }

        List<String> suggestions = new ArrayList<>();
        if (netAssetValue.compareTo(BigDecimal.ZERO) < 0) {
            suggestions.add("当前净资产为负，建议优先降低负债余额并减少新增借款。");
        }
        if (debtItems.isEmpty()) {
            suggestions.add("当前未登记债务，可继续保持债务台账完整，便于后续净资产分析。");
        }
        if (debtToAssetRatio != null && debtToAssetRatio.compareTo(new BigDecimal("0.50")) > 0) {
            suggestions.add("负债率超过 50%，建议优先偿还高利率或短期债务。");
        } else if (debtToAssetRatio != null && debtToAssetRatio.compareTo(new BigDecimal("0.30")) > 0) {
            suggestions.add("负债率处于关注区间，建议控制新增分期，并观察未来 3 个月现金流。");
        }
        if (fixedAssetRatio != null && fixedAssetRatio.compareTo(new BigDecimal("0.80")) > 0) {
            suggestions.add("固定资产占比较高，需关注现金流和短期偿债能力。");
        } else if (fixedAssetRatio != null && fixedAssetRatio.compareTo(new BigDecimal("0.60")) > 0) {
            suggestions.add("固定资产占比较高，建议保留足够流动资金用于日常支出和债务偿还。");
        }
        if (debtToAssetRatio != null && fixedAssetRatio != null
                && debtToAssetRatio.compareTo(new BigDecimal("0.50")) > 0
                && fixedAssetRatio.compareTo(new BigDecimal("0.70")) > 0) {
            suggestions.add("负债率和固定资产占比同时偏高，说明资产流动性不足，应避免继续加杠杆购置大额资产。");
        }
        if (overdueDebtCount > 0) {
            suggestions.add("存在逾期债务，请尽快处理还款并查看消息提醒。");
        } else if (dueDebtCount > 0) {
            suggestions.add("未来 30 天存在即将到期债务，请提前安排还款资金。");
        }
        if (suggestions.isEmpty()) {
            suggestions.add("当前资产负债结构整体可控，建议持续维护资产估值和债务还款记录。");
        }

        String riskLevel;
        String riskConclusion;
        if (overdueDebtCount > 0 || netAssetValue.compareTo(BigDecimal.ZERO) < 0
                || (debtToAssetRatio != null && debtToAssetRatio.compareTo(new BigDecimal("0.70")) > 0)) {
            riskLevel = "HIGH";
            riskConclusion = "资产负债压力较高";
        } else if (dueDebtCount > 0
                || (debtToAssetRatio != null && debtToAssetRatio.compareTo(new BigDecimal("0.50")) > 0)
                || (fixedAssetRatio != null && fixedAssetRatio.compareTo(new BigDecimal("0.80")) > 0)) {
            riskLevel = "MEDIUM";
            riskConclusion = "需要关注短期偿债和资产流动性";
        } else {
            riskLevel = "LOW";
            riskConclusion = "资产负债结构相对稳定";
        }

        return new DebtRisk(dueDebtCount, overdueDebtCount, riskLevel, riskConclusion, suggestions);
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

    private record DebtRisk(
            Integer dueDebtCount,
            Integer overdueDebtCount,
            String riskLevel,
            String riskConclusion,
            List<String> suggestions
    ) {
    }
}
