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
import static org.mockito.Mockito.verify;
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
        assertEquals("CONSECUTIVE_THRESHOLD only supports MONTH timeScope", exception.getReason());
    }

    @Test
    void createShouldPersistTrendAnomalyRule() {
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
                        "Food Trend Rule",
                        "trend_anomaly",
                        "category_expense",
                        "month",
                        "gte",
                        new BigDecimal("0.30"),
                        "{\"baselineMonths\":\"3\"}",
                        "notify",
                        "Food trend anomaly",
                        20
                )
        );

        assertEquals("TREND_ANOMALY", ruleDefinition.getRuleType());
        assertEquals("CATEGORY_EXPENSE", ruleDefinition.getMetricType());
        assertEquals("MONTH", ruleDefinition.getTimeScope());
        assertEquals("GTE", ruleDefinition.getOperatorType());
        assertEquals(new BigDecimal("0.30"), ruleDefinition.getThresholdValue());
        assertEquals("{\"baselineMonths\":3}", ruleDefinition.getThresholdJson());
    }

    @Test
    void createShouldRejectTrendAnomalyRuleWithUnsupportedOperator() {
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
                                "Invalid Trend Rule",
                                "TREND_ANOMALY",
                                "CATEGORY_EXPENSE",
                                "MONTH",
                                "LTE",
                                new BigDecimal("0.30"),
                                "{\"baselineMonths\":3}",
                                "NOTIFY",
                                "Food trend anomaly",
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("TREND_ANOMALY only supports GT or GTE operatorType", exception.getReason());
    }

    @Test
    void updateShouldChangeRuleFields() {
        Long familyId = 1L;
        Long ruleId = 100L;
        Long categoryId = 2L;

        Family family = new Family();
        family.setId(familyId);

        RuleDefinition rule = new RuleDefinition();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);
        rule.setRuleType("THRESHOLD");
        rule.setMetricType("CATEGORY_EXPENSE");
        rule.setTimeScope("MONTH");
        rule.setOperatorType("GTE");
        rule.setThresholdValue(new BigDecimal("100.00"));
        rule.setEnabled(1);
        rule.setPriority(100);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        when(ruleDefinitionRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(familyService.getById(familyId)).thenReturn(family);
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(ruleDefinitionRepository.save(any(RuleDefinition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinition updated = ruleDefinitionService.update(
                ruleId,
                new RuleDefinitionApiModels.UpdateRequest(
                        categoryId,
                        null,
                        "Updated Rule",
                        "THRESHOLD",
                        "CATEGORY_EXPENSE",
                        "MONTH",
                        "GT",
                        new BigDecimal("200.00"),
                        null,
                        "NOTIFY",
                        "updated template",
                        5
                )
        );

        assertEquals("Updated Rule", updated.getRuleName());
        assertEquals("GT", updated.getOperatorType());
        assertEquals(new BigDecimal("200.00"), updated.getThresholdValue());
        assertEquals(Integer.valueOf(5), updated.getPriority());
    }

    @Test
    void changeEnabledShouldDisableRule() {
        Long familyId = 1L;
        Long ruleId = 100L;

        Family family = new Family();
        family.setId(familyId);

        RuleDefinition rule = new RuleDefinition();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);
        rule.setEnabled(1);

        when(ruleDefinitionRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(familyService.getById(familyId)).thenReturn(family);
        when(ruleDefinitionRepository.save(any(RuleDefinition.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RuleDefinition disabled = ruleDefinitionService.changeEnabled(ruleId, false);

        assertEquals(0, disabled.getEnabled());
    }

    @Test
    void deleteShouldRemoveRule() {
        Long familyId = 1L;
        Long ruleId = 100L;

        Family family = new Family();
        family.setId(familyId);

        RuleDefinition rule = new RuleDefinition();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);

        when(ruleDefinitionRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(familyService.getById(familyId)).thenReturn(family);

        ruleDefinitionService.delete(ruleId);

        verify(ruleDefinitionRepository).delete(rule);
    }
}
