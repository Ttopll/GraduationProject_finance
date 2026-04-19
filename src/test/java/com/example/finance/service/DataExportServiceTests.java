package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.DataExportApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.DataExportLog;
import com.example.finance.entity.Family;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.DataExportLogRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DataExportServiceTests {

    @Mock
    private DataExportLogRepository dataExportLogRepository;

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private BudgetService budgetService;

    @Mock
    private FamilyService familyService;

    @TempDir
    Path tempDir;

    @Test
    void exportTransactionsShouldCreateCsvAndSuccessLog() throws Exception {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        YearMonth month = YearMonth.of(2026, 3);
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);

        TransactionRecord record = new TransactionRecord();
        record.setId(101L);
        record.setAccountId(11L);
        record.setCategoryId(21L);
        record.setTransactionType("EXPENSE");
        record.setAmount(new BigDecimal("68.50"));
        record.setTransactionTime(LocalDateTime.of(2026, 3, 8, 12, 30, 0));
        record.setMerchantName("Campus Store");
        record.setSourcePlatform("MANUAL");
        record.setNote("Lunch");
        when(transactionRecordRepository.findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId, start, end
        )).thenReturn(List.of(record));

        Account account = new Account();
        account.setId(11L);
        account.setAccountName("Cash Wallet");
        when(accountRepository.findByFamilyIdOrderByIdDesc(familyId)).thenReturn(List.of(account));

        Category category = new Category();
        category.setId(21L);
        category.setCategoryName("Food");
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)).thenReturn(List.of(category));

        AtomicLong exportId = new AtomicLong(1L);
        when(dataExportLogRepository.save(any(DataExportLog.class))).thenAnswer(invocation -> {
            DataExportLog log = invocation.getArgument(0);
            if (log.getId() == null) {
                log.setId(exportId.getAndIncrement());
                log.setCreatedAt(LocalDateTime.now());
            }
            return log;
        });

        DataExportService dataExportService = new DataExportService(
                dataExportLogRepository,
                transactionRecordRepository,
                accountRepository,
                categoryRepository,
                familyMemberRepository,
                budgetService,
                familyService,
                tempDir.toString()
        );

        DataExportApiModels.ExportResponse response = dataExportService.exportTransactions(familyId, null, "2026-03");

        assertEquals(1, response.rowCount());
        assertEquals("SUCCESS", response.exportLog().status());
        Path exportedFile = tempDir.resolve(response.exportLog().filePath());
        assertTrue(Files.exists(exportedFile));

        String content = Files.readString(exportedFile);
        assertTrue(content.contains("RecordId,TransactionTime,TransactionType"));
        assertTrue(content.contains("Cash Wallet"));
        assertTrue(content.contains("Food"));
        assertTrue(content.contains("Campus Store"));
    }

    @Test
    void exportBudgetUsageShouldCreateCsvAndSuccessLog() throws Exception {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        BudgetApiModels.UsageResponse usage = new BudgetApiModels.UsageResponse(
                1L,
                "Food Budget",
                21L,
                "Food",
                "2026-03",
                new BigDecimal("500.00"),
                new BigDecimal("320.00"),
                new BigDecimal("180.00"),
                new BigDecimal("0.6400"),
                false,
                false
        );
        when(budgetService.getUsage(familyId, "2026-03")).thenReturn(List.of(usage));

        AtomicLong exportId = new AtomicLong(1L);
        when(dataExportLogRepository.save(any(DataExportLog.class))).thenAnswer(invocation -> {
            DataExportLog log = invocation.getArgument(0);
            if (log.getId() == null) {
                log.setId(exportId.getAndIncrement());
                log.setCreatedAt(LocalDateTime.now());
            }
            return log;
        });

        DataExportService dataExportService = new DataExportService(
                dataExportLogRepository,
                transactionRecordRepository,
                accountRepository,
                categoryRepository,
                familyMemberRepository,
                budgetService,
                familyService,
                tempDir.toString()
        );

        DataExportApiModels.ExportResponse response = dataExportService.exportBudgetUsage(familyId, null, "2026-03");

        assertEquals(1, response.rowCount());
        assertEquals("SUCCESS", response.exportLog().status());
        Path exportedFile = tempDir.resolve(response.exportLog().filePath());
        assertTrue(Files.exists(exportedFile));

        String content = Files.readString(exportedFile);
        assertTrue(content.contains("BudgetId,BudgetName,CategoryName"));
        assertTrue(content.contains("Food Budget"));
        assertTrue(content.contains("0.6400"));
    }

    @Test
    void deleteShouldRemoveExportFileAndLog() throws Exception {
        Long exportId = 10L;
        Long familyId = 1L;
        Path file = Files.createDirectories(tempDir.resolve("transactions"))
                .resolve("to-delete.csv");
        Files.writeString(file, "header\r\n");

        DataExportLog exportLog = new DataExportLog();
        exportLog.setId(exportId);
        exportLog.setFamilyId(familyId);
        exportLog.setFilePath(tempDir.relativize(file).toString().replace('\\', '/'));
        exportLog.setStatus("SUCCESS");

        when(dataExportLogRepository.findById(exportId)).thenReturn(Optional.of(exportLog));

        DataExportService dataExportService = new DataExportService(
                dataExportLogRepository,
                transactionRecordRepository,
                accountRepository,
                categoryRepository,
                familyMemberRepository,
                budgetService,
                familyService,
                tempDir.toString()
        );

        dataExportService.delete(exportId);

        assertTrue(Files.notExists(file));
        verify(dataExportLogRepository).delete(exportLog);
    }
}
