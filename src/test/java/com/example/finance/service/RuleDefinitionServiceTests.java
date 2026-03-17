package com.example.finance.service;

import com.example.finance.dto.RuleDefinitionApiModels;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.entity.RuleDefinition;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.RuleDefinitionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RuleDefinitionServiceTests {

    @Mock
    private RuleDefinitionRepository ruleDefinitionRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private RuleDefinitionService ruleDefinitionService;

    @Test
    void createShouldPersistConsecutiveThresholdRule() {
        Long familyId = 1L;
        Long categoryId = 2L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(ruleDefinitionRepository.save(any(RuleDefinition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinition ruleDefinition = ruleDefinitionService.create(
                new RuleDefinitionApiModels.CreateRequest(
                        familyId,
                        categoryId,
                        null,
                        "Three Month Food Rule",
                        "consecutive_threshold",
                        "category_expense",
                        "month",
                        "gte",
                        new BigDecimal("500.00"),
                        "{\"consecutiveMonths\":\"3\"}",
                        "notify",
                        "Food spending alert",
                        10
                )
        );

        assertEquals("CONSECUTIVE_THRESHOLD", ruleDefinition.getRuleType());
        assertEquals("CATEGORY_EXPENSE", ruleDefinition.getMetricType());
        assertEquals("MONTH", ruleDefinition.getTimeScope());
        assertEquals("GTE", ruleDefinition.getOperatorType());
        assertEquals("{\"consecutiveMonths\":3}", ruleDefinition.getThresholdJson());
        assertEquals(Integer.valueOf(10), ruleDefinition.getPriority());
    }

    @Test
    void createShouldRejectConsecutiveThresholdRuleOutsideMonthScope() {
        Long familyId = 1L;
        Long categoryId = 2L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> ruleDefinitionService.create(
                        new RuleDefinitionApiModels.CreateRequest(
                                familyId,
                                categoryId,
                                null,
                                "Invalid Consecutive Rule",
                                "CONSECUTIVE_THRESHOLD",
                                "CATEGORY_EXPENSE",
                                "YEAR",
                                "GTE",
                                new BigDecimal("500.00"),
                                "{\"consecutiveMonths\":3}",
                                "NOTIFY",
                                "Food spending alert",
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("CONSECUTIVE_THRESHOLD 规则仅支持 MONTH 时间范围", exception.getReason());
    }
}
