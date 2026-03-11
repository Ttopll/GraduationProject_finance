package com.example.finance.controller;

import com.example.finance.dto.TransactionRecordApiModels;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.TransactionRecordService;
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

import java.util.List;

@RestController
@RequestMapping("/api/transaction-records")
public class TransactionRecordController {

    private final TransactionRecordService transactionRecordService;
    private final FamilyAccessService familyAccessService;

    public TransactionRecordController(
            TransactionRecordService transactionRecordService,
            FamilyAccessService familyAccessService
    ) {
        this.transactionRecordService = transactionRecordService;
        this.familyAccessService = familyAccessService;
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

    @GetMapping
    public List<TransactionRecordApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return transactionRecordService.listByFamilyId(familyId).stream()
                .map(TransactionRecordController::toResponse)
                .toList();
    }

    @GetMapping("/family/{familyId}/monthly-summary")
    public List<TransactionRecordApiModels.MonthlySummaryResponse> monthlySummary(
            @PathVariable Long familyId,
            @RequestParam(defaultValue = "6") Integer months
    ) {
        familyAccessService.requireFamilyRead(familyId);
        return transactionRecordService.monthlySummary(familyId, months);
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
