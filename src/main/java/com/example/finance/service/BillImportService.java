package com.example.finance.service;

import com.example.finance.dto.BillImportApiModels;
import com.example.finance.entity.BillImportBatch;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.BillImportBatchRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.util.CsvParserUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class BillImportService {

    private static final List<String> DUPLICATE_IMPORT_STATUSES = List.of("SUCCESS", "PARTIAL_SUCCESS");

    private final BillImportBatchRepository billImportBatchRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;
    private final AccountService accountService;
    private final TransactionRecordService transactionRecordService;
    private final TransactionRecordRepository transactionRecordRepository;
    private final BillParseRuleService billParseRuleService;
    private final BillImportPendingItemService billImportPendingItemService;

    public BillImportService(
            BillImportBatchRepository billImportBatchRepository,
            FamilyMemberRepository familyMemberRepository,
            CategoryRepository categoryRepository,
            FamilyService familyService,
            AccountService accountService,
            TransactionRecordService transactionRecordService,
            TransactionRecordRepository transactionRecordRepository,
            BillParseRuleService billParseRuleService,
            BillImportPendingItemService billImportPendingItemService
    ) {
        this.billImportBatchRepository = billImportBatchRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
        this.accountService = accountService;
        this.transactionRecordService = transactionRecordService;
        this.transactionRecordRepository = transactionRecordRepository;
        this.billParseRuleService = billParseRuleService;
        this.billImportPendingItemService = billImportPendingItemService;
    }

    public List<BillImportApiModels.BatchResponse> list(Long familyId) {
        familyService.getById(familyId);
        return billImportBatchRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId).stream()
                .map(this::toBatchResponse)
                .toList();
    }

    public BillImportApiModels.UploadResponse importCsv(
            Long familyId,
            Long uploadedByMemberId,
            Long accountId,
            String sourcePlatform,
            MultipartFile file
    ) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "请上传账单文件");
        }
        familyService.getById(familyId);
        validateMember(familyId, uploadedByMemberId);
        String fileHash = calculateHash(file);
        billImportBatchRepository.findFirstByFamilyIdAndFileHashAndImportStatusInOrderByCreatedAtDescIdDesc(
                        familyId,
                        fileHash,
                        DUPLICATE_IMPORT_STATUSES
                )
                .ifPresent(existingBatch -> {
                    throw new ResponseStatusException(
                            HttpStatus.CONFLICT,
                            "检测到重复导入文件，最近一次成功批次 ID 为 " + existingBatch.getId()
                    );
                });
        Account account = accountService.getById(accountId);
        if (!familyId.equals(account.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "导入账户不属于当前家庭");
        }

        BillImportBatch batch = new BillImportBatch();
        batch.setFamilyId(familyId);
        batch.setUploadedByMemberId(uploadedByMemberId);
        batch.setSourcePlatform(StringUtils.hasText(sourcePlatform)
                ? sourcePlatform.trim().toUpperCase(Locale.ROOT)
                : "CSV");
        batch.setOriginalFileName(file.getOriginalFilename() == null ? "bill.csv" : file.getOriginalFilename());
        batch.setFileHash(fileHash);
        batch.setImportStatus("PROCESSING");
        batch = billImportBatchRepository.save(batch);

        List<String> warnings = new ArrayList<>();
        int unmatchedCount = 0;
        try {
            CsvParserUtil.ParseResult parseResult = CsvParserUtil.parse(file, batch.getSourcePlatform());
            warnings.addAll(parseResult.errors());
            batch.setTotalCount(parseResult.rows().size() + parseResult.errors().size());
            batch.setFailCount(parseResult.errors().size());

            Map<String, Category> categoryByName = categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId).stream()
                    .collect(Collectors.toMap(
                            category -> category.getCategoryName().trim().toLowerCase(Locale.ROOT),
                            category -> category,
                            (left, right) -> left
                    ));

            int successCount = 0;
            for (CsvParserUtil.ParsedRow row : parseResult.rows()) {
                try {
                    if (StringUtils.hasText(row.externalTradeNo())
                            && transactionRecordRepository.existsByFamilyIdAndSourcePlatformAndExternalTradeNo(
                            familyId,
                            batch.getSourcePlatform(),
                            row.externalTradeNo()
                    )) {
                        batch.setFailCount(batch.getFailCount() + 1);
                        warnings.add("跳过重复流水: " + row.externalTradeNo());
                        continue;
                    }

                    Long categoryId = resolveCategoryId(familyId, row, categoryByName);
                    var createdRecord = transactionRecordService.createRecord(new TransactionRecordService.CreateCommand(
                            familyId,
                            accountId,
                            null,
                            categoryId,
                            uploadedByMemberId,
                            batch.getId(),
                            row.transactionType(),
                            row.amount(),
                            row.transactionTime(),
                            row.merchantName(),
                            null,
                            batch.getSourcePlatform(),
                            row.externalTradeNo(),
                            row.note()
                    ));
                    if (categoryId == null) {
                        unmatchedCount++;
                        billImportPendingItemService.createPendingItem(new BillImportPendingItemService.CreateCommand(
                                familyId,
                                batch.getId(),
                                createdRecord.getId(),
                                batch.getSourcePlatform(),
                                row.externalTradeNo(),
                                row.merchantName(),
                                row.categoryName(),
                                row.transactionType(),
                                row.amount(),
                                row.transactionTime(),
                                row.note(),
                                row.rawLine()
                        ));
                        warnings.add("未匹配分类，已加入待归类队列: " + safe(row.merchantName()) + " [" + row.rawLine() + "]");
                    }
                    successCount++;
                } catch (RuntimeException exception) {
                    batch.setFailCount(batch.getFailCount() + 1);
                    warnings.add("导入失败: " + row.rawLine() + " -> " + exception.getMessage());
                }
            }

            batch.setSuccessCount(successCount);
            batch.setImportStatus(successCount == 0
                    ? "FAILED"
                    : batch.getFailCount() > 0
                    ? "PARTIAL_SUCCESS"
                    : "SUCCESS");
            batch.setImportedAt(LocalDateTime.now());
            batch.setErrorSummary(buildSummary(unmatchedCount, warnings));
            BillImportBatch savedBatch = billImportBatchRepository.save(batch);

            return new BillImportApiModels.UploadResponse(
                    toBatchResponse(savedBatch),
                    successCount,
                    batch.getFailCount(),
                    unmatchedCount,
                    warnings
            );
        } catch (IOException exception) {
            batch.setImportStatus("FAILED");
            batch.setErrorSummary("读取文件失败: " + exception.getMessage());
            batch.setImportedAt(LocalDateTime.now());
            billImportBatchRepository.save(batch);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "读取账单文件失败");
        }
    }

    private Long resolveCategoryId(
            Long familyId,
            CsvParserUtil.ParsedRow row,
            Map<String, Category> categoryByName
    ) {
        BillParseRuleService.MatchResult matchResult = billParseRuleService.match(familyId, row.merchantName());
        if (matchResult.matched()) {
            billParseRuleService.markHit(matchResult.rule());
            return matchResult.categoryId();
        }

        if (StringUtils.hasText(row.categoryName())) {
            Category category = categoryByName.get(row.categoryName().trim().toLowerCase(Locale.ROOT));
            if (category != null) {
                return category.getId();
            }
        }
        return null;
    }

    private void validateMember(Long familyId, Long uploadedByMemberId) {
        FamilyMember familyMember = familyMemberRepository.findById(uploadedByMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "上传人不存在"));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "上传人不属于当前家庭");
        }
    }

    private String calculateHash(MultipartFile file) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(file.getBytes()));
        } catch (NoSuchAlgorithmException | IOException exception) {
            return HexFormat.of().formatHex(file.getOriginalFilename() == null
                    ? new byte[0]
                    : file.getOriginalFilename().getBytes(StandardCharsets.UTF_8));
        }
    }

    private String buildSummary(int unmatchedCount, List<String> warnings) {
        String prefix = "unmatched=" + unmatchedCount;
        if (warnings.isEmpty()) {
            return prefix;
        }
        String detail = String.join(" ; ", warnings);
        String summary = prefix + " ; " + detail;
        return summary.length() > 500 ? summary.substring(0, 500) : summary;
    }

    private int extractUnmatchedCount(String errorSummary) {
        if (!StringUtils.hasText(errorSummary) || !errorSummary.startsWith("unmatched=")) {
            return 0;
        }
        int delimiterIndex = errorSummary.indexOf(';');
        String numberText = delimiterIndex < 0
                ? errorSummary.substring("unmatched=".length())
                : errorSummary.substring("unmatched=".length(), delimiterIndex).trim();
        try {
            return Integer.parseInt(numberText.trim());
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private BillImportApiModels.BatchResponse toBatchResponse(BillImportBatch batch) {
        return new BillImportApiModels.BatchResponse(
                batch.getId(),
                batch.getFamilyId(),
                batch.getUploadedByMemberId(),
                batch.getSourcePlatform(),
                batch.getOriginalFileName(),
                batch.getFileHash(),
                batch.getTotalCount(),
                batch.getSuccessCount(),
                batch.getFailCount(),
                batch.getImportStatus(),
                batch.getErrorSummary(),
                batch.getImportedAt(),
                extractUnmatchedCount(batch.getErrorSummary())
        );
    }

    private String safe(String value) {
        return value == null ? "UNKNOWN" : value;
    }
}
