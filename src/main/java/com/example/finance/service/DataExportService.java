package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.DataExportApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.DataExportLog;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.DataExportLogRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.util.PeriodRangeUtil;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.file.InvalidPathException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DataExportService {

    private static final String FILE_FORMAT_CSV = "CSV";
    private static final String STATUS_PENDING = "PENDING";
    private static final String STATUS_SUCCESS = "SUCCESS";
    private static final String STATUS_FAILED = "FAILED";
    private static final String EXPORT_TYPE_TRANSACTION = "TRANSACTION_RECORD";
    private static final String EXPORT_TYPE_BUDGET = "BUDGET_USAGE";
    private static final DateTimeFormatter FILE_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final DateTimeFormatter CSV_TIME_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final DataExportLogRepository dataExportLogRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final BudgetService budgetService;
    private final FamilyService familyService;
    private final Path exportBasePath;

    public DataExportService(
            DataExportLogRepository dataExportLogRepository,
            TransactionRecordRepository transactionRecordRepository,
            AccountRepository accountRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            BudgetService budgetService,
            FamilyService familyService,
            @Value("${app.export.base-dir:exports}") String exportBaseDir
    ) {
        this.dataExportLogRepository = dataExportLogRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.budgetService = budgetService;
        this.familyService = familyService;
        this.exportBasePath = Paths.get(exportBaseDir).toAbsolutePath().normalize();
    }

    public List<DataExportLog> list(Long familyId) {
        familyService.getById(familyId);
        return dataExportLogRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId);
    }

    public DataExportLog getById(Long exportId) {
        return dataExportLogRepository.findById(exportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "data export log not found"));
    }

    public DataExportApiModels.Response getResponseById(Long exportId) {
        return toResponse(getById(exportId));
    }

    public void delete(Long exportId) {
        DataExportLog exportLog = getById(exportId);
        Path filePath = resolveFilePathForDelete(exportLog.getFilePath());
        if (filePath != null) {
            try {
                Files.deleteIfExists(filePath);
            } catch (IOException ignored) {
                // Keep log deletion resilient even if file cleanup fails.
            }
        }
        dataExportLogRepository.delete(exportLog);
    }

    public DataExportApiModels.ExportResponse exportTransactions(Long familyId, Long requestedByMemberId, String monthText) {
        familyService.getById(familyId);
        validateRequester(familyId, requestedByMemberId);

        DataExportLog exportLog = createPendingLog(familyId, requestedByMemberId, EXPORT_TYPE_TRANSACTION);
        try {
            List<TransactionRecord> records = resolveTransactionRecords(familyId, monthText);
            String csvContent = buildTransactionCsv(familyId, records);
            String monthPart = normalizeMonthPart(monthText);
            String relativePath = writeCsv(
                    "transactions",
                    String.format(
                            Locale.ROOT,
                            "transactions_family_%d_%s_%s.csv",
                            familyId,
                            monthPart,
                            FILE_TIME_FORMATTER.format(LocalDateTime.now())
                    ),
                    csvContent
            );
            exportLog.setFilePath(relativePath);
            exportLog.setStatus(STATUS_SUCCESS);
            exportLog.setCompletedAt(LocalDateTime.now());
            DataExportLog savedLog = dataExportLogRepository.save(exportLog);
            return new DataExportApiModels.ExportResponse(toResponse(savedLog), records.size());
        } catch (IOException exception) {
            markFailed(exportLog);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to export transaction records");
        }
    }

    public DataExportApiModels.ExportResponse exportBudgetUsage(Long familyId, Long requestedByMemberId, String monthText) {
        familyService.getById(familyId);
        validateRequester(familyId, requestedByMemberId);

        DataExportLog exportLog = createPendingLog(familyId, requestedByMemberId, EXPORT_TYPE_BUDGET);
        try {
            List<BudgetApiModels.UsageResponse> usageRows = budgetService.getUsage(familyId, monthText);
            String monthPart = normalizeMonthPart(monthText);
            String csvContent = buildBudgetCsv(usageRows);
            String relativePath = writeCsv(
                    "budgets",
                    String.format(
                            Locale.ROOT,
                            "budget_usage_family_%d_%s_%s.csv",
                            familyId,
                            monthPart,
                            FILE_TIME_FORMATTER.format(LocalDateTime.now())
                    ),
                    csvContent
            );
            exportLog.setFilePath(relativePath);
            exportLog.setStatus(STATUS_SUCCESS);
            exportLog.setCompletedAt(LocalDateTime.now());
            DataExportLog savedLog = dataExportLogRepository.save(exportLog);
            return new DataExportApiModels.ExportResponse(toResponse(savedLog), usageRows.size());
        } catch (IOException exception) {
            markFailed(exportLog);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "failed to export budget usage");
        }
    }

    public Path resolveExistingFile(DataExportLog exportLog) {
        if (!STATUS_SUCCESS.equalsIgnoreCase(exportLog.getStatus()) || exportLog.getFilePath() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "export file is not available");
        }
        Path resolvedPath = exportBasePath.resolve(exportLog.getFilePath()).normalize();
        if (!resolvedPath.startsWith(exportBasePath) || !Files.exists(resolvedPath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "export file not found");
        }
        return resolvedPath;
    }

    public static DataExportApiModels.Response toResponse(DataExportLog exportLog) {
        String fileName = exportLog.getFilePath() == null ? null : Path.of(exportLog.getFilePath()).getFileName().toString();
        return new DataExportApiModels.Response(
                exportLog.getId(),
                exportLog.getFamilyId(),
                exportLog.getRequestedByMemberId(),
                exportLog.getExportType(),
                exportLog.getFileFormat(),
                exportLog.getFilePath(),
                fileName,
                exportLog.getStatus(),
                exportLog.getCompletedAt(),
                exportLog.getCreatedAt()
        );
    }

    private List<TransactionRecord> resolveTransactionRecords(Long familyId, String monthText) {
        if (monthText == null || monthText.isBlank()) {
            return transactionRecordRepository.findByFamilyIdOrderByTransactionTimeDescIdDesc(familyId);
        }
        YearMonth month = PeriodRangeUtil.resolveMonth(monthText);
        LocalDateTime[] range = PeriodRangeUtil.monthRange(month);
        return transactionRecordRepository.findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId,
                range[0],
                range[1]
        );
    }

    private String buildTransactionCsv(Long familyId, List<TransactionRecord> records) {
        Map<Long, String> accountNameMap = new HashMap<>();
        for (Account account : accountRepository.findByFamilyIdOrderByIdDesc(familyId)) {
            accountNameMap.put(account.getId(), account.getAccountName());
        }
        Map<Long, String> categoryNameMap = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            categoryNameMap.put(category.getId(), category.getCategoryName());
        }

        StringBuilder builder = new StringBuilder();
        builder.append("RecordId,TransactionTime,TransactionType,AccountName,TargetAccountName,CategoryName,Amount,MerchantName,CounterpartyName,SourcePlatform,ExternalTradeNo,Note\r\n");
        for (TransactionRecord record : records) {
            builder.append(csv(record.getId()))
                    .append(',').append(csv(record.getTransactionTime() == null ? null : CSV_TIME_FORMATTER.format(record.getTransactionTime())))
                    .append(',').append(csv(record.getTransactionType()))
                    .append(',').append(csv(accountNameMap.get(record.getAccountId())))
                    .append(',').append(csv(accountNameMap.get(record.getTargetAccountId())))
                    .append(',').append(csv(categoryNameMap.get(record.getCategoryId())))
                    .append(',').append(csv(record.getAmount()))
                    .append(',').append(csv(record.getMerchantName()))
                    .append(',').append(csv(record.getCounterpartyName()))
                    .append(',').append(csv(record.getSourcePlatform()))
                    .append(',').append(csv(record.getExternalTradeNo()))
                    .append(',').append(csv(record.getNote()))
                    .append("\r\n");
        }
        return builder.toString();
    }

    private String buildBudgetCsv(List<BudgetApiModels.UsageResponse> usageRows) {
        StringBuilder builder = new StringBuilder();
        builder.append("BudgetId,BudgetName,CategoryName,Month,BudgetAmount,SpentAmount,RemainingAmount,UsageRatio,AlertTriggered,Exceeded\r\n");
        for (BudgetApiModels.UsageResponse usage : usageRows) {
            builder.append(csv(usage.budgetId()))
                    .append(',').append(csv(usage.budgetName()))
                    .append(',').append(csv(usage.categoryName()))
                    .append(',').append(csv(usage.month()))
                    .append(',').append(csv(usage.budgetAmount()))
                    .append(',').append(csv(usage.spentAmount()))
                    .append(',').append(csv(usage.remainingAmount()))
                    .append(',').append(csv(usage.usageRatio()))
                    .append(',').append(csv(usage.alertTriggered()))
                    .append(',').append(csv(usage.exceeded()))
                    .append("\r\n");
        }
        return builder.toString();
    }

    private String writeCsv(String subDirectory, String fileName, String content) throws IOException {
        Path directory = exportBasePath.resolve(subDirectory).normalize();
        Files.createDirectories(directory);
        Path targetFile = directory.resolve(fileName).normalize();
        Files.writeString(targetFile, content, StandardCharsets.UTF_8);
        return exportBasePath.relativize(targetFile).toString().replace('\\', '/');
    }

    private Path resolveFilePathForDelete(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return null;
        }
        try {
            Path resolvedPath = exportBasePath.resolve(relativePath).normalize();
            if (!resolvedPath.startsWith(exportBasePath)) {
                return null;
            }
            return resolvedPath;
        } catch (InvalidPathException exception) {
            return null;
        }
    }

    private DataExportLog createPendingLog(Long familyId, Long requestedByMemberId, String exportType) {
        DataExportLog exportLog = new DataExportLog();
        exportLog.setFamilyId(familyId);
        exportLog.setRequestedByMemberId(requestedByMemberId);
        exportLog.setExportType(exportType);
        exportLog.setFileFormat(FILE_FORMAT_CSV);
        exportLog.setStatus(STATUS_PENDING);
        return dataExportLogRepository.save(exportLog);
    }

    private void markFailed(DataExportLog exportLog) {
        exportLog.setStatus(STATUS_FAILED);
        exportLog.setCompletedAt(LocalDateTime.now());
        dataExportLogRepository.save(exportLog);
    }

    private void validateRequester(Long familyId, Long requestedByMemberId) {
        if (requestedByMemberId == null) {
            return;
        }
        FamilyMember requester = familyMemberRepository.findById(requestedByMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "export requester not found"));
        if (!familyId.equals(requester.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "export requester does not belong to family");
        }
    }

    private String normalizeMonthPart(String monthText) {
        return (monthText == null || monthText.isBlank())
                ? "all"
                : PeriodRangeUtil.resolveMonth(monthText).toString();
    }

    private String csv(Object value) {
        if (value == null) {
            return "";
        }
        String text = String.valueOf(value);
        if (text.contains(",") || text.contains("\"") || text.contains("\n") || text.contains("\r")) {
            return "\"" + text.replace("\"", "\"\"") + "\"";
        }
        return text;
    }
}
