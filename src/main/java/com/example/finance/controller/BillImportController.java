package com.example.finance.controller;

import com.example.finance.dto.BillImportApiModels;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.BillImportService;
import com.example.finance.service.BillImportPendingItemService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/bill-imports")
public class BillImportController {

    private final BillImportService billImportService;
    private final BillImportPendingItemService billImportPendingItemService;
    private final FamilyAccessService familyAccessService;

    public BillImportController(
            BillImportService billImportService,
            BillImportPendingItemService billImportPendingItemService,
            FamilyAccessService familyAccessService
    ) {
        this.billImportService = billImportService;
        this.billImportPendingItemService = billImportPendingItemService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping("/upload")
    @ResponseStatus(HttpStatus.CREATED)
    public BillImportApiModels.UploadResponse upload(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long uploadedByMemberId,
            @RequestParam Long accountId,
            @RequestParam(defaultValue = "CSV") String sourcePlatform,
            @RequestParam MultipartFile file
    ) {
        familyAccessService.requireFamilyRead(familyId);
        Long safeUploadedByMemberId = familyAccessService.resolveActorMemberId(familyId, uploadedByMemberId, true);
        return billImportService.importCsv(familyId, safeUploadedByMemberId, accountId, sourcePlatform, file);
    }

    @GetMapping
    public List<BillImportApiModels.BatchResponse> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return billImportService.list(familyId);
    }

    @GetMapping("/pending-items")
    public List<BillImportApiModels.PendingItemResponse> listPendingItems(
            @RequestParam Long familyId,
            @RequestParam(required = false) String status
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        return billImportPendingItemService.list(familyId, status);
    }

    @PostMapping("/pending-items/{pendingItemId}/resolve")
    public BillImportApiModels.PendingItemResponse resolvePendingItem(
            @PathVariable Long pendingItemId,
            @Valid @RequestBody BillImportApiModels.ResolvePendingRequest request
    ) {
        var pendingItem = billImportPendingItemService.getById(pendingItemId);
        familyAccessService.requireFamilyOwner(pendingItem.getFamilyId());
        Long resolvedByMemberId = familyAccessService.resolveActorMemberId(
                pendingItem.getFamilyId(),
                request.resolvedByMemberId(),
                true
        );
        return billImportPendingItemService.resolve(
                pendingItemId,
                new BillImportPendingItemService.ResolveCommand(
                        pendingItem.getFamilyId(),
                        request.categoryId(),
                        resolvedByMemberId,
                        request.createParseRule(),
                        request.priority()
                )
        );
    }
}
