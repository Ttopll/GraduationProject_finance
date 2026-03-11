package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.entity.RuleExecutionLog;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.repository.RuleExecutionLogRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.util.PeriodRangeUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class RuleEvaluationService {

    private final BudgetService budgetService;
    private final RuleDefinitionRepository ruleDefinitionRepository;
    private final RuleExecutionLogRepository ruleExecutionLogRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final NotificationService notificationService;
    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;

    public RuleEvaluationService(
            BudgetService budgetService,
            RuleDefinitionRepository ruleDefinitionRepository,
            RuleExecutionLogRepository ruleExecutionLogRepository,
            TransactionRecordRepository transactionRecordRepository,
            NotificationService notificationService,
            CategoryRepository categoryRepository,
            FamilyService familyService
    ) {
        this.budgetService = budgetService;
        this.ruleDefinitionRepository = ruleDefinitionRepository;
        this.ruleExecutionLogRepository = ruleExecutionLogRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.notificationService = notificationService;
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
    }

    @Transactional
    public RuleDefinitionApiModels.EvaluateResponse evaluate(Long familyId, String monthText) {
        familyService.getById(familyId);
        YearMonth month = PeriodRangeUtil.resolveMonth(monthText);
        List<String> details = new ArrayList<>();

        int budgetAlertCount = evaluateBudgetAlerts(familyId, month, details);
        RuleEvaluationResult ruleResult = evaluateRuleDefinitions(familyId, month, details);

        return new RuleDefinitionApiModels.EvaluateResponse(
                month.toString(),
                budgetAlertCount,
                ruleResult.triggeredRuleCount,
                budgetAlertCount + ruleResult.generatedNotificationCount,
                details
        );
    }

    private int evaluateBudgetAlerts(Long familyId, YearMonth month, List<String> details) {
        List<BudgetApiModels.UsageResponse> usageList = budgetService.getUsage(familyId, month.toString());
        int alertCount = 0;

        for (BudgetApiModels.UsageResponse usage : usageList) {
            if (!usage.alertTriggered()) {
                continue;
            }
            alertCount++;
            String title = usage.exceeded() ? "预算超支提醒" : "预算预警提醒";
            String content = usage.exceeded()
                    ? String.format(
                    Locale.ROOT,
                    "预算[%s]在%s已超支，预算%.2f元，实际支出%.2f元。",
                    usage.budgetName(),
                    usage.month(),
                    usage.budgetAmount(),
                    usage.spentAmount()
            )
                    : String.format(
                    Locale.ROOT,
                    "预算[%s]在%s使用率已达%.2f%%，预算%.2f元，已支出%.2f元。",
                    usage.budgetName(),
                    usage.month(),
                    usage.usageRatio().multiply(new BigDecimal("100")),
                    usage.budgetAmount(),
                    usage.spentAmount()
            );
            if (notificationService.createIfAbsentToday(
                    familyId,
                    null,
                    "BUDGET",
                    usage.budgetId(),
                    title,
                    content,
                    usage.exceeded() ? "WARN" : "INFO"
            ) != null) {
                details.add(title + " - " + content);
            }
        }
        return alertCount;
    }

    private RuleEvaluationResult evaluateRuleDefinitions(Long familyId, YearMonth month, List<String> details) {
        List<RuleDefinition> rules = ruleDefinitionRepository.findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(familyId, 1);
        Map<Long, String> categoryNameMap = buildCategoryNameMap(familyId);
        int triggeredRuleCount = 0;
        int notificationCount = 0;

        for (RuleDefinition rule : rules) {
            MetricContext metricContext = calculateMetric(rule, familyId, month, categoryNameMap);
            boolean triggered = compare(metricContext.metricValue, rule.getOperatorType(), rule.getThresholdValue());

            RuleExecutionLog executionLog = new RuleExecutionLog();
            executionLog.setRuleId(rule.getId());
            executionLog.setFamilyId(familyId);
            executionLog.setResultStatus(triggered ? "TRIGGERED" : "SKIPPED");
            executionLog.setMetricValue(metricContext.metricValue);
            executionLog.setContextJson(metricContext.contextJson);
            executionLog.setMessageSnapshot(triggered ? buildRuleMessage(rule, metricContext.metricLabel, month) : null);
            executionLog.setTriggerTime(LocalDateTime.now());
            ruleExecutionLogRepository.save(executionLog);

            if (!triggered) {
                continue;
            }
            triggeredRuleCount++;
            String message = buildRuleMessage(rule, metricContext.metricLabel, month);
            if (notificationService.createIfAbsentToday(
                    familyId,
                    null,
                    "RULE",
                    rule.getId(),
                    rule.getRuleName(),
                    message,
                    "WARN"
            ) != null) {
                notificationCount++;
                details.add("规则触发 - " + rule.getRuleName() + " - " + message);
            }
        }

        return new RuleEvaluationResult(triggeredRuleCount, notificationCount);
    }

    private MetricContext calculateMetric(
            RuleDefinition rule,
            Long familyId,
            YearMonth month,
            Map<Long, String> categoryNameMap
    ) {
        LocalDateTime[] range = "YEAR".equals(rule.getTimeScope())
                ? PeriodRangeUtil.yearRange(month.getYear())
                : PeriodRangeUtil.monthRange(month);

        List<TransactionRecord> records = transactionRecordRepository
                .findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                        familyId,
                        "EXPENSE",
                        range[0],
                        range[1]
                );

        BigDecimal metricValue = BigDecimal.ZERO;
        String metricLabel;
        if ("CATEGORY_EXPENSE".equals(rule.getMetricType())) {
            Long categoryId = rule.getCategoryId();
            metricValue = records.stream()
                    .filter(record -> categoryId != null && categoryId.equals(record.getCategoryId()))
                    .map(TransactionRecord::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            metricLabel = categoryNameMap.getOrDefault(categoryId, "未命名分类");
        } else {
            metricValue = records.stream()
                    .map(TransactionRecord::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            metricLabel = "家庭总支出";
        }

        String contextJson = String.format(
                Locale.ROOT,
                "{\"metricLabel\":\"%s\",\"metricValue\":%s,\"timeScope\":\"%s\",\"month\":\"%s\"}",
                metricLabel,
                metricValue.toPlainString(),
                rule.getTimeScope(),
                month
        );
        return new MetricContext(metricValue, metricLabel, contextJson);
    }

    private String buildRuleMessage(RuleDefinition rule, String metricLabel, YearMonth month) {
        return String.format(
                Locale.ROOT,
                "%s [%s] 在 %s 的值已达到规则阈值，当前阈值为 %.2f。",
                rule.getMessageTemplate(),
                metricLabel,
                month,
                rule.getThresholdValue()
        );
    }

    private boolean compare(BigDecimal actual, String operatorType, BigDecimal threshold) {
        int result = actual.compareTo(threshold);
        return switch (operatorType) {
            case "GT" -> result > 0;
            case "GTE" -> result >= 0;
            case "LT" -> result < 0;
            case "LTE" -> result <= 0;
            case "EQ" -> result == 0;
            default -> false;
        };
    }

    private Map<Long, String> buildCategoryNameMap(Long familyId) {
        Map<Long, String> result = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            result.put(category.getId(), category.getCategoryName());
        }
        return result;
    }

    private record MetricContext(BigDecimal metricValue, String metricLabel, String contextJson) {
    }

    private record RuleEvaluationResult(int triggeredRuleCount, int generatedNotificationCount) {
    }
}
