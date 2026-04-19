package com.example.finance.service;

import com.example.finance.dto.FinancialAdviceApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.Debt;
import com.example.finance.entity.Family;
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
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinancialAdviceServiceTests {

    @Mock
    private FinancialAdviceRepository financialAdviceRepository;

    @Mock
    private FamilyFinancialProfileRepository familyFinancialProfileRepository;

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private DebtRepository debtRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyService familyService;

    @Mock
    private FamilyAccessService familyAccessService;

    @InjectMocks
    private FinancialAdviceService financialAdviceService;

    @Test
    void generateShouldCreateAdviceBasedOnProfileAndCashFlow() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        FamilyFinancialProfile profile = new FamilyFinancialProfile();
        profile.setFamilyId(familyId);
        profile.setRiskPreference("LOW");
        profile.setSavingsTargetRate(new BigDecimal("0.20"));
        profile.setEmergencyFundMonths(3);
        when(familyFinancialProfileRepository.findByFamilyId(familyId)).thenReturn(Optional.of(profile));

        YearMonth month = YearMonth.of(2026, 3);
        LocalDateTime start = month.atDay(1).atStartOfDay();
        LocalDateTime end = month.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);

        TransactionRecord income = new TransactionRecord();
        income.setAmount(new BigDecimal("10000.00"));
        when(transactionRecordRepository.findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId, "INCOME", start, end
        )).thenReturn(List.of(income));

        TransactionRecord foodExpense = new TransactionRecord();
        foodExpense.setAmount(new BigDecimal("3500.00"));
        foodExpense.setCategoryId(100L);
        TransactionRecord rentExpense = new TransactionRecord();
        rentExpense.setAmount(new BigDecimal("2500.00"));
        rentExpense.setCategoryId(200L);
        when(transactionRecordRepository.findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
                familyId, "EXPENSE", start, end
        )).thenReturn(List.of(foodExpense, rentExpense));

        Account account = new Account();
        account.setCurrentBalance(new BigDecimal("5000.00"));
        when(accountRepository.findByFamilyIdOrderByIdDesc(familyId)).thenReturn(List.of(account));

        Debt debt = new Debt();
        debt.setCurrentBalance(new BigDecimal("6000.00"));
        debt.setStatus("ACTIVE");
        when(debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, "ACTIVE"))
                .thenReturn(List.of(debt));

        Category food = new Category();
        food.setId(100L);
        food.setCategoryName("Food");
        Category rent = new Category();
        rent.setId(200L);
        rent.setCategoryName("Rent");
        when(categoryRepository.findByFamilyIdOrderBySortOrderAscIdAsc(familyId)).thenReturn(List.of(food, rent));

        when(financialAdviceRepository.existsByFamilyIdAndAdviceTypeAndTitleAndGeneratedAtBetween(
                eq(familyId), anyString(), anyString(), any(LocalDateTime.class), any(LocalDateTime.class)
        )).thenReturn(false);

        AtomicLong adviceId = new AtomicLong(1L);
        when(financialAdviceRepository.save(any(FinancialAdvice.class))).thenAnswer(invocation -> {
            FinancialAdvice advice = invocation.getArgument(0);
            advice.setId(adviceId.getAndIncrement());
            if (advice.getGeneratedAt() == null) {
                advice.setGeneratedAt(LocalDateTime.now());
            }
            return advice;
        });

        FinancialAdviceApiModels.GenerateResponse response = financialAdviceService.generate(familyId, "2026-03");

        assertEquals(new BigDecimal("10000.00"), response.totalIncome());
        assertEquals(new BigDecimal("6000.00"), response.totalExpense());
        assertEquals(new BigDecimal("4000.00"), response.savingsAmount());
        assertEquals(new BigDecimal("0.4000"), response.savingsRate());
        assertEquals(new BigDecimal("5000.00"), response.totalAccountBalance());
        assertEquals(new BigDecimal("6000.00"), response.totalDebtBalance());
        assertEquals(4, response.generatedCount());
        assertTrue(response.advices().stream().anyMatch(advice -> "INVESTMENT".equals(advice.adviceType())));
        assertTrue(response.advices().stream().anyMatch(advice -> "EMERGENCY_FUND".equals(advice.adviceType())));
        assertTrue(response.advices().stream().anyMatch(advice -> "DEBT".equals(advice.adviceType())));
        assertTrue(response.advices().stream().anyMatch(advice -> "CONSUMPTION".equals(advice.adviceType())));
    }

    @Test
    void markUnreadShouldSetStatusToUnread() {
        Long adviceId = 10L;
        Long familyId = 1L;

        FinancialAdvice advice = new FinancialAdvice();
        advice.setId(adviceId);
        advice.setFamilyId(familyId);
        advice.setStatus("READ");

        when(financialAdviceRepository.findById(adviceId)).thenReturn(Optional.of(advice));
        when(financialAdviceRepository.save(any(FinancialAdvice.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FinancialAdvice updated = financialAdviceService.markUnread(adviceId);

        assertEquals("UNREAD", updated.getStatus());
    }

    @Test
    void deleteShouldRemoveAdvice() {
        Long adviceId = 11L;
        Long familyId = 1L;

        FinancialAdvice advice = new FinancialAdvice();
        advice.setId(adviceId);
        advice.setFamilyId(familyId);

        when(financialAdviceRepository.findById(adviceId)).thenReturn(Optional.of(advice));

        financialAdviceService.delete(adviceId);

        verify(financialAdviceRepository).delete(advice);
    }

    @Test
    void getByIdShouldThrowWhenAdviceMissing() {
        Long adviceId = 12L;
        when(financialAdviceRepository.findById(adviceId)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> financialAdviceService.getById(adviceId)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        assertEquals("financial advice not found", exception.getReason());
    }
}
