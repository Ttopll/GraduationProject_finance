package com.example.finance.controller;

import com.example.finance.dto.DataExportApiModels;
import com.example.finance.entity.DataExportLog;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.DataExportService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.nio.file.Path;
import java.util.List;

@RestController
@RequestMapping("/api/data-exports")
public class DataExportController {

    private final DataExportService dataExportService;
    private final FamilyAccessService familyAccessService;

    public DataExportController(DataExportService dataExportService, FamilyAccessService familyAccessService) {
        this.dataExportService = dataExportService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping("/transactions")
    public DataExportApiModels.ExportResponse exportTransactions(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long requestedByMemberId,
            @RequestParam(required = false) String month
    ) {
        familyAccessService.requireFamilyRead(familyId);
        Long safeRequestedByMemberId = familyAccessService.resolveActorMemberId(familyId, requestedByMemberId, true);
        return dataExportService.exportTransactions(familyId, safeRequestedByMemberId, month);
    }

    @PostMapping("/budgets")
    public DataExportApiModels.ExportResponse exportBudgets(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long requestedByMemberId,
            @RequestParam(required = false) String month
    ) {
        familyAccessService.requireFamilyRead(familyId);
        Long safeRequestedByMemberId = familyAccessService.resolveActorMemberId(familyId, requestedByMemberId, true);
        return dataExportService.exportBudgetUsage(familyId, safeRequestedByMemberId, month);
    }

    @GetMapping
    public List<DataExportApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return dataExportService.list(familyId).stream()
                .map(DataExportService::toResponse)
                .toList();
    }

    @GetMapping("/{exportId}")
    public DataExportApiModels.Response get(@PathVariable Long exportId) {
        DataExportLog exportLog = dataExportService.getById(exportId);
        familyAccessService.requireFamilyRead(exportLog.getFamilyId());
        return DataExportService.toResponse(exportLog);
    }

    @GetMapping("/{exportId}/download")
    public ResponseEntity<Resource> download(@PathVariable Long exportId) {
        DataExportLog exportLog = dataExportService.getById(exportId);
        familyAccessService.requireFamilyRead(exportLog.getFamilyId());
        Path filePath = dataExportService.resolveExistingFile(exportLog);
        Resource resource = new FileSystemResource(filePath);
        String fileName = filePath.getFileName().toString();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
                .body(resource);
    }

    @DeleteMapping("/{exportId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long exportId) {
        DataExportLog exportLog = dataExportService.getById(exportId);
        familyAccessService.requireFamilyRead(exportLog.getFamilyId());
        dataExportService.delete(exportId);
    }
}
