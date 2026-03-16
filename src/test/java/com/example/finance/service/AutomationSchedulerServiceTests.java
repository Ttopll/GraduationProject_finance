package com.example.finance.service;

import com.example.finance.dto.DebtApiModels;
import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Family;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AutomationSchedulerServiceTests {

    @Mock
    private FamilyService familyService;

    @Mock
    private RuleEvaluationService ruleEvaluationService;

    @Mock
    private DebtService debtService;

    @Test
    void runRuleEvaluationForActiveFamiliesShouldSkipInactiveFamilies() {
        AutomationSchedulerService automationSchedulerService = new AutomationSchedulerService(
                familyService,
                ruleEvaluationService,
                debtService,
                7
        );
        Family activeFamily = new Family();
        activeFamily.setId(1L);
        activeFamily.setStatus(1);

        Family inactiveFamily = new Family();
        inactiveFamily.setId(2L);
        inactiveFamily.setStatus(0);

        when(familyService.listAll()).thenReturn(List.of(activeFamily, inactiveFamily));
        when(ruleEvaluationService.evaluate(1L, "2026-03")).thenReturn(
                new RuleDefinitionApiModels.EvaluateResponse("2026-03", 0, 0, 0, List.of())
        );

        AutomationSchedulerService.ScheduledJobResult result =
                automationSchedulerService.runRuleEvaluationForActiveFamilies("2026-03");

        assertEquals(1, result.processedFamilies());
        assertEquals(0, result.failedFamilies());
        verify(ruleEvaluationService).evaluate(1L, "2026-03");
    }

    @Test
    void runDebtReminderCheckForActiveFamiliesShouldContinueAfterFailure() {
        AutomationSchedulerService automationSchedulerService = new AutomationSchedulerService(
                familyService,
                ruleEvaluationService,
                debtService,
                7
        );
        Family failedFamily = new Family();
        failedFamily.setId(1L);
        failedFamily.setStatus(1);

        Family successFamily = new Family();
        successFamily.setId(2L);
        successFamily.setStatus(1);

        when(familyService.listAll()).thenReturn(List.of(failedFamily, successFamily));
        when(debtService.checkReminders(1L, 7)).thenThrow(new IllegalStateException("simulated failure"));
        when(debtService.checkReminders(2L, 7)).thenReturn(
                new DebtApiModels.ReminderCheckResponse(LocalDate.of(2026, 3, 16), 7, 0, List.of())
        );

        AutomationSchedulerService.ScheduledJobResult result =
                automationSchedulerService.runDebtReminderCheckForActiveFamilies(7);

        assertEquals(1, result.processedFamilies());
        assertEquals(1, result.failedFamilies());
        verify(debtService).checkReminders(1L, 7);
        verify(debtService).checkReminders(2L, 7);
    }
}
