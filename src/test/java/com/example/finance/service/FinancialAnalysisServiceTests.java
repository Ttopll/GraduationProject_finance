package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.FinancialAnalysisApiModels;
import com.example.finance.dto.FixedAssetApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialAnalysisServiceTests {

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private BudgetService budgetService;

    @Mock
    private FixedAssetService fixedAssetService;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private FinancialAnalysisService financialAnalysisService;

    @Test
    void getDashboardShouldAggregateOverviewTrendBudgetAndAssets() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        YearMonth month = YearMonth.of(2026, 3);
        LocalDateTime monthStart = month.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = month.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);
        LocalDateTime trendStart = month.minusMonths(2).atDay(1).atStartOfDay();

        TransactionRecord marchIncome = buildRecord("INCOME", new BigDecimal("8000.00"), null, LocalDateTime.of(2026, 3, 5, 8, 0));
        TransactionRecord marchFood = buildRecord("EXPENSE", new BigDecimal("1000.00"), 10L, LocalDateTime.of(2026, 3, 6, 12, 0));
        TransactionRecord marchHousing = buildRecord("EXPENSE", new BigDecimal("2000.00"), 20L, LocalDateTime.of(2026, 3, 8, 19, 0));
        TransactionRecord marchTransport = buildRecord("EXPENSE", new BigDecimal("500.00"), 30L, LocalDateTime.of(2026, 3, 10, 9, 0));
        List<TransactionRecord> monthRecords = List.of(marchIncome, marchFood, marchHousing, marchTransport);
        when(transactionRecordRepository.findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId,
                monthStart,
                monthEnd
        )).thenReturn(monthRecords);

        TransactionRecord januaryIncome = buildRecord("INCOME", new BigDecimal("7000.00"), null, LocalDateTime.of(2026, 1, 3, 8, 0));
        TransactionRecord januaryExpense = buildRecord("EXPENSE", new BigDecimal("3000.00"), 20L, LocalDateTime.of(2026, 1, 6, 8, 0));
        TransactionRecord februaryIncome = buildRecord("INCOME", new BigDecimal("7500.00"), null, LocalDateTime.of(2026, 2, 3, 8, 0));
        TransactionRecord februaryExpense = buildRecord("EXPENSE", new BigDecimal("3500.00"), 10L, LocalDateTime.of(2026, 2, 6, 8, 0));
        List<TransactionRecord> trendRecords = List.of(
                januaryIncome,
                januaryExpense,
                februaryIncome,
                februaryExpense,
                marchIncome,
                marchFood,
                marchHousing,
                marchTransport
        );
        when(transactionRecordRepository.findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId,
                trendStart,
                monthEnd
        )).thenReturn(trendRecords);

        Category food = new Category();
        food.setId(10L);
        food.setCategoryName("餐饮");
        Category housing = new Category();
        housing.setId(20L);
        housing.setCategoryName("住房");
        Category transport = new Category();
        transport.setId(30L);
        transport.setCategoryName("交通");
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId))
                .thenReturn(List.of(food, housing, transport));

        when(budgetService.getUsage(familyId, "2026-03")).thenReturn(List.of(
                new BudgetApiModels.UsageResponse(
                        101L,
                        "餐饮预算",
                        10L,
                        "餐饮",
                        "2026-03",
                        new BigDecimal("1200.00"),
                        new BigDecimal("1000.00"),
                        new BigDecimal("200.00"),
                        new BigDecimal("0.8333"),
                        true,
                        false
                ),
                new BudgetApiModels.UsageResponse(
                        102L,
                        "住房预算",
                        20L,
                        "住房",
                        "2026-03",
                        new BigDecimal("1800.00"),
                        new BigDecimal("2000.00"),
                        new BigDecimal("-200.00"),
                        new BigDecimal("1.1111"),
                        true,
                        true
                )
        ));

        when(fixedAssetService.getOverview(familyId)).thenReturn(new FixedAssetApiModels.OverviewResponse(
                familyId,
                new BigDecimal("7000.00"),
                new BigDecimal("300000.00"),
                new BigDecimal("100000.00"),
                new BigDecimal("307000.00"),
                new BigDecimal("207000.00"),
                2,
                1,
                1,
                List.of(),
                List.of(),
                List.of()
        ));

        FinancialAnalysisApiModels.DashboardResponse response = financialAnalysisService.getDashboard(familyId, "2026-03", 3);

        assertEquals("2026-03", response.month());
        assertEquals(new BigDecimal("8000.00"), response.overview().totalIncome());
        assertEquals(new BigDecimal("3500.00"), response.overview().totalExpense());
        assertEquals(new BigDecimal("4500.00"), response.overview().netCashFlow());
        assertEquals(new BigDecimal("0.5625"), response.overview().savingsRate());
        assertEquals(1, response.overview().incomeTransactionCount());
        assertEquals(3, response.overview().expenseTransactionCount());

        assertEquals(new BigDecimal("307000.00"), response.assetSnapshot().totalAssetValue());
        assertEquals(new BigDecimal("207000.00"), response.assetSnapshot().netAssetValue());

        assertEquals(new BigDecimal("0.2857"), response.keyIndicators().engelCoefficient());
        assertEquals(new BigDecimal("0.3257"), response.keyIndicators().debtToAssetRatio());
        assertEquals(new BigDecimal("2.0000"), response.keyIndicators().liquidityCoverageMonths());
        assertEquals("住房", response.keyIndicators().topExpenseCategory());
        assertEquals(new BigDecimal("2000.00"), response.keyIndicators().topExpenseAmount());
        assertEquals(new BigDecimal("0.5714"), response.keyIndicators().topExpenseRatio());
        assertEquals(2, response.keyIndicators().activeBudgetCount());
        assertEquals(2, response.keyIndicators().alertBudgetCount());
        assertEquals(1, response.keyIndicators().exceededBudgetCount());

        assertEquals(3, response.monthlyTrend().size());
        assertEquals("2026-01", response.monthlyTrend().get(0).month());
        assertEquals(new BigDecimal("4000.00"), response.monthlyTrend().get(0).netAmount());
        assertEquals("2026-03", response.monthlyTrend().get(2).month());
        assertEquals(new BigDecimal("4500.00"), response.monthlyTrend().get(2).netAmount());

        assertEquals(3, response.expenseStructure().size());
        assertEquals("住房", response.expenseStructure().get(0).categoryName());
        assertEquals(new BigDecimal("0.5714"), response.expenseStructure().get(0).ratio());
        assertEquals("餐饮", response.expenseStructure().get(1).categoryName());

        assertEquals(2, response.budgetProgress().size());
        assertEquals("餐饮预算", response.budgetProgress().get(0).budgetName());
    }

    @Test
    void getDashboardShouldReturnNullRatiosWhenThereIsNoExpense() {
        Long familyId = 2L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        YearMonth month = YearMonth.of(2026, 4);
        LocalDateTime monthStart = month.atDay(1).atStartOfDay();
        LocalDateTime monthEnd = month.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);

        TransactionRecord income = buildRecord("INCOME", new BigDecimal("2000.00"), null, LocalDateTime.of(2026, 4, 3, 8, 0));
        when(transactionRecordRepository.findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId,
                monthStart,
                monthEnd
        )).thenReturn(List.of(income));

        when(budgetService.getUsage(familyId, "2026-04")).thenReturn(List.of());
        when(fixedAssetService.getOverview(familyId)).thenReturn(new FixedAssetApiModels.OverviewResponse(
                familyId,
                new BigDecimal("5000.00"),
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("5000.00"),
                new BigDecimal("5000.00"),
                1,
                0,
                0,
                List.of(),
                List.of(),
                List.of()
        ));

        FinancialAnalysisApiModels.DashboardResponse response = financialAnalysisService.getDashboard(familyId, "2026-04", 1);

        assertEquals(List.of(), response.expenseStructure());
        assertNull(response.keyIndicators().engelCoefficient());
        assertNull(response.keyIndicators().liquidityCoverageMonths());
        assertNull(response.keyIndicators().topExpenseCategory());
        assertEquals(1, response.monthlyTrend().size());
        assertEquals(new BigDecimal("2000.00"), response.monthlyTrend().get(0).income());
        assertEquals(new BigDecimal("0.0000"), response.keyIndicators().debtToAssetRatio());
    }

    private TransactionRecord buildRecord(
            String transactionType,
            BigDecimal amount,
            Long categoryId,
            LocalDateTime transactionTime
    ) {
        TransactionRecord record = new TransactionRecord();
        record.setTransactionType(transactionType);
        record.setAmount(amount);
        record.setCategoryId(categoryId);
        record.setTransactionTime(transactionTime);
        return record;
    }
}
