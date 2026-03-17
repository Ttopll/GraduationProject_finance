package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.entity.Notification;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.entity.RuleExecutionLog;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.repository.RuleExecutionLogRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleEvaluationServiceTests {

    @Mock
    private BudgetService budgetService;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private RuleExecutionLogRepository ruleExecutionLogRepository;

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private RuleEvaluationService ruleEvaluationService;

    @Captor
    private ArgumentCaptor<RuleExecutionLog> executionLogCaptor;

    @Test
    void evaluateShouldTriggerConsecutiveThresholdRuleWhenRecentMonthsAllMatch() {
        Long familyId = 1L;
        Long categoryId = 2L;

        when(familyService.getById(familyId)).thenReturn(new Family());
        when(budgetService.getUsage(familyId, "2026-03")).thenReturn(List.<BudgetApiModels.UsageResponse>of());
        when(ruleDefinitionRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, 1))
                .thenReturn(List.of(buildConsecutiveRule(familyId, categoryId)));
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId))
                .thenReturn(List.of(category(categoryId, familyId, "Food")));
        when(transactionRecordRepository.findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                anyLong(),
                anyString(),
                any(),
                any()
        )).thenReturn(List.of(
                expenseRecord(familyId, categoryId, "600.00", LocalDateTime.of(2026, 1, 6, 9, 0)),
                expenseRecord(familyId, categoryId, "720.00", LocalDateTime.of(2026, 2, 6, 9, 0)),
                expenseRecord(familyId, categoryId, "880.00", LocalDateTime.of(2026, 3, 6, 9, 0))
        ));
        when(ruleExecutionLogRepository.save(any(RuleExecutionLog.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(notificationService.createIfAbsentToday(
                anyLong(),
                any(),
                anyString(),
                anyLong(),
                anyString(),
                anyString(),
                anyString()
        )).thenReturn(new Notification());

        RuleDefinitionApiModels.EvaluateResponse response = ruleEvaluationService.evaluate(familyId, "2026-03");

        assertEquals("2026-03", response.month());
        assertEquals(0, response.budgetAlertCount());
        assertEquals(1, response.triggeredRuleCount());
        assertEquals(1, response.generatedNotificationCount());
        assertEquals(1, response.details().size());
        assertTrue(response.details().get(0).contains("连续 3 个月"));

        verify(ruleExecutionLogRepository).save(executionLogCaptor.capture());
        RuleExecutionLog executionLog = executionLogCaptor.getValue();
        assertEquals("TRIGGERED", executionLog.getResultStatus());
        assertTrue(executionLog.getContextJson().contains("\"consecutiveMonths\":3"));
        assertTrue(executionLog.getContextJson().contains("\"matchedMonthCount\":3"));
    }

    @Test
    void evaluateShouldSkipConsecutiveThresholdRuleWhenAnyMonthMissesThreshold() {
        Long familyId = 1L;
        Long categoryId = 2L;

        when(familyService.getById(familyId)).thenReturn(new Family());
        when(budgetService.getUsage(familyId, "2026-03")).thenReturn(List.<BudgetApiModels.UsageResponse>of());
        when(ruleDefinitionRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, 1))
                .thenReturn(List.of(buildConsecutiveRule(familyId, categoryId)));
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId))
                .thenReturn(List.of(category(categoryId, familyId, "Food")));
        when(transactionRecordRepository.findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                anyLong(),
                anyString(),
                any(),
                any()
        )).thenReturn(List.of(
                expenseRecord(familyId, categoryId, "600.00", LocalDateTime.of(2026, 1, 6, 9, 0)),
                expenseRecord(familyId, categoryId, "420.00", LocalDateTime.of(2026, 2, 6, 9, 0)),
                expenseRecord(familyId, categoryId, "880.00", LocalDateTime.of(2026, 3, 6, 9, 0))
        ));
        when(ruleExecutionLogRepository.save(any(RuleExecutionLog.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinitionApiModels.EvaluateResponse response = ruleEvaluationService.evaluate(familyId, "2026-03");

        assertEquals(0, response.budgetAlertCount());
        assertEquals(0, response.triggeredRuleCount());
        assertEquals(0, response.generatedNotificationCount());
        assertTrue(response.details().isEmpty());

        verify(ruleExecutionLogRepository).save(executionLogCaptor.capture());
        RuleExecutionLog executionLog = executionLogCaptor.getValue();
        assertEquals("SKIPPED", executionLog.getResultStatus());
        assertTrue(executionLog.getContextJson().contains("\"consecutiveMonths\":3"));
        assertTrue(executionLog.getContextJson().contains("\"matchedMonthCount\":2"));
        verify(notificationService, never()).createIfAbsentToday(
                anyLong(),
                any(),
                anyString(),
                anyLong(),
                anyString(),
                anyString(),
                anyString()
        );
    }

    private RuleDefinition buildConsecutiveRule(Long familyId, Long categoryId) {
        RuleDefinition ruleDefinition = new RuleDefinition();
        ruleDefinition.setId(5L);
        ruleDefinition.setFamilyId(familyId);
        ruleDefinition.setCategoryId(categoryId);
        ruleDefinition.setRuleName("Food Consecutive Alert");
        ruleDefinition.setRuleType("CONSECUTIVE_THRESHOLD");
        ruleDefinition.setMetricType("CATEGORY_EXPENSE");
        ruleDefinition.setTimeScope("MONTH");
        ruleDefinition.setOperatorType("GTE");
        ruleDefinition.setThresholdValue(new BigDecimal("500.00"));
        ruleDefinition.setThresholdJson("{\"consecutiveMonths\":3}");
        ruleDefinition.setActionType("NOTIFY");
        ruleDefinition.setMessageTemplate("Food spending alert");
        ruleDefinition.setEnabled(1);
        ruleDefinition.setPriority(10);
        return ruleDefinition;
    }

    private Category category(Long categoryId, Long familyId, String categoryName) {
        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);
        category.setCategoryName(categoryName);
        return category;
    }

    private TransactionRecord expenseRecord(
            Long familyId,
            Long categoryId,
            String amount,
            LocalDateTime transactionTime
    ) {
        TransactionRecord record = new TransactionRecord();
        record.setFamilyId(familyId);
        record.setAccountId(1L);
        record.setCategoryId(categoryId);
        record.setTransactionType("EXPENSE");
        record.setAmount(new BigDecimal(amount));
        record.setTransactionTime(transactionTime);
        record.setSourcePlatform("MANUAL");
        return record;
    }
}
