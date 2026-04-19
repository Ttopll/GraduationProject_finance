package com.example.finance.controller;

import com.example.finance.dto.TransactionRecordApiModels;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.TransactionRecordService;
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

import java.util.List;

@RestController
@RequestMapping("/api/transaction-records")
public class TransactionRecordController {

    private final TransactionRecordService transactionRecordService;
    private final FamilyAccessService familyAccessService;
    private final CurrentUserService currentUserService;

    public TransactionRecordController(
            TransactionRecordService transactionRecordService,
            FamilyAccessService familyAccessService,
            CurrentUserService currentUserService
    ) {
        this.transactionRecordService = transactionRecordService;
        this.familyAccessService = familyAccessService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TransactionRecordApiModels.Response create(
            @Valid @RequestBody TransactionRecordApiModels.CreateRequest request
    ) {
        familyAccessService.requireFamilyRead(request.familyId());
        TransactionRecordApiModels.CreateRequest normalizedRequest = new TransactionRecordApiModels.CreateRequest(
                request.familyId(),
                request.accountId(),
                request.targetAccountId(),
                request.categoryId(),
                familyAccessService.resolveActorMemberId(request.familyId(), request.createdByMemberId(), true),
                request.sourceBatchId(),
                request.transactionType(),
                request.amount(),
                request.transactionTime(),
                request.merchantName(),
                request.counterpartyName(),
                request.sourcePlatform(),
                request.externalTradeNo(),
                request.note()
        );
        return toResponse(transactionRecordService.create(normalizedRequest));
    }

    @GetMapping("/{recordId}")
    public TransactionRecordApiModels.Response get(@PathVariable Long recordId) {
        TransactionRecord record = transactionRecordService.getById(recordId);
        familyAccessService.requireFamilyRead(record.getFamilyId());
        return toResponse(record);
    }

    @PutMapping("/{recordId}")
    public TransactionRecordApiModels.Response update(
            @PathVariable Long recordId,
            @Valid @RequestBody TransactionRecordApiModels.UpdateRequest request
    ) {
        TransactionRecord record = transactionRecordService.getById(recordId);
        requireManagePermission(record);
        TransactionRecordApiModels.UpdateRequest normalizedRequest = new TransactionRecordApiModels.UpdateRequest(
                request.accountId(),
                request.targetAccountId(),
                request.categoryId(),
                request.createdByMemberId() == null
                        ? null
                        : familyAccessService.resolveManagedMemberId(record.getFamilyId(), request.createdByMemberId(), false),
                request.transactionType(),
                request.amount(),
                request.transactionTime(),
                request.merchantName(),
                request.counterpartyName(),
                request.sourcePlatform(),
                request.externalTradeNo(),
                request.note()
        );
        return toResponse(transactionRecordService.update(recordId, normalizedRequest));
    }

    @DeleteMapping("/{recordId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long recordId) {
        TransactionRecord record = transactionRecordService.getById(recordId);
        requireManagePermission(record);
        transactionRecordService.delete(recordId);
    }

    @GetMapping
    public List<TransactionRecordApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return transactionRecordService.listByFamilyId(familyId).stream()
                .map(TransactionRecordController::toResponse)
                .toList();
    }

    @GetMapping("/search")
    public TransactionRecordApiModels.SearchPageResponse search(
            @RequestParam Long familyId,
            @RequestParam(required = false) String transactionType,
            @RequestParam(required = false) java.time.LocalDateTime startTime,
            @RequestParam(required = false) java.time.LocalDateTime endTime,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return transactionRecordService.searchByFamilyId(
                familyId,
                transactionType,
                startTime,
                endTime,
                page,
                size
        );
    }

    @GetMapping("/family/{familyId}/monthly-summary")
    public List<TransactionRecordApiModels.MonthlySummaryResponse> monthlySummary(
            @PathVariable Long familyId,
            @RequestParam(defaultValue = "6") Integer months
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return transactionRecordService.monthlySummary(familyId, months);
    }

    private FamilyMember requireManagePermission(TransactionRecord record) {
        FamilyMember currentMember = familyAccessService.requireFamilyRead(record.getFamilyId());
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return currentMember;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return currentMember;
        }
        if (record.getCreatedByMemberId() == null) {
            return currentMember;
        }
        if (currentMember != null && record.getCreatedByMemberId().equals(currentMember.getId())) {
            return currentMember;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "cannot manage this transaction record");
    }

    private static TransactionRecordApiModels.Response toResponse(TransactionRecord record) {
        return new TransactionRecordApiModels.Response(
                record.getId(),
                record.getFamilyId(),
                record.getAccountId(),
                record.getTargetAccountId(),
                record.getCategoryId(),
                record.getCreatedByMemberId(),
                record.getSourceBatchId(),
                record.getTransactionType(),
                record.getAmount(),
                record.getTransactionTime(),
                record.getMerchantName(),
                record.getCounterpartyName(),
                record.getSourcePlatform(),
                record.getExternalTradeNo(),
                record.getNote(),
                record.getStatus()
        );
    }
}
