package com.example.finance.service;

import com.example.finance.dto.CategoryApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.repository.BillParseRuleRepository;
import com.example.finance.repository.BudgetPlanRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryServiceTests {

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private BudgetPlanRepository budgetPlanRepository;

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private BillParseRuleRepository billParseRuleRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private CategoryService categoryService;

    @Test
    void updateShouldModifyCategoryFields() {
        Long familyId = 1L;
        Long categoryId = 10L;
        Long parentId = 11L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);
        category.setParentId(null);
        category.setCategoryName("Old Name");
        category.setCategoryType("EXPENSE");
        category.setScopeType("FAMILY");
        category.setIconCode("old");
        category.setSortOrder(1);
        category.setEnabled(1);

        Category parent = new Category();
        parent.setId(parentId);
        parent.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));
        when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Category updated = categoryService.update(
                categoryId,
                new CategoryApiModels.UpdateRequest(
                        parentId,
                        " Updated Name ",
                        "income",
                        "member",
                        "wallet",
                        8
                )
        );

        assertEquals(parentId, updated.getParentId());
        assertEquals("Updated Name", updated.getCategoryName());
        assertEquals("INCOME", updated.getCategoryType());
        assertEquals("MEMBER", updated.getScopeType());
        assertEquals("wallet", updated.getIconCode());
        assertEquals(8, updated.getSortOrder());
    }

    @Test
    void changeEnabledShouldDisableCategory() {
        Long familyId = 1L;
        Long categoryId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);
        category.setEnabled(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any(Category.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Category disabled = categoryService.changeEnabled(categoryId, false);

        assertEquals(0, disabled.getEnabled());
    }

    @Test
    void createShouldRejectParentCategoryOutsideFamily() {
        Long familyId = 1L;
        Long parentId = 99L;

        Family family = new Family();
        family.setId(familyId);

        Category parent = new Category();
        parent.setId(parentId);
        parent.setFamilyId(2L);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(parentId)).thenReturn(Optional.of(parent));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> categoryService.create(
                        new CategoryApiModels.CreateRequest(
                                familyId,
                                parentId,
                                "Food",
                                "EXPENSE",
                                "FAMILY",
                                "food",
                                1
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("parent category does not belong to family", exception.getReason());
    }

    @Test
    void deleteShouldRejectWhenReferencedByTransactionRecords() {
        Long familyId = 1L;
        Long categoryId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(categoryRepository.existsByFamilyIdAndParentId(familyId, categoryId)).thenReturn(false);
        when(budgetPlanRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(false);
        when(transactionRecordRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(true);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> categoryService.delete(categoryId)
        );

        assertEquals(HttpStatus.CONFLICT, exception.getStatusCode());
        assertEquals("category is referenced by transaction records", exception.getReason());
    }

    @Test
    void deleteShouldRemoveCategoryWhenNoReferences() {
        Long familyId = 1L;
        Long categoryId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(categoryRepository.existsByFamilyIdAndParentId(familyId, categoryId)).thenReturn(false);
        when(budgetPlanRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(false);
        when(transactionRecordRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(false);
        when(ruleDefinitionRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(false);
        when(billParseRuleRepository.existsByFamilyIdAndCategoryId(familyId, categoryId)).thenReturn(false);

        categoryService.delete(categoryId);

        verify(categoryRepository).delete(category);
    }
}
