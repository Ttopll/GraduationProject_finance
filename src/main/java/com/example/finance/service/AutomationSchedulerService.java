package com.example.finance.service;

import com.example.finance.entity.Family;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AutomationSchedulerService {

    private static final Logger log = LoggerFactory.getLogger(AutomationSchedulerService.class);

    private final FamilyService familyService;
    private final RuleEvaluationService ruleEvaluationService;
    private final DebtService debtService;
    private final int debtReminderDaysAhead;

    public AutomationSchedulerService(
            FamilyService familyService,
            RuleEvaluationService ruleEvaluationService,
            DebtService debtService,
            @Value("${app.schedule.debt-reminder-days-ahead:7}") int debtReminderDaysAhead
    ) {
        this.familyService = familyService;
        this.ruleEvaluationService = ruleEvaluationService;
        this.debtService = debtService;
        this.debtReminderDaysAhead = debtReminderDaysAhead;
    }

    @Scheduled(cron = "${app.schedule.rule-evaluation-cron:0 10 1 * * *}")
    public void scheduledRuleEvaluation() {
        ScheduledJobResult result = runRuleEvaluationForActiveFamilies(null);
        log.info("Scheduled rule evaluation finished. processedFamilies={}, failedFamilies={}",
                result.processedFamilies(), result.failedFamilies());
    }

    @Scheduled(cron = "${app.schedule.debt-reminder-cron:0 0 9 * * *}")
    public void scheduledDebtReminderCheck() {
        ScheduledJobResult result = runDebtReminderCheckForActiveFamilies(debtReminderDaysAhead);
        log.info("Scheduled debt reminder check finished. processedFamilies={}, failedFamilies={}",
                result.processedFamilies(), result.failedFamilies());
    }

    public ScheduledJobResult runRuleEvaluationForActiveFamilies(String monthText) {
        int processedFamilies = 0;
        int failedFamilies = 0;

        for (Family family : activeFamilies()) {
            try {
                ruleEvaluationService.evaluate(family.getId(), monthText);
                processedFamilies++;
            } catch (RuntimeException exception) {
                failedFamilies++;
                log.warn("Rule evaluation failed for familyId={}", family.getId(), exception);
            }
        }

        return new ScheduledJobResult(processedFamilies, failedFamilies);
    }

    public ScheduledJobResult runDebtReminderCheckForActiveFamilies(Integer daysAhead) {
        int processedFamilies = 0;
        int failedFamilies = 0;
        int safeDaysAhead = (daysAhead == null || daysAhead < 0) ? debtReminderDaysAhead : daysAhead;

        for (Family family : activeFamilies()) {
            try {
                debtService.checkReminders(family.getId(), safeDaysAhead);
                processedFamilies++;
            } catch (RuntimeException exception) {
                failedFamilies++;
                log.warn("Debt reminder check failed for familyId={}", family.getId(), exception);
            }
        }

        return new ScheduledJobResult(processedFamilies, failedFamilies);
    }

    private List<Family> activeFamilies() {
        return familyService.listAll().stream()
                .filter(family -> Integer.valueOf(1).equals(family.getStatus()))
                .toList();
    }

    public record ScheduledJobResult(int processedFamilies, int failedFamilies) {
    }
}
