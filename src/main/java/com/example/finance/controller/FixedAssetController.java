package com.example.finance.controller;

import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.FixedAsset;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FixedAssetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/fixed-assets")
public class FixedAssetController {

    private final FixedAssetService fixedAssetService;
    private final FamilyAccessService familyAccessService;

    public FixedAssetController(FixedAssetService fixedAssetService, FamilyAccessService familyAccessService) {
        this.fixedAssetService = fixedAssetService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FixedAssetApiModels.Response create(@Valid @RequestBody FixedAssetApiModels.CreateRequest request) {
        familyAccessService.requireFamilyRead(request.familyId());
        FixedAssetApiModels.CreateRequest normalizedRequest = new FixedAssetApiModels.CreateRequest(
                request.familyId(),
                familyAccessService.resolveManagedMemberId(request.familyId(), request.ownerMemberId(), false),
                request.assetName(),
                request.assetType(),
                request.purchaseAmount(),
                request.purchaseDate(),
                request.valuationAmount(),
                request.valuationDate(),
                request.remark()
        );
        return toResponse(fixedAssetService.create(normalizedRequest));
    }

    @GetMapping
    public List<FixedAssetApiModels.Response> list(
            @RequestParam Long familyId,
            @RequestParam(required = false) Integer status
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return fixedAssetService.listByFamilyId(familyId, status).stream()
                .map(FixedAssetController::toResponse)
                .toList();
    }

    @GetMapping("/overview")
    public FixedAssetApiModels.OverviewResponse overview(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return fixedAssetService.getOverview(familyId);
    }

    private static FixedAssetApiModels.Response toResponse(FixedAsset fixedAsset) {
        return new FixedAssetApiModels.Response(
                fixedAsset.getId(),
                fixedAsset.getFamilyId(),
                fixedAsset.getOwnerMemberId(),
                fixedAsset.getAssetName(),
                fixedAsset.getAssetType(),
                fixedAsset.getPurchaseAmount(),
                fixedAsset.getPurchaseDate(),
                fixedAsset.getValuationAmount(),
                fixedAsset.getValuationDate(),
                effectiveValue(fixedAsset),
                fixedAsset.getRemark(),
                fixedAsset.getStatus()
        );
    }

    private static BigDecimal effectiveValue(FixedAsset fixedAsset) {
        return fixedAsset.getValuationAmount() == null
                ? fixedAsset.getPurchaseAmount()
                : fixedAsset.getValuationAmount();
    }
}
