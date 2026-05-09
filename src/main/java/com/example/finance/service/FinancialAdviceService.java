package com.example.finance.service;

import com.example.finance.dto.FinancialAdviceApiModels;
import com.example.finance.dto.FinancialAnalysisApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.Debt;
import com.example.finance.entity.FamilyFinancialProfile;
import com.example.finance.entity.FinancialAdvice;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.DebtRepository;
import com.example.finance.repository.FamilyFinancialProfileRepository;
import com.example.finance.repository.FinancialAdviceRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.util.PeriodRangeUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class FinancialAdviceService {

    private static final String ACTIVE_DEBT_STATUS = "ACTIVE";
    private static final BigDecimal DEFAULT_SAVINGS_TARGET_RATE = new BigDecimal("0.20");
    private static final int DEFAULT_EMERGENCY_FUND_MONTHS = 3;
    private static final BigDecimal HIGH_EXPENSE_RATIO = new BigDecimal("0.40");
    private static final BigDecimal HIGH_DEBT_RATIO = new BigDecimal("1.00");
    private static final BigDecimal MODERATE_DEBT_RATIO = new BigDecimal("0.50");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final FinancialAdviceRepository financialAdviceRepository;
    private final FamilyFinancialProfileRepository familyFinancialProfileRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final AccountRepository accountRepository;
    private final DebtRepository debtRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;
    private final FamilyAccessService familyAccessService;
    private final FinancialAnalysisService financialAnalysisService;

    public FinancialAdviceService(
            FinancialAdviceRepository financialAdviceRepository,
            FamilyFinancialProfileRepository familyFinancialProfileRepository,
            TransactionRecordRepository transactionRecordRepository,
            AccountRepository accountRepository,
            DebtRepository debtRepository,
            CategoryRepository categoryRepository,
            FamilyService familyService,
            FamilyAccessService familyAccessService,
            FinancialAnalysisService financialAnalysisService
    ) {
        this.financialAdviceRepository = financialAdviceRepository;
        this.familyFinancialProfileRepository = familyFinancialProfileRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.accountRepository = accountRepository;
        this.debtRepository = debtRepository;
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
        this.familyAccessService = familyAccessService;
        this.financialAnalysisService = financialAnalysisService;
    }

    public List<FinancialAdvice> list(Long familyId, String status) {
        familyService.getById(familyId);
        familyAccessService.requireFamilyRead(familyId);
        if (!StringUtils.hasText(status)) {
            return financialAdviceRepository.findByFamilyIdOrderByGeneratedAtDescIdDesc(familyId);
        }
        return financialAdviceRepository.findByFamilyIdAndStatusOrderByGeneratedAtDescIdDesc(
                familyId,
                status.trim().toUpperCase(Locale.ROOT)
        );
    }

    public FinancialAdvice getById(Long adviceId) {
        FinancialAdvice advice = financialAdviceRepository.findById(adviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "financial advice not found"));
        familyAccessService.requireFamilyRead(advice.getFamilyId());
        return advice;
    }

    @Transactional
    public FinancialAdvice markRead(Long adviceId) {
        FinancialAdvice advice = getById(adviceId);
        advice.setStatus("READ");
        return financialAdviceRepository.save(advice);
    }

    @Transactional
    public FinancialAdvice markUnread(Long adviceId) {
        FinancialAdvice advice = getById(adviceId);
        advice.setStatus("UNREAD");
        return financialAdviceRepository.save(advice);
    }

    @Transactional
    public void delete(Long adviceId) {
        FinancialAdvice advice = getById(adviceId);
        financialAdviceRepository.delete(advice);
    }

    public FinancialAdviceApiModels.GenerateResponse generate(Long familyId, String monthText) {
        familyService.getById(familyId);
        YearMonth month = PeriodRangeUtil.resolveMonth(monthText);
        LocalDateTime[] range = PeriodRangeUtil.monthRange(month);

        FamilyFinancialProfile profile = familyFinancialProfileRepository.findByFamilyId(familyId)
                .orElseGet(() -> {
                    FamilyFinancialProfile defaultProfile = new FamilyFinancialProfile();
                    defaultProfile.setFamilyId(familyId);
                    defaultProfile.setRiskPreference("LOW");
                    return defaultProfile;
                });

        List<TransactionRecord> incomes = transactionRecordRepository
                .findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                        familyId,
                        "INCOME",
                        range[0],
                        range[1]
                );
        List<TransactionRecord> expenses = transactionRecordRepository
                .findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                        familyId,
                        "EXPENSE",
                        range[0],
                        range[1]
                );
        List<Account> accounts = accountRepository.findByFamilyIdOrderByIdDesc(familyId);
        List<Debt> debts = debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, ACTIVE_DEBT_STATUS);

        BigDecimal totalIncome = sumAmounts(incomes);
        BigDecimal totalExpense = sumAmounts(expenses);
        BigDecimal savingsAmount = totalIncome.subtract(totalExpense);
        BigDecimal savingsRate = totalIncome.compareTo(BigDecimal.ZERO) > 0
                ? savingsAmount.divide(totalIncome, 4, RoundingMode.HALF_UP)
                : null;
        BigDecimal totalAccountBalance = accounts.stream()
                .map(Account::getCurrentBalance)
                .map(this::defaultAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDebtBalance = debts.stream()
                .map(Debt::getCurrentBalance)
                .map(this::defaultAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        ExpenseCategorySummary topExpenseCategory = resolveTopExpenseCategory(familyId, expenses, totalExpense);
        FinancialAnalysisApiModels.DashboardResponse dashboard = financialAnalysisService.getDashboard(familyId, month.toString(), 6);
        String snapshotJson = buildSnapshotJson(
                month,
                totalIncome,
                totalExpense,
                savingsAmount,
                savingsRate,
                totalAccountBalance,
                totalDebtBalance,
                profile,
                topExpenseCategory,
                dashboard
        );

        List<FinancialAdvice> createdAdvices = buildAdvices(
                familyId,
                month,
                totalIncome,
                totalExpense,
                savingsRate,
                totalAccountBalance,
                totalDebtBalance,
                profile,
                topExpenseCategory,
                dashboard,
                snapshotJson
        );

        return new FinancialAdviceApiModels.GenerateResponse(
                month.toString(),
                totalIncome,
                totalExpense,
                savingsAmount,
                savingsRate,
                totalAccountBalance,
                totalDebtBalance,
                createdAdvices.size(),
                createdAdvices.stream().map(FinancialAdviceService::toResponse).toList()
        );
    }

    private List<FinancialAdvice> buildAdvices(
            Long familyId,
            YearMonth month,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal savingsRate,
            BigDecimal totalAccountBalance,
            BigDecimal totalDebtBalance,
            FamilyFinancialProfile profile,
            ExpenseCategorySummary topExpenseCategory,
            FinancialAnalysisApiModels.DashboardResponse dashboard,
            String snapshotJson
    ) {
        List<FinancialAdvice> advices = new ArrayList<>();
        BigDecimal savingsTarget = profile.getSavingsTargetRate() == null
                ? DEFAULT_SAVINGS_TARGET_RATE
                : profile.getSavingsTargetRate();
        int emergencyFundMonths = profile.getEmergencyFundMonths() == null
                ? DEFAULT_EMERGENCY_FUND_MONTHS
                : profile.getEmergencyFundMonths();
        BigDecimal monthlySurplus = totalIncome.subtract(totalExpense);
        BigDecimal emergencyFundTarget = totalExpense.multiply(BigDecimal.valueOf(emergencyFundMonths));
        BigDecimal emergencyFundGap = emergencyFundTarget.subtract(totalAccountBalance).max(BigDecimal.ZERO);
        BigDecimal investableSurplus = monthlySurplus.max(BigDecimal.ZERO);

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && savingsRate != null && savingsRate.compareTo(savingsTarget) < 0) {
            String title = "储蓄率低于目标";
            String content = String.format(
                    Locale.ROOT,
                    "%s 的储蓄率为 %.2f%%，低于目标 %.2f%%。本月可结余 %.2f，建议先把固定储蓄设置为收入的 %.0f%%，再压缩弹性消费。",
                    month,
                    savingsRate.multiply(new BigDecimal("100")),
                    savingsTarget.multiply(new BigDecimal("100")),
                    monthlySurplus,
                    savingsTarget.multiply(new BigDecimal("100"))
            );
            saveAdviceIfAbsentToday(advices, familyId, "SAVINGS", title, content, "HIGH", snapshotJson);
        }

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && savingsRate != null && savingsRate.compareTo(savingsTarget) >= 0) {
            String riskPreference = profile.getRiskPreference() == null ? "LOW" : profile.getRiskPreference();
            String title = "可考虑分层理财配置";
            String content = String.format(
                    Locale.ROOT,
                    "%s 的储蓄率达到 %.2f%%。结合当前风险偏好 %s，建议先保留应急资金，再把预计可支配结余 %.2f 分层配置到%s。",
                    month,
                    savingsRate.multiply(new BigDecimal("100")),
                    riskPreference,
                    investableSurplus,
                    investmentSuggestion(riskPreference)
            );
            saveAdviceIfAbsentToday(advices, familyId, "INVESTMENT", title, content, "NORMAL", snapshotJson);
        }

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 || totalExpense.compareTo(BigDecimal.ZERO) > 0) {
            AllocationPlan allocationPlan = buildAllocationPlan(profile, totalIncome, totalExpense, totalAccountBalance, totalDebtBalance);
            AllocationAmount allocationAmount = buildAllocationAmount(investableSurplus, allocationPlan);
            String title = "家庭资产配置比例建议";
            String content = String.format(
                    Locale.ROOT,
                    "结合风险偏好 %s、储蓄率 %s、债务余额 %.2f，建议按应急资金 %d%%、债务偿还 %d%%、稳健储蓄 %d%%、长期投资 %d%% 分配可支配结余。按本月结余估算，对应金额约为 %.2f、%.2f、%.2f、%.2f。",
                    normalizeRiskPreference(profile),
                    percentText(savingsRate),
                    totalDebtBalance,
                    allocationPlan.emergencyFundPercent,
                    allocationPlan.debtRepaymentPercent,
                    allocationPlan.stableSavingPercent,
                    allocationPlan.longTermInvestmentPercent,
                    allocationAmount.emergencyFundAmount,
                    allocationAmount.debtRepaymentAmount,
                    allocationAmount.stableSavingAmount,
                    allocationAmount.longTermInvestmentAmount
            );
            saveAdviceIfAbsentToday(advices, familyId, "ALLOCATION", title, content, "NORMAL", snapshotJson);
        }

        buildHealthDrivenAdvices(advices, familyId, month, dashboard, snapshotJson);

        if (totalExpense.compareTo(BigDecimal.ZERO) > 0) {
            if (totalAccountBalance.compareTo(emergencyFundTarget) < 0) {
                String title = "应急资金覆盖不足";
                String content = String.format(
                        Locale.ROOT,
                        "当前流动资金为 %.2f，低于约 %d 个月支出的应急目标 %.2f，缺口约 %.2f。建议先补足应急储备，再安排长期投资。",
                        totalAccountBalance,
                        emergencyFundMonths,
                        emergencyFundTarget,
                        emergencyFundGap
                );
                saveAdviceIfAbsentToday(advices, familyId, "EMERGENCY_FUND", title, content, "HIGH", snapshotJson);
            }
        }

        if (totalDebtBalance.compareTo(BigDecimal.ZERO) > 0 && totalAccountBalance.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal debtPressureRatio = totalDebtBalance.divide(totalAccountBalance, 4, RoundingMode.HALF_UP);
            if (debtPressureRatio.compareTo(HIGH_DEBT_RATIO) >= 0) {
                String title = "当前债务压力较高";
                String content = String.format(
                        Locale.ROOT,
                        "当前债务余额 %.2f 已达到流动资金 %.2f 的 %.2f%%。建议优先安排还款，降低财务杠杆。",
                        totalDebtBalance,
                        totalAccountBalance,
                        debtPressureRatio.multiply(new BigDecimal("100"))
                );
                saveAdviceIfAbsentToday(advices, familyId, "DEBT", title, content, "HIGH", snapshotJson);
            } else if (debtPressureRatio.compareTo(MODERATE_DEBT_RATIO) >= 0) {
                String title = "债务压力需要持续关注";
                String content = String.format(
                        Locale.ROOT,
                        "当前债务余额 %.2f，约为流动资金 %.2f 的 %.2f%%。建议优先偿还高利率债务，并把新增分期控制在可结余范围内。",
                        totalDebtBalance,
                        totalAccountBalance,
                        debtPressureRatio.multiply(new BigDecimal("100"))
                );
                saveAdviceIfAbsentToday(advices, familyId, "DEBT", title, content, "NORMAL", snapshotJson);
            }
        } else if (totalDebtBalance.compareTo(BigDecimal.ZERO) > 0) {
            String title = "存在债务但流动资金偏低";
            String content = String.format(
                    Locale.ROOT,
                    "当前债务余额 %.2f，流动资金较低。建议谨慎新增消费和分期，并优先维护现金流。",
                    totalDebtBalance
            );
            saveAdviceIfAbsentToday(advices, familyId, "DEBT", title, content, "HIGH", snapshotJson);
        }

        if (topExpenseCategory != null && topExpenseCategory.ratio.compareTo(HIGH_EXPENSE_RATIO) >= 0) {
            String title = "消费结构集中度偏高";
            String content = String.format(
                    Locale.ROOT,
                    "%s 在 %s 的支出占比达到 %.2f%%。建议复盘该类消费明细，评估是否存在可压缩空间。",
                    topExpenseCategory.categoryName,
                    month,
                    topExpenseCategory.ratio.multiply(new BigDecimal("100"))
            );
            saveAdviceIfAbsentToday(advices, familyId, "CONSUMPTION", title, content, "NORMAL", snapshotJson);
        }

        if (totalIncome.compareTo(BigDecimal.ZERO) == 0 && totalExpense.compareTo(BigDecimal.ZERO) > 0) {
            String title = "本月未记录收入但已有支出";
            String content = String.format(
                    Locale.ROOT,
                    "%s 目前记录到支出 %.2f，但未记录收入。建议先核对账单导入和收入登记，避免分析偏差。",
                    month,
                    totalExpense
            );
            saveAdviceIfAbsentToday(advices, familyId, "SAVINGS", title, content, "NORMAL", snapshotJson);
        }

        if (dashboard != null && dashboard.keyIndicators() != null) {
            String title = "家庭理财执行顺序建议";
            String content = buildExecutionPathAdvice(
                    emergencyFundGap,
                    totalDebtBalance,
                    dashboard.keyIndicators().debtToAssetRatio(),
                    savingsRate,
                    normalizeRiskPreference(profile)
            );
            saveAdviceIfAbsentToday(advices, familyId, "EXECUTION_PATH", title, content, "NORMAL", snapshotJson);
        }

        String goalType = resolveGoalType(profile.getInvestmentPreferenceJson());
        if (goalType != null) {
            String title = "理财目标执行建议";
            String content = String.format(
                    Locale.ROOT,
                    "当前家庭目标为%s。建议先保证 %d 个月应急资金，再将月度结余按目标专户持续积累；若本月可结余为 %.2f，可先按 50%% 目标储备、30%% 稳健储蓄、20%% 机动资金执行。",
                    goalTypeLabel(goalType),
                    emergencyFundMonths,
                    investableSurplus
            );
            saveAdviceIfAbsentToday(advices, familyId, "GOAL", title, content, "NORMAL", snapshotJson);
        }

        return advices;
    }

    private void buildHealthDrivenAdvices(
            List<FinancialAdvice> advices,
            Long familyId,
            YearMonth month,
            FinancialAnalysisApiModels.DashboardResponse dashboard,
            String snapshotJson
    ) {
        if (dashboard == null || dashboard.healthScore() == null) {
            return;
        }

        FinancialAnalysisApiModels.HealthScore healthScore = dashboard.healthScore();
        String suggestionLevel = healthScore.score() != null && healthScore.score() < 70 ? "HIGH" : "NORMAL";
        String title = "家庭财务健康评分建议";
        String content = String.format(
                Locale.ROOT,
                "%s 家庭财务健康评分为 %d 分，评级为%s。建议优先处理评分最低的指标，并结合预算执行情况逐项改善。",
                month,
                healthScore.score() == null ? 0 : healthScore.score(),
                healthScore.levelLabel() == null ? "待观察" : healthScore.levelLabel()
        );
        saveAdviceIfAbsentToday(advices, familyId, "HEALTH_SCORE", title, content, suggestionLevel, snapshotJson);

        FinancialAnalysisApiModels.HealthScoreFactor weakestFactor = healthScore.factors() == null
                ? null
                : healthScore.factors().stream()
                .min((left, right) -> factorRate(left).compareTo(factorRate(right)))
                .orElse(null);
        if (weakestFactor == null) {
            return;
        }

        String weakTitle = "优先改善：" + weakestFactor.factorName();
        String weakContent = switch (weakestFactor.factorCode()) {
            case "SAVINGS_RATE" -> "当前结余能力是财务健康短板。建议设置工资到账后的固定转入金额，先储蓄后消费。";
            case "DEBT_RATIO" -> "当前负债指标拖累评分。建议优先偿还高利率债务，减少新增分期和透支消费。";
            case "LIQUIDITY" -> "当前应急资金覆盖不足。建议先建立 3 个月支出规模的备用金，再考虑长期投资。";
            case "BUDGET_RISK" -> "当前预算执行存在风险。建议重点查看超支或预警分类，调整预算额度或减少对应消费。";
            case "EXPENSE_STRUCTURE" -> "当前消费结构集中度偏高。建议检查最大支出分类，识别非必要支出并设置分类预算。";
            default -> "建议根据评分明细逐项复盘家庭财务结构。";
        };
        saveAdviceIfAbsentToday(advices, familyId, "HEALTH_FACTOR", weakTitle, weakContent, suggestionLevel, snapshotJson);
    }

    private void saveAdviceIfAbsentToday(
            List<FinancialAdvice> collector,
            Long familyId,
            String adviceType,
            String title,
            String content,
            String suggestionLevel,
            String snapshotJson
    ) {
        LocalDateTime start = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime end = start.plusDays(1).minusNanos(1);
        boolean exists = financialAdviceRepository.existsByFamilyIdAndAdviceTypeAndTitleAndGeneratedAtBetween(
                familyId,
                adviceType,
                title,
                start,
                end
        );
        if (exists) {
            return;
        }

        FinancialAdvice advice = new FinancialAdvice();
        advice.setFamilyId(familyId);
        advice.setRuleId(null);
        advice.setAdviceType(adviceType);
        advice.setTitle(title);
        advice.setContent(content);
        advice.setSuggestionLevel(suggestionLevel);
        advice.setSnapshotJson(snapshotJson);
        advice.setStatus("UNREAD");
        collector.add(financialAdviceRepository.save(advice));
    }

    private ExpenseCategorySummary resolveTopExpenseCategory(
            Long familyId,
            List<TransactionRecord> expenses,
            BigDecimal totalExpense
    ) {
        if (totalExpense.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        Map<Long, BigDecimal> expenseByCategory = new HashMap<>();
        for (TransactionRecord expense : expenses) {
            if (expense.getCategoryId() == null) {
                continue;
            }
            expenseByCategory.merge(expense.getCategoryId(), expense.getAmount(), BigDecimal::add);
        }
        if (expenseByCategory.isEmpty()) {
            return null;
        }

        Map<Long, String> categoryNameMap = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            categoryNameMap.put(category.getId(), category.getCategoryName());
        }

        Map.Entry<Long, BigDecimal> topEntry = expenseByCategory.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .orElse(null);
        if (topEntry == null) {
            return null;
        }

        BigDecimal ratio = topEntry.getValue().divide(totalExpense, 4, RoundingMode.HALF_UP);
        return new ExpenseCategorySummary(topEntry.getKey(), categoryNameMap.getOrDefault(topEntry.getKey(), "未分类"), ratio);
    }

    private String buildSnapshotJson(
            YearMonth month,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal savingsAmount,
            BigDecimal savingsRate,
            BigDecimal totalAccountBalance,
            BigDecimal totalDebtBalance,
            FamilyFinancialProfile profile,
            ExpenseCategorySummary topExpenseCategory,
            FinancialAnalysisApiModels.DashboardResponse dashboard
    ) {
        StringBuilder builder = new StringBuilder();
        builder.append("{")
                .append("\"month\":\"").append(month).append("\",")
                .append("\"totalIncome\":").append(totalIncome.toPlainString()).append(",")
                .append("\"totalExpense\":").append(totalExpense.toPlainString()).append(",")
                .append("\"savingsAmount\":").append(savingsAmount.toPlainString()).append(",")
                .append("\"savingsRate\":").append(savingsRate == null ? "null" : savingsRate.toPlainString()).append(",")
                .append("\"totalAccountBalance\":").append(totalAccountBalance.toPlainString()).append(",")
                .append("\"totalDebtBalance\":").append(totalDebtBalance.toPlainString()).append(",")
                .append("\"riskPreference\":").append(jsonString(profile.getRiskPreference())).append(",")
                .append("\"savingsTargetRate\":").append(
                        profile.getSavingsTargetRate() == null ? "null" : profile.getSavingsTargetRate().toPlainString()
                ).append(",")
                .append("\"emergencyFundMonths\":").append(
                        profile.getEmergencyFundMonths() == null ? "null" : profile.getEmergencyFundMonths()
                ).append(",")
                .append("\"topExpenseCategory\":").append(
                        topExpenseCategory == null ? "null" : jsonString(topExpenseCategory.categoryName)
                ).append(",")
                .append("\"topExpenseRatio\":").append(
                        topExpenseCategory == null ? "null" : topExpenseCategory.ratio.toPlainString()
                ).append(",")
                .append("\"investmentPreference\":").append(jsonString(profile.getInvestmentPreferenceJson()))
                .append(",")
                .append("\"healthScore\":").append(
                        dashboard == null || dashboard.healthScore() == null || dashboard.healthScore().score() == null
                                ? "null"
                                : dashboard.healthScore().score()
                ).append(",")
                .append("\"healthLevel\":").append(
                        dashboard == null || dashboard.healthScore() == null
                                ? "null"
                                : jsonString(dashboard.healthScore().levelLabel())
                ).append(",")
                .append("\"debtToAssetRatio\":").append(
                        dashboard == null || dashboard.keyIndicators() == null || dashboard.keyIndicators().debtToAssetRatio() == null
                                ? "null"
                                : dashboard.keyIndicators().debtToAssetRatio().toPlainString()
                ).append(",")
                .append("\"liquidityCoverageMonths\":").append(
                        dashboard == null || dashboard.keyIndicators() == null || dashboard.keyIndicators().liquidityCoverageMonths() == null
                                ? "null"
                                : dashboard.keyIndicators().liquidityCoverageMonths().toPlainString()
                )
                .append("}");
        return builder.toString();
    }

    private BigDecimal factorRate(FinancialAnalysisApiModels.HealthScoreFactor factor) {
        if (factor == null || factor.maxScore() == null || factor.maxScore() == 0 || factor.factorScore() == null) {
            return BigDecimal.ONE;
        }
        return BigDecimal.valueOf(factor.factorScore())
                .divide(BigDecimal.valueOf(factor.maxScore()), 4, RoundingMode.HALF_UP);
    }

    private String investmentSuggestion(String riskPreference) {
        return switch (riskPreference) {
            case "HIGH" -> "指数基金、权益类组合等波动较高资产";
            case "MEDIUM" -> "债券与权益混合配置或中低波动基金";
            default -> "存款、货币基金、短债等低风险品种";
        };
    }

    private AllocationPlan buildAllocationPlan(
            FamilyFinancialProfile profile,
            BigDecimal totalIncome,
            BigDecimal totalExpense,
            BigDecimal totalAccountBalance,
            BigDecimal totalDebtBalance
    ) {
        String riskPreference = normalizeRiskPreference(profile);
        BigDecimal monthlySurplus = totalIncome.subtract(totalExpense);
        boolean debtPressure = totalDebtBalance.compareTo(BigDecimal.ZERO) > 0
                && totalAccountBalance.compareTo(BigDecimal.ZERO) > 0
                && totalDebtBalance.divide(totalAccountBalance, 4, RoundingMode.HALF_UP).compareTo(new BigDecimal("0.50")) >= 0;
        boolean weakSurplus = monthlySurplus.compareTo(BigDecimal.ZERO) <= 0;

        if (weakSurplus) {
            return new AllocationPlan(50, debtPressure ? 30 : 20, 30, 0);
        }
        if (debtPressure) {
            return new AllocationPlan(30, 35, 25, 10);
        }
        return switch (riskPreference) {
            case "HIGH" -> new AllocationPlan(20, 10, 25, 45);
            case "MEDIUM" -> new AllocationPlan(25, 15, 35, 25);
            default -> new AllocationPlan(35, 15, 40, 10);
        };
    }

    private AllocationAmount buildAllocationAmount(BigDecimal investableSurplus, AllocationPlan allocationPlan) {
        return new AllocationAmount(
                percentAmount(investableSurplus, allocationPlan.emergencyFundPercent),
                percentAmount(investableSurplus, allocationPlan.debtRepaymentPercent),
                percentAmount(investableSurplus, allocationPlan.stableSavingPercent),
                percentAmount(investableSurplus, allocationPlan.longTermInvestmentPercent)
        );
    }

    private BigDecimal percentAmount(BigDecimal amount, int percent) {
        return amount.multiply(BigDecimal.valueOf(percent))
                .divide(ONE_HUNDRED, 2, RoundingMode.HALF_UP);
    }

    private String buildExecutionPathAdvice(
            BigDecimal emergencyFundGap,
            BigDecimal totalDebtBalance,
            BigDecimal debtToAssetRatio,
            BigDecimal savingsRate,
            String riskPreference
    ) {
        List<String> steps = new ArrayList<>();
        if (emergencyFundGap.compareTo(BigDecimal.ZERO) > 0) {
            steps.add("先补足应急资金缺口约 " + emergencyFundGap.setScale(2, RoundingMode.HALF_UP));
        }
        if (totalDebtBalance.compareTo(BigDecimal.ZERO) > 0
                && debtToAssetRatio != null
                && debtToAssetRatio.compareTo(MODERATE_DEBT_RATIO) >= 0) {
            steps.add("再降低负债率，优先处理短期或高利率债务");
        }
        if (savingsRate == null || savingsRate.compareTo(DEFAULT_SAVINGS_TARGET_RATE) < 0) {
            steps.add("随后把储蓄率稳定到 20% 左右");
        }
        steps.add("最后按" + riskLabel(riskPreference) + "配置长期资金");
        return String.join("；", steps) + "。";
    }

    private String riskLabel(String riskPreference) {
        return switch (riskPreference) {
            case "HIGH" -> "进取型";
            case "MEDIUM" -> "稳健型";
            default -> "保守型";
        };
    }

    private String normalizeRiskPreference(FamilyFinancialProfile profile) {
        return profile.getRiskPreference() == null ? "LOW" : profile.getRiskPreference().trim().toUpperCase(Locale.ROOT);
    }

    private String percentText(BigDecimal ratio) {
        if (ratio == null) {
            return "暂无";
        }
        return ratio.multiply(ONE_HUNDRED).setScale(2, RoundingMode.HALF_UP) + "%";
    }

    private String resolveGoalType(String preferenceJson) {
        if (!StringUtils.hasText(preferenceJson)) {
            return null;
        }
        String normalized = preferenceJson.toUpperCase(Locale.ROOT);
        if (normalized.contains("HOUSE")) {
            return "HOUSE";
        }
        if (normalized.contains("CAR")) {
            return "CAR";
        }
        if (normalized.contains("EDUCATION")) {
            return "EDUCATION";
        }
        if (normalized.contains("RETIREMENT")) {
            return "RETIREMENT";
        }
        if (normalized.contains("TRAVEL")) {
            return "TRAVEL";
        }
        return "OTHER";
    }

    private String goalTypeLabel(String goalType) {
        return switch (goalType) {
            case "HOUSE" -> "购房准备";
            case "CAR" -> "购车准备";
            case "EDUCATION" -> "教育储备";
            case "RETIREMENT" -> "养老储备";
            case "TRAVEL" -> "旅行计划";
            default -> "家庭储蓄";
        };
    }

    private BigDecimal sumAmounts(List<TransactionRecord> records) {
        return records.stream()
                .map(TransactionRecord::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String jsonString(String value) {
        if (value == null) {
            return "null";
        }
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    public static FinancialAdviceApiModels.Response toResponse(FinancialAdvice advice) {
        return new FinancialAdviceApiModels.Response(
                advice.getId(),
                advice.getFamilyId(),
                advice.getRuleId(),
                advice.getAdviceType(),
                advice.getTitle(),
                advice.getContent(),
                advice.getSuggestionLevel(),
                advice.getSnapshotJson(),
                advice.getStatus(),
                advice.getGeneratedAt()
        );
    }

    private record ExpenseCategorySummary(Long categoryId, String categoryName, BigDecimal ratio) {
    }

    private record AllocationPlan(
            int emergencyFundPercent,
            int debtRepaymentPercent,
            int stableSavingPercent,
            int longTermInvestmentPercent
    ) {
    }

    private record AllocationAmount(
            BigDecimal emergencyFundAmount,
            BigDecimal debtRepaymentAmount,
            BigDecimal stableSavingAmount,
            BigDecimal longTermInvestmentAmount
    ) {
    }
}
