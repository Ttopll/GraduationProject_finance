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
import com.example.finance.util.RuleThresholdConfigUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
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
            MetricContext metricContext;
            try {
                metricContext = calculateMetric(rule, familyId, month, categoryNameMap);
            } catch (IllegalArgumentException exception) {
                saveFailedExecutionLog(rule, familyId, month, exception.getMessage());
                details.add("规则执行失败 - " + rule.getRuleName() + " - " + exception.getMessage());
                continue;
            }

            RuleExecutionLog executionLog = new RuleExecutionLog();
            executionLog.setRuleId(rule.getId());
            executionLog.setFamilyId(familyId);
            executionLog.setResultStatus(metricContext.triggered ? "TRIGGERED" : "SKIPPED");
            executionLog.setMetricValue(metricContext.metricValue);
            executionLog.setContextJson(metricContext.contextJson);
            executionLog.setMessageSnapshot(metricContext.triggered ? buildRuleMessage(rule, metricContext, month) : null);
            executionLog.setTriggerTime(LocalDateTime.now());
            ruleExecutionLogRepository.save(executionLog);

            if (!metricContext.triggered) {
                continue;
            }
            triggeredRuleCount++;
            String message = buildRuleMessage(rule, metricContext, month);
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
        return switch (rule.getRuleType()) {
            case "THRESHOLD" -> calculateThresholdMetric(rule, familyId, month, categoryNameMap);
            case "CONSECUTIVE_THRESHOLD" -> calculateConsecutiveThresholdMetric(rule, familyId, month, categoryNameMap);
            default -> throw new IllegalArgumentException("不支持的规则类型: " + rule.getRuleType());
        };
    }

    private MetricContext calculateThresholdMetric(
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

        BigDecimal metricValue = sumMetricValue(rule, records);
        String metricLabel = resolveMetricLabel(rule, categoryNameMap);

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("ruleType", rule.getRuleType());
        context.put("metricLabel", metricLabel);
        context.put("metricValue", metricValue);
        context.put("timeScope", rule.getTimeScope());
        context.put("month", month.toString());
        context.put("operatorType", rule.getOperatorType());
        context.put("thresholdValue", rule.getThresholdValue());

        return new MetricContext(
                metricValue,
                metricLabel,
                RuleThresholdConfigUtil.toJson(context),
                compare(metricValue, rule.getOperatorType(), rule.getThresholdValue()),
                null
        );
    }

    private MetricContext calculateConsecutiveThresholdMetric(
            RuleDefinition rule,
            Long familyId,
            YearMonth month,
            Map<Long, String> categoryNameMap
    ) {
        int consecutiveMonths = RuleThresholdConfigUtil.parseConsecutiveMonths(rule.getThresholdJson());
        YearMonth startMonth = month.minusMonths(consecutiveMonths - 1L);
        LocalDateTime start = startMonth.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);

        List<TransactionRecord> records = transactionRecordRepository
                .findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                        familyId,
                        "EXPENSE",
                        start,
                        end
                );

        Map<YearMonth, BigDecimal> monthlyTotals = new LinkedHashMap<>();
        for (int offset = 0; offset < consecutiveMonths; offset++) {
            monthlyTotals.put(startMonth.plusMonths(offset), BigDecimal.ZERO);
        }

        for (TransactionRecord record : records) {
            if (!matchesMetric(rule, record)) {
                continue;
            }
            YearMonth recordMonth = YearMonth.from(record.getTransactionTime());
            if (!monthlyTotals.containsKey(recordMonth)) {
                continue;
            }
            monthlyTotals.put(recordMonth, monthlyTotals.get(recordMonth).add(record.getAmount()));
        }

        long matchedMonthCount = monthlyTotals.values().stream()
                .filter(value -> compare(value, rule.getOperatorType(), rule.getThresholdValue()))
                .count();
        String metricLabel = resolveMetricLabel(rule, categoryNameMap);
        BigDecimal currentMonthValue = monthlyTotals.getOrDefault(month, BigDecimal.ZERO);

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("ruleType", rule.getRuleType());
        context.put("metricLabel", metricLabel);
        context.put("metricValue", currentMonthValue);
        context.put("timeScope", rule.getTimeScope());
        context.put("month", month.toString());
        context.put("operatorType", rule.getOperatorType());
        context.put("thresholdValue", rule.getThresholdValue());
        context.put("consecutiveMonths", consecutiveMonths);
        context.put("matchedMonthCount", matchedMonthCount);
        context.put("monthlyValues", buildMonthlyValueItems(monthlyTotals));

        return new MetricContext(
                currentMonthValue,
                metricLabel,
                RuleThresholdConfigUtil.toJson(context),
                matchedMonthCount == consecutiveMonths,
                consecutiveMonths
        );
    }

    private String buildRuleMessage(RuleDefinition rule, MetricContext metricContext, YearMonth month) {
        if (metricContext.consecutiveMonths != null) {
            return String.format(
                    Locale.ROOT,
                    "%s [%s] 截至 %s 已连续 %d 个月达到规则阈值，当前月值为 %.2f，阈值为 %.2f。",
                    rule.getMessageTemplate(),
                    metricContext.metricLabel,
                    month,
                    metricContext.consecutiveMonths,
                    metricContext.metricValue,
                    rule.getThresholdValue()
            );
        }
        return String.format(
                Locale.ROOT,
                "%s [%s] 在 %s 的值已达到规则阈值，当前阈值为 %.2f。",
                rule.getMessageTemplate(),
                metricContext.metricLabel,
                month,
                rule.getThresholdValue()
        );
    }

    private boolean compare(BigDecimal actual, String operatorType, BigDecimal threshold) {
        if (actual == null || threshold == null || operatorType == null) {
            throw new IllegalArgumentException("规则阈值配置不完整");
        }
        int result = actual.compareTo(threshold);
        return switch (operatorType) {
            case "GT" -> result > 0;
            case "GTE" -> result >= 0;
            case "LT" -> result < 0;
            case "LTE" -> result <= 0;
            case "EQ" -> result == 0;
            default -> throw new IllegalArgumentException("不支持的比较运算符: " + operatorType);
        };
    }

    private Map<Long, String> buildCategoryNameMap(Long familyId) {
        Map<Long, String> result = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            result.put(category.getId(), category.getCategoryName());
        }
        return result;
    }

    private String resolveMetricLabel(RuleDefinition rule, Map<Long, String> categoryNameMap) {
        if ("CATEGORY_EXPENSE".equals(rule.getMetricType())) {
            return categoryNameMap.getOrDefault(rule.getCategoryId(), "未命名分类");
        }
        return "家庭总支出";
    }

    private BigDecimal sumMetricValue(RuleDefinition rule, List<TransactionRecord> records) {
        return records.stream()
                .filter(record -> matchesMetric(rule, record))
                .map(TransactionRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private boolean matchesMetric(RuleDefinition rule, TransactionRecord record) {
        if ("CATEGORY_EXPENSE".equals(rule.getMetricType())) {
            return rule.getCategoryId() != null && rule.getCategoryId().equals(record.getCategoryId());
        }
        if ("FAMILY_EXPENSE".equals(rule.getMetricType())) {
            return true;
        }
        throw new IllegalArgumentException("不支持的指标类型: " + rule.getMetricType());
    }

    private List<Map<String, Object>> buildMonthlyValueItems(Map<YearMonth, BigDecimal> monthlyTotals) {
        List<Map<String, Object>> items = new ArrayList<>();
        for (Map.Entry<YearMonth, BigDecimal> entry : monthlyTotals.entrySet()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("month", entry.getKey().toString());
            item.put("value", entry.getValue());
            items.add(item);
        }
        return items;
    }

    private void saveFailedExecutionLog(RuleDefinition rule, Long familyId, YearMonth month, String message) {
        RuleExecutionLog executionLog = new RuleExecutionLog();
        executionLog.setRuleId(rule.getId());
        executionLog.setFamilyId(familyId);
        executionLog.setResultStatus("FAILED");
        executionLog.setMetricValue(null);
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("ruleType", rule.getRuleType());
        context.put("month", month.toString());
        context.put("error", message);
        executionLog.setContextJson(RuleThresholdConfigUtil.toJson(context));
        executionLog.setMessageSnapshot(truncateMessage(message));
        executionLog.setTriggerTime(LocalDateTime.now());
        ruleExecutionLogRepository.save(executionLog);
    }

    private String truncateMessage(String message) {
        if (message == null || message.length() <= 255) {
            return message;
        }
        return message.substring(0, 255);
    }

    private record MetricContext(
            BigDecimal metricValue,
            String metricLabel,
            String contextJson,
            boolean triggered,
            Integer consecutiveMonths
    ) {
    }

    private record RuleEvaluationResult(int triggeredRuleCount, int generatedNotificationCount) {
    }
}
