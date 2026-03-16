package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.entity.BudgetPlan;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.BudgetPlanRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import com.example.finance.util.PeriodRangeUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class BudgetService {

    private static final int ENABLED = 1;
    private static final int DISABLED = 0;
    private static final BigDecimal DEFAULT_ALERT_RATIO = new BigDecimal("0.80");
    private static final List<String> SUPPORTED_PERIOD_TYPES = List.of("MONTH", "YEAR");

    private final BudgetPlanRepository budgetPlanRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final FamilyService familyService;

    public BudgetService(
            BudgetPlanRepository budgetPlanRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            TransactionRecordRepository transactionRecordRepository,
            FamilyService familyService
    ) {
        this.budgetPlanRepository = budgetPlanRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.familyService = familyService;
    }

    @Transactional
    public BudgetPlan create(BudgetApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateCategoryBelongsToFamily(request.familyId(), request.categoryId());
        validateCreatorMember(request.familyId(), request.createdByMemberId());

        BudgetPlan budgetPlan = new BudgetPlan();
        budgetPlan.setFamilyId(request.familyId());
        budgetPlan.setCreatedByMemberId(request.createdByMemberId());
        applyBudgetFields(
                budgetPlan,
                request.categoryId(),
                request.budgetName(),
                request.periodType(),
                request.amount(),
                request.alertRatio(),
                request.startDate(),
                request.endDate(),
                request.remark()
        );
        budgetPlan.setEnabled(ENABLED);
        return budgetPlanRepository.save(budgetPlan);
    }

    @Transactional
    public BudgetPlan update(Long budgetId, BudgetApiModels.UpdateRequest request) {
        BudgetPlan budgetPlan = getBudget(budgetId);
        familyService.getById(budgetPlan.getFamilyId());
        validateCategoryBelongsToFamily(budgetPlan.getFamilyId(), request.categoryId());

        applyBudgetFields(
                budgetPlan,
                request.categoryId(),
                request.budgetName(),
                request.periodType(),
                request.amount(),
                request.alertRatio(),
                request.startDate(),
                request.endDate(),
                request.remark()
        );
        return budgetPlanRepository.save(budgetPlan);
    }

    @Transactional
    public BudgetPlan changeEnabled(Long budgetId, boolean enabled) {
        BudgetPlan budgetPlan = getBudget(budgetId);
        familyService.getById(budgetPlan.getFamilyId());
        budgetPlan.setEnabled(enabled ? ENABLED : DISABLED);
        return budgetPlanRepository.save(budgetPlan);
    }

    public BudgetPlan getBudget(Long budgetId) {
        return budgetPlanRepository.findById(budgetId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "budget not found"));
    }

    public List<BudgetPlan> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return budgetPlanRepository.findByFamilyIdOrderByIdDesc(familyId);
    }

    public List<BudgetApiModels.UsageResponse> getUsage(Long familyId, String monthText) {
        familyService.getById(familyId);
        YearMonth month = PeriodRangeUtil.resolveMonth(monthText);
        LocalDateTime[] range = PeriodRangeUtil.monthRange(month);
        LocalDate periodStart = month.atDay(1);
        LocalDate periodEnd = month.atEndOfMonth();

        List<BudgetPlan> budgets = budgetPlanRepository.findByFamilyIdAndEnabledOrderByIdDesc(familyId, ENABLED).stream()
                .filter(budget -> isBudgetActiveInPeriod(budget, periodStart, periodEnd))
                .toList();
        Map<Long, String> categoryNameMap = buildCategoryNameMap(familyId);
        Map<Long, BigDecimal> expenseByCategory = expenseByCategory(familyId, range[0], range[1]);

        return budgets.stream()
                .map(budget -> toUsageResponse(budget, month, categoryNameMap.get(budget.getCategoryId()), expenseByCategory))
                .toList();
    }

    private void applyBudgetFields(
            BudgetPlan budgetPlan,
            Long categoryId,
            String budgetName,
            String periodType,
            BigDecimal amount,
            BigDecimal alertRatio,
            LocalDate startDate,
            LocalDate endDate,
            String remark
    ) {
        budgetPlan.setCategoryId(categoryId);
        budgetPlan.setBudgetName(budgetName.trim());
        budgetPlan.setPeriodType(validatePeriodType(periodType));
        budgetPlan.setAmount(amount);
        budgetPlan.setAlertRatio(alertRatio == null ? DEFAULT_ALERT_RATIO : alertRatio);
        budgetPlan.setStartDate(startDate);
        budgetPlan.setEndDate(validateDateRange(startDate, endDate));
        budgetPlan.setRemark(normalize(remark));
    }

    private void validateCategoryBelongsToFamily(Long familyId, Long categoryId) {
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "budget category not found"));
        if (!familyId.equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budget category does not belong to family");
        }
    }

    private void validateCreatorMember(Long familyId, Long createdByMemberId) {
        if (createdByMemberId == null) {
            return;
        }
        FamilyMember familyMember = familyMemberRepository.findById(createdByMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "budget creator member not found"));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budget creator member does not belong to family");
        }
    }

    private String validatePeriodType(String periodType) {
        String normalizedPeriodType = periodType.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_PERIOD_TYPES.contains(normalizedPeriodType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "periodType only supports MONTH or YEAR");
        }
        return normalizedPeriodType;
    }

    private LocalDate validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (endDate != null && endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "budget endDate cannot be earlier than startDate");
        }
        return endDate;
    }

    private Map<Long, BigDecimal> expenseByCategory(Long familyId, LocalDateTime start, LocalDateTime end) {
        List<TransactionRecord> expenseRecords = transactionRecordRepository
                .findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                        familyId,
                        "EXPENSE",
                        start,
                        end
                );
        Map<Long, BigDecimal> result = new HashMap<>();
        for (TransactionRecord record : expenseRecords) {
            if (record.getCategoryId() == null) {
                continue;
            }
            result.merge(record.getCategoryId(), record.getAmount(), BigDecimal::add);
        }
        return result;
    }

    private Map<Long, String> buildCategoryNameMap(Long familyId) {
        Map<Long, String> result = new HashMap<>();
        for (Category category : categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)) {
            result.put(category.getId(), category.getCategoryName());
        }
        return result;
    }

    private BudgetApiModels.UsageResponse toUsageResponse(
            BudgetPlan budget,
            YearMonth month,
            String categoryName,
            Map<Long, BigDecimal> expenseByCategory
    ) {
        BigDecimal spent = expenseByCategory.getOrDefault(budget.getCategoryId(), BigDecimal.ZERO);
        BigDecimal remaining = budget.getAmount().subtract(spent);
        BigDecimal usageRatio = budget.getAmount().compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : spent.divide(budget.getAmount(), 4, RoundingMode.HALF_UP);
        boolean alertTriggered = usageRatio.compareTo(budget.getAlertRatio()) >= 0;
        boolean exceeded = spent.compareTo(budget.getAmount()) > 0;

        return new BudgetApiModels.UsageResponse(
                budget.getId(),
                budget.getBudgetName(),
                budget.getCategoryId(),
                categoryName,
                month.toString(),
                budget.getAmount(),
                spent,
                remaining,
                usageRatio,
                alertTriggered,
                exceeded
        );
    }

    private boolean isBudgetActiveInPeriod(BudgetPlan budget, LocalDate periodStart, LocalDate periodEnd) {
        LocalDate startDate = budget.getStartDate();
        LocalDate endDate = budget.getEndDate();
        boolean startsBeforePeriodEnd = !startDate.isAfter(periodEnd);
        boolean endsAfterPeriodStart = endDate == null || !endDate.isBefore(periodStart);
        return startsBeforePeriodEnd && endsAfterPeriodStart;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
