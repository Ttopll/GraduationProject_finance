package com.example.finance.controller;

import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.FixedAsset;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FixedAssetService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/fixed-assets")
public class FixedAssetController {

    private final FixedAssetService fixedAssetService;
    private final FamilyAccessService familyAccessService;
    private final CurrentUserService currentUserService;

    public FixedAssetController(
            FixedAssetService fixedAssetService,
            FamilyAccessService familyAccessService,
            CurrentUserService currentUserService
    ) {
        this.fixedAssetService = fixedAssetService;
        this.familyAccessService = familyAccessService;
        this.currentUserService = currentUserService;
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

    @GetMapping("/{assetId}")
    public FixedAssetApiModels.Response get(@PathVariable Long assetId) {
        FixedAsset fixedAsset = fixedAssetService.getById(assetId);
        familyAccessService.requireFamilyRead(fixedAsset.getFamilyId());
        return toResponse(fixedAsset);
    }

    @PutMapping("/{assetId}")
    public FixedAssetApiModels.Response update(
            @PathVariable Long assetId,
            @Valid @RequestBody FixedAssetApiModels.UpdateRequest request
    ) {
        FixedAsset fixedAsset = fixedAssetService.getById(assetId);
        requireManagePermission(fixedAsset);
        FixedAssetApiModels.UpdateRequest normalizedRequest = new FixedAssetApiModels.UpdateRequest(
                request.ownerMemberId() == null
                        ? fixedAsset.getOwnerMemberId()
                        : familyAccessService.resolveManagedMemberId(
                        fixedAsset.getFamilyId(),
                        request.ownerMemberId(),
                        false
                ),
                request.assetName(),
                request.assetType(),
                request.purchaseAmount(),
                request.purchaseDate(),
                request.valuationAmount(),
                request.valuationDate(),
                request.remark()
        );
        return toResponse(fixedAssetService.update(assetId, normalizedRequest));
    }

    @PostMapping("/{assetId}/enable")
    public FixedAssetApiModels.Response enable(@PathVariable Long assetId) {
        FixedAsset fixedAsset = fixedAssetService.getById(assetId);
        requireManagePermission(fixedAsset);
        return toResponse(fixedAssetService.changeStatus(assetId, true));
    }

    @PostMapping("/{assetId}/disable")
    public FixedAssetApiModels.Response disable(@PathVariable Long assetId) {
        FixedAsset fixedAsset = fixedAssetService.getById(assetId);
        requireManagePermission(fixedAsset);
        return toResponse(fixedAssetService.changeStatus(assetId, false));
    }

    @DeleteMapping("/{assetId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long assetId) {
        FixedAsset fixedAsset = fixedAssetService.getById(assetId);
        requireManagePermission(fixedAsset);
        fixedAssetService.delete(assetId);
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

    private FamilyMember requireManagePermission(FixedAsset fixedAsset) {
        FamilyMember currentMember = familyAccessService.requireFamilyRead(fixedAsset.getFamilyId());
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return currentMember;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return currentMember;
        }
        if (currentMember != null && fixedAsset.getOwnerMemberId() != null
                && fixedAsset.getOwnerMemberId().equals(currentMember.getId())) {
            return currentMember;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "cannot manage this fixed asset");
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
