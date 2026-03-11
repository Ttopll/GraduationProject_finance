package com.example.finance.service;

import com.example.finance.dto.BillImportApiModels;
import com.example.finance.entity.BillImportPendingItem;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.BillImportPendingItemRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class BillImportPendingItemService {

    private final BillImportPendingItemRepository billImportPendingItemRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyService familyService;
    private final BillParseRuleService billParseRuleService;

    public BillImportPendingItemService(
            BillImportPendingItemRepository billImportPendingItemRepository,
            TransactionRecordRepository transactionRecordRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            FamilyService familyService,
            BillParseRuleService billParseRuleService
    ) {
        this.billImportPendingItemRepository = billImportPendingItemRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.familyService = familyService;
        this.billParseRuleService = billParseRuleService;
    }

    @Transactional
    public BillImportPendingItem createPendingItem(CreateCommand command) {
        BillImportPendingItem pendingItem = new BillImportPendingItem();
        pendingItem.setFamilyId(command.familyId());
        pendingItem.setSourceBatchId(command.sourceBatchId());
        pendingItem.setTransactionRecordId(command.transactionRecordId());
        pendingItem.setSourcePlatform(command.sourcePlatform());
        pendingItem.setExternalTradeNo(normalize(command.externalTradeNo()));
        pendingItem.setMerchantName(normalize(command.merchantName()));
        pendingItem.setRawCategoryName(normalize(command.rawCategoryName()));
        pendingItem.setTransactionType(command.transactionType());
        pendingItem.setAmount(command.amount());
        pendingItem.setTransactionTime(command.transactionTime());
        pendingItem.setNote(normalize(command.note()));
        pendingItem.setRawLine(command.rawLine());
        pendingItem.setStatus("PENDING");
        return billImportPendingItemRepository.save(pendingItem);
    }

    public java.util.List<BillImportApiModels.PendingItemResponse> list(Long familyId, String status) {
        familyService.getById(familyId);
        String normalizedStatus = normalizeStatus(status);
        var items = normalizedStatus == null
                ? billImportPendingItemRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId)
                : billImportPendingItemRepository.findByFamilyIdAndStatusOrderByCreatedAtDescIdDesc(familyId, normalizedStatus);
        return toResponses(familyId, items);
    }

    public BillImportPendingItem getById(Long pendingItemId) {
        return billImportPendingItemRepository.findById(pendingItemId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "待归类记录不存在"));
    }

    @Transactional
    public BillImportApiModels.PendingItemResponse resolve(Long pendingItemId, ResolveCommand command) {
        BillImportPendingItem pendingItem = getById(pendingItemId);
        if (!command.familyId().equals(pendingItem.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "待归类记录不属于当前家庭");
        }
        if (!"PENDING".equalsIgnoreCase(pendingItem.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前待归类记录已处理");
        }

        Category category = categoryRepository.findById(command.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "归类分类不存在"));
        if (!command.familyId().equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "归类分类不属于当前家庭");
        }

        if (command.resolvedByMemberId() != null) {
            FamilyMember member = familyMemberRepository.findByIdAndStatus(command.resolvedByMemberId(), 1)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "处理成员不存在"));
            if (!command.familyId().equals(member.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "处理成员不属于当前家庭");
            }
        }

        if (pendingItem.getTransactionRecordId() != null) {
            TransactionRecord record = transactionRecordRepository.findByIdAndFamilyId(
                            pendingItem.getTransactionRecordId(),
                            command.familyId()
                    )
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "关联交易记录不存在"));
            record.setCategoryId(category.getId());
            transactionRecordRepository.save(record);
        }

        pendingItem.setResolvedCategoryId(category.getId());
        pendingItem.setResolvedByMemberId(command.resolvedByMemberId());
        pendingItem.setResolvedAt(LocalDateTime.now());
        pendingItem.setStatus("RESOLVED");
        BillImportPendingItem saved = billImportPendingItemRepository.save(pendingItem);

        if (Boolean.TRUE.equals(command.createParseRule()) && StringUtils.hasText(saved.getMerchantName())) {
            billParseRuleService.createKeywordRuleIfAbsent(
                    command.familyId(),
                    category.getId(),
                    saved.getMerchantName(),
                    command.priority()
            );
        }

        return toResponses(command.familyId(), java.util.List.of(saved)).get(0);
    }

    private java.util.List<BillImportApiModels.PendingItemResponse> toResponses(
            Long familyId,
            java.util.List<BillImportPendingItem> items
    ) {
        Map<Long, String> categoryNameMap = categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId).stream()
                .collect(Collectors.toMap(Category::getId, Category::getCategoryName, (left, right) -> left));
        return items.stream()
                .map(item -> new BillImportApiModels.PendingItemResponse(
                        item.getId(),
                        item.getFamilyId(),
                        item.getSourceBatchId(),
                        item.getTransactionRecordId(),
                        item.getSourcePlatform(),
                        item.getExternalTradeNo(),
                        item.getMerchantName(),
                        item.getRawCategoryName(),
                        item.getTransactionType(),
                        item.getAmount(),
                        item.getTransactionTime(),
                        item.getNote(),
                        item.getRawLine(),
                        item.getStatus(),
                        item.getResolvedCategoryId(),
                        item.getResolvedCategoryId() == null ? null : categoryNameMap.get(item.getResolvedCategoryId()),
                        item.getResolvedByMemberId(),
                        item.getResolvedAt(),
                        item.getCreatedAt()
                ))
                .toList();
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private String normalizeStatus(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String status = value.trim().toUpperCase(Locale.ROOT);
        return switch (status) {
            case "PENDING", "RESOLVED" -> status;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "status 仅支持 PENDING 或 RESOLVED");
        };
    }

    public record CreateCommand(
            Long familyId,
            Long sourceBatchId,
            Long transactionRecordId,
            String sourcePlatform,
            String externalTradeNo,
            String merchantName,
            String rawCategoryName,
            String transactionType,
            BigDecimal amount,
            LocalDateTime transactionTime,
            String note,
            String rawLine
    ) {
    }

    public record ResolveCommand(
            Long familyId,
            Long categoryId,
            Long resolvedByMemberId,
            Boolean createParseRule,
            Integer priority
    ) {
    }
}
