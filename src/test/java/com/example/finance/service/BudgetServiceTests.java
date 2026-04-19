package com.example.finance.service;

import com.example.finance.dto.BudgetApiModels;
import com.example.finance.entity.BudgetPlan;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.BudgetPlanRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BudgetServiceTests {

    @Mock
    private BudgetPlanRepository budgetPlanRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private BudgetService budgetService;

    @Test
    void updateShouldModifyBudgetFields() {
        Long familyId = 1L;
        Long budgetId = 10L;

        Family family = new Family();
        family.setId(familyId);

        BudgetPlan budget = new BudgetPlan();
        budget.setId(budgetId);
        budget.setFamilyId(familyId);
        budget.setCategoryId(1L);
        budget.setCreatedByMemberId(8L);
        budget.setBudgetName("Old Budget");
        budget.setPeriodType("MONTH");
        budget.setAmount(new BigDecimal("300.00"));
        budget.setAlertRatio(new BigDecimal("0.80"));
        budget.setStartDate(LocalDate.of(2026, 3, 1));
        budget.setEndDate(LocalDate.of(2026, 3, 31));
        budget.setEnabled(1);
        budget.setRemark("old remark");

        Category category = new Category();
        category.setId(2L);
        category.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(budgetPlanRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(category));
        when(budgetPlanRepository.save(any(BudgetPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BudgetPlan updated = budgetService.update(
                budgetId,
                new BudgetApiModels.UpdateRequest(
                        2L,
                        "Updated Budget",
                        "year",
                        new BigDecimal("1200.00"),
                        new BigDecimal("0.65"),
                        LocalDate.of(2026, 1, 1),
                        LocalDate.of(2026, 12, 31),
                        "updated remark"
                )
        );

        assertEquals(2L, updated.getCategoryId());
        assertEquals("Updated Budget", updated.getBudgetName());
        assertEquals("YEAR", updated.getPeriodType());
        assertEquals(new BigDecimal("1200.00"), updated.getAmount());
        assertEquals(new BigDecimal("0.65"), updated.getAlertRatio());
        assertEquals(LocalDate.of(2026, 1, 1), updated.getStartDate());
        assertEquals(LocalDate.of(2026, 12, 31), updated.getEndDate());
        assertEquals("updated remark", updated.getRemark());
        assertEquals(8L, updated.getCreatedByMemberId());
    }

    @Test
    void changeEnabledShouldExcludeDisabledBudgetFromUsage() {
        Long familyId = 1L;
        Long budgetId = 10L;

        Family family = new Family();
        family.setId(familyId);

        BudgetPlan budget = new BudgetPlan();
        budget.setId(budgetId);
        budget.setFamilyId(familyId);
        budget.setCategoryId(2L);
        budget.setBudgetName("Food Budget");
        budget.setPeriodType("MONTH");
        budget.setAmount(new BigDecimal("200.00"));
        budget.setAlertRatio(new BigDecimal("0.80"));
        budget.setStartDate(LocalDate.of(2026, 3, 1));
        budget.setEndDate(LocalDate.of(2026, 3, 31));
        budget.setEnabled(1);

        Category category = new Category();
        category.setId(2L);
        category.setFamilyId(familyId);
        category.setCategoryName("Food");

        when(familyService.getById(familyId)).thenReturn(family);
        when(budgetPlanRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(budgetPlanRepository.save(any(BudgetPlan.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(budgetPlanRepository.findByFamilyIdAndEnabledOrderByIdDesc(familyId, 1))
                .thenAnswer(invocation -> budget.getEnabled() == 1 ? List.of(budget) : List.of());
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)).thenReturn(List.of(category));
        when(transactionRecordRepository.findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                any(Long.class),
                any(String.class),
                any(),
                any()
        )).thenReturn(List.of());

        BudgetPlan disabled = budgetService.changeEnabled(budgetId, false);
        List<BudgetApiModels.UsageResponse> usage = budgetService.getUsage(familyId, "2026-03");

        assertEquals(0, disabled.getEnabled());
        assertTrue(usage.isEmpty());
    }

    @Test
    void updateShouldRejectCategoryOutsideFamily() {
        Long familyId = 1L;
        Long budgetId = 10L;

        Family family = new Family();
        family.setId(familyId);

        BudgetPlan budget = new BudgetPlan();
        budget.setId(budgetId);
        budget.setFamilyId(familyId);

        Category category = new Category();
        category.setId(9L);
        category.setFamilyId(2L);

        when(familyService.getById(familyId)).thenReturn(family);
        when(budgetPlanRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(categoryRepository.findById(9L)).thenReturn(Optional.of(category));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> budgetService.update(
                        budgetId,
                        new BudgetApiModels.UpdateRequest(
                                9L,
                                "Invalid Budget",
                                "MONTH",
                                new BigDecimal("100.00"),
                                new BigDecimal("0.80"),
                                LocalDate.of(2026, 3, 1),
                                LocalDate.of(2026, 3, 31),
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("budget category does not belong to family", exception.getReason());
    }

    @Test
    void createShouldRejectCreatorOutsideFamily() {
        Long familyId = 1L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(2L);
        category.setFamilyId(familyId);

        FamilyMember creator = new FamilyMember();
        creator.setId(15L);
        creator.setFamilyId(2L);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(2L)).thenReturn(Optional.of(category));
        when(familyMemberRepository.findById(15L)).thenReturn(Optional.of(creator));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> budgetService.create(
                        new BudgetApiModels.CreateRequest(
                                familyId,
                                2L,
                                15L,
                                "Food Budget",
                                "MONTH",
                                new BigDecimal("200.00"),
                                new BigDecimal("0.80"),
                                LocalDate.of(2026, 3, 1),
                                LocalDate.of(2026, 3, 31),
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("budget creator member does not belong to family", exception.getReason());
    }

    @Test
    void deleteShouldRemoveBudgetAndExcludeItFromList() {
        Long familyId = 1L;
        Long budgetId = 10L;

        Family family = new Family();
        family.setId(familyId);

        BudgetPlan budget = new BudgetPlan();
        budget.setId(budgetId);
        budget.setFamilyId(familyId);
        budget.setEnabled(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(budgetPlanRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(budgetPlanRepository.findByFamilyIdOrderByIdDesc(familyId))
                .thenAnswer(invocation -> List.of());

        budgetService.delete(budgetId);
        List<BudgetPlan> budgets = budgetService.listByFamilyId(familyId);

        verify(budgetPlanRepository).delete(budget);
        assertTrue(budgets.isEmpty());
    }
}
