package com.example.finance.controller;

import com.example.finance.dto.BillImportApiModels;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.BillImportService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
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
    private final FamilyAccessService familyAccessService;

    public BillImportController(BillImportService billImportService, FamilyAccessService familyAccessService) {
        this.billImportService = billImportService;
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
}
