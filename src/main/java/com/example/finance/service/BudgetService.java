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
import java.util.Map;
import java.util.Locale;

@Service
public class BudgetService {

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
        Category category = categoryRepository.findById(request.categoryId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "预算分类不存在"));
        if (!request.familyId().equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "预算分类不属于当前家庭");
        }

        if (request.createdByMemberId() != null) {
            FamilyMember familyMember = familyMemberRepository.findById(request.createdByMemberId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "预算创建人不存在"));
            if (!request.familyId().equals(familyMember.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "预算创建人不属于当前家庭");
            }
        }

        String periodType = request.periodType().trim().toUpperCase(Locale.ROOT);
        if (!List.of("MONTH", "YEAR").contains(periodType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "预算周期仅支持 MONTH 或 YEAR");
        }
        if (request.endDate() != null && request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "预算结束时间不能早于开始时间");
        }

        BudgetPlan budgetPlan = new BudgetPlan();
        budgetPlan.setFamilyId(request.familyId());
        budgetPlan.setCategoryId(request.categoryId());
        budgetPlan.setCreatedByMemberId(request.createdByMemberId());
        budgetPlan.setBudgetName(request.budgetName().trim());
        budgetPlan.setPeriodType(periodType);
        budgetPlan.setAmount(request.amount());
        budgetPlan.setAlertRatio(request.alertRatio() == null ? new BigDecimal("0.80") : request.alertRatio());
        budgetPlan.setStartDate(request.startDate());
        budgetPlan.setEndDate(request.endDate());
        budgetPlan.setEnabled(1);
        budgetPlan.setRemark(normalize(request.remark()));
        return budgetPlanRepository.save(budgetPlan);
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

        List<BudgetPlan> budgets = budgetPlanRepository.findByFamilyIdAndEnabledOrderByIdDesc(familyId, 1).stream()
                .filter(budget -> isBudgetActiveInPeriod(budget, periodStart, periodEnd))
                .toList();
        Map<Long, String> categoryNameMap = buildCategoryNameMap(familyId);
        Map<Long, BigDecimal> expenseByCategory = expenseByCategory(familyId, range[0], range[1]);

        return budgets.stream()
                .map(budget -> toUsageResponse(budget, month, categoryNameMap.get(budget.getCategoryId()), expenseByCategory))
                .toList();
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
