package com.example.finance.service;

import com.example.finance.dto.BillParseRuleApiModels;
import com.example.finance.entity.BillParseRule;
import com.example.finance.entity.Category;
import com.example.finance.entity.Family;
import com.example.finance.repository.BillParseRuleRepository;
import com.example.finance.repository.CategoryRepository;
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
class BillParseRuleServiceTests {

    @Mock
    private BillParseRuleRepository billParseRuleRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private BillParseRuleService billParseRuleService;

    @Test
    void updateShouldModifyRuleFields() {
        Long familyId = 1L;
        Long categoryId = 2L;
        Long ruleId = 100L;

        Family family = new Family();
        family.setId(familyId);

        Category category = new Category();
        category.setId(categoryId);
        category.setFamilyId(familyId);

        BillParseRule rule = new BillParseRule();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);
        rule.setCategoryId(categoryId);
        rule.setMerchantKeyword("old");
        rule.setRegexPattern(null);
        rule.setPriority(100);
        rule.setEnabled(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(billParseRuleRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(categoryRepository.findById(categoryId)).thenReturn(Optional.of(category));
        when(billParseRuleRepository.save(any(BillParseRule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BillParseRule updated = billParseRuleService.update(
                ruleId,
                new BillParseRuleApiModels.UpdateRequest(
                        categoryId,
                        " Starbucks ",
                        null,
                        5
                )
        );

        assertEquals("Starbucks", updated.getMerchantKeyword());
        assertEquals(Integer.valueOf(5), updated.getPriority());
    }

    @Test
    void changeEnabledShouldDisableRule() {
        Long familyId = 1L;
        Long ruleId = 100L;

        Family family = new Family();
        family.setId(familyId);

        BillParseRule rule = new BillParseRule();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);
        rule.setEnabled(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(billParseRuleRepository.findById(ruleId)).thenReturn(Optional.of(rule));
        when(billParseRuleRepository.save(any(BillParseRule.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BillParseRule disabled = billParseRuleService.changeEnabled(ruleId, false);

        assertEquals(0, disabled.getEnabled());
    }

    @Test
    void deleteShouldRemoveRule() {
        Long familyId = 1L;
        Long ruleId = 100L;

        Family family = new Family();
        family.setId(familyId);

        BillParseRule rule = new BillParseRule();
        rule.setId(ruleId);
        rule.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(billParseRuleRepository.findById(ruleId)).thenReturn(Optional.of(rule));

        billParseRuleService.delete(ruleId);

        verify(billParseRuleRepository).delete(rule);
    }

    @Test
    void createShouldRejectWhenKeywordAndRegexAreBothEmpty() {
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
                () -> billParseRuleService.create(
                        new BillParseRuleApiModels.CreateRequest(
                                familyId,
                                categoryId,
                                " ",
                                " ",
                                10
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("merchantKeyword and regexPattern cannot both be empty", exception.getReason());
    }
}
