package com.example.finance.service;

import com.example.finance.dto.FinancialAdviceApiModels;
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

    private final FinancialAdviceRepository financialAdviceRepository;
    private final FamilyFinancialProfileRepository familyFinancialProfileRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final AccountRepository accountRepository;
    private final DebtRepository debtRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyService familyService;
    private final FamilyAccessService familyAccessService;

    public FinancialAdviceService(
            FinancialAdviceRepository financialAdviceRepository,
            FamilyFinancialProfileRepository familyFinancialProfileRepository,
            TransactionRecordRepository transactionRecordRepository,
            AccountRepository accountRepository,
            DebtRepository debtRepository,
            CategoryRepository categoryRepository,
            FamilyService familyService,
            FamilyAccessService familyAccessService
    ) {
        this.financialAdviceRepository = financialAdviceRepository;
        this.familyFinancialProfileRepository = familyFinancialProfileRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.accountRepository = accountRepository;
        this.debtRepository = debtRepository;
        this.categoryRepository = categoryRepository;
        this.familyService = familyService;
        this.familyAccessService = familyAccessService;
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

    public FinancialAdvice markRead(Long adviceId) {
        FinancialAdvice advice = financialAdviceRepository.findById(adviceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "financial advice not found"));
        familyAccessService.requireFamilyRead(advice.getFamilyId());
        advice.setStatus("READ");
        return financialAdviceRepository.save(advice);
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
        String snapshotJson = buildSnapshotJson(
                month,
                totalIncome,
                totalExpense,
                savingsAmount,
                savingsRate,
                totalAccountBalance,
                totalDebtBalance,
                profile,
                topExpenseCategory
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
            String snapshotJson
    ) {
        List<FinancialAdvice> advices = new ArrayList<>();
        BigDecimal savingsTarget = profile.getSavingsTargetRate() == null
                ? DEFAULT_SAVINGS_TARGET_RATE
                : profile.getSavingsTargetRate();

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && savingsRate != null && savingsRate.compareTo(savingsTarget) < 0) {
            String title = "储蓄率低于目标";
            String content = String.format(
                    Locale.ROOT,
                    "%s 的储蓄率为 %.2f%%，低于目标 %.2f%%。建议优先控制弹性支出并提高固定储蓄比例。",
                    month,
                    savingsRate.multiply(new BigDecimal("100")),
                    savingsTarget.multiply(new BigDecimal("100"))
            );
            saveAdviceIfAbsentToday(advices, familyId, "SAVINGS", title, content, "HIGH", snapshotJson);
        }

        if (totalIncome.compareTo(BigDecimal.ZERO) > 0 && savingsRate != null && savingsRate.compareTo(savingsTarget) >= 0) {
            String riskPreference = profile.getRiskPreference() == null ? "LOW" : profile.getRiskPreference();
            String title = "可考虑分层理财配置";
            String content = String.format(
                    Locale.ROOT,
                    "%s 的储蓄率达到 %.2f%%。结合当前风险偏好 %s，可考虑保留日常与应急资金后，将结余分配到%s。",
                    month,
                    savingsRate.multiply(new BigDecimal("100")),
                    riskPreference,
                    investmentSuggestion(riskPreference)
            );
            saveAdviceIfAbsentToday(advices, familyId, "INVESTMENT", title, content, "NORMAL", snapshotJson);
        }

        int emergencyFundMonths = profile.getEmergencyFundMonths() == null
                ? DEFAULT_EMERGENCY_FUND_MONTHS
                : profile.getEmergencyFundMonths();
        if (totalExpense.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal emergencyFundTarget = totalExpense.multiply(BigDecimal.valueOf(emergencyFundMonths));
            if (totalAccountBalance.compareTo(emergencyFundTarget) < 0) {
                String title = "应急资金覆盖不足";
                String content = String.format(
                        Locale.ROOT,
                        "当前流动资金为 %.2f，低于约 %d 个月支出的应急目标 %.2f。建议优先补足应急储备。",
                        totalAccountBalance,
                        emergencyFundMonths,
                        emergencyFundTarget
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

        return advices;
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
            ExpenseCategorySummary topExpenseCategory
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
                )
                .append("}");
        return builder.toString();
    }

    private String investmentSuggestion(String riskPreference) {
        return switch (riskPreference) {
            case "HIGH" -> "指数基金、权益类组合等波动较高资产";
            case "MEDIUM" -> "债券与权益混合配置或中低波动基金";
            default -> "存款、货币基金、短债等低风险品种";
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
}
