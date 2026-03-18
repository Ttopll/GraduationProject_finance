package com.example.finance.service;

import com.example.finance.dto.DebtApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Debt;
import com.example.finance.entity.DebtRepayment;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.DebtRepaymentRepository;
import com.example.finance.repository.DebtRepository;
import com.example.finance.repository.FamilyMemberRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DebtServiceTests {

    @Mock
    private DebtRepository debtRepository;

    @Mock
    private DebtRepaymentRepository debtRepaymentRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private FamilyService familyService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @InjectMocks
    private DebtService debtService;

    @Test
    void updateShouldRecalculateCurrentBalanceBasedOnRepaidPrincipal() {
        Long debtId = 20L;
        Debt debt = new Debt();
        debt.setId(debtId);
        debt.setFamilyId(1L);
        debt.setPrincipalAmount(new BigDecimal("1000.00"));
        debt.setCurrentBalance(new BigDecimal("700.00"));
        debt.setStatus("ACTIVE");

        when(debtRepository.findById(debtId)).thenReturn(Optional.of(debt));
        when(debtRepository.save(any(Debt.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Debt updated = debtService.update(
                debtId,
                new DebtApiModels.UpdateRequest(
                        null,
                        "Mortgage",
                        "loan",
                        "Bank",
                        new BigDecimal("1200.00"),
                        new BigDecimal("3.20"),
                        5,
                        20,
                        null,
                        "updated"
                )
        );

        assertEquals(new BigDecimal("1200.00"), updated.getPrincipalAmount());
        assertEquals(new BigDecimal("900.00"), updated.getCurrentBalance());
        assertEquals("ACTIVE", updated.getStatus());
        assertEquals("LOAN", updated.getDebtType());
    }

    @Test
    void updateShouldRejectPrincipalBelowRepaidPrincipal() {
        Long debtId = 21L;
        Debt debt = new Debt();
        debt.setId(debtId);
        debt.setFamilyId(1L);
        debt.setPrincipalAmount(new BigDecimal("1000.00"));
        debt.setCurrentBalance(new BigDecimal("700.00"));

        when(debtRepository.findById(debtId)).thenReturn(Optional.of(debt));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> debtService.update(
                        debtId,
                        new DebtApiModels.UpdateRequest(
                                null,
                                "Mortgage",
                                "LOAN",
                                "Bank",
                                new BigDecimal("200.00"),
                                BigDecimal.ZERO,
                                null,
                                null,
                                null,
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("principalAmount cannot be less than repaid principal", exception.getReason());
    }

    @Test
    void clearShouldSetDebtAsCleared() {
        Long debtId = 22L;
        Debt debt = new Debt();
        debt.setId(debtId);
        debt.setFamilyId(1L);
        debt.setCurrentBalance(new BigDecimal("300.00"));
        debt.setStatus("ACTIVE");

        when(debtRepository.findById(debtId)).thenReturn(Optional.of(debt));
        when(debtRepository.save(any(Debt.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Debt cleared = debtService.clear(debtId);

        assertEquals(BigDecimal.ZERO, cleared.getCurrentBalance());
        assertEquals("CLEARED", cleared.getStatus());
    }

    @Test
    void deleteShouldRollbackRepaymentsAndRemoveDebt() {
        Long familyId = 1L;
        Long debtId = 23L;
        Long accountId = 10L;

        Debt debt = new Debt();
        debt.setId(debtId);
        debt.setFamilyId(familyId);

        DebtRepayment repayment1 = new DebtRepayment();
        repayment1.setId(100L);
        repayment1.setDebtId(debtId);
        repayment1.setFamilyId(familyId);
        repayment1.setPayAccountId(accountId);
        repayment1.setAmount(new BigDecimal("120.00"));

        DebtRepayment repayment2 = new DebtRepayment();
        repayment2.setId(101L);
        repayment2.setDebtId(debtId);
        repayment2.setFamilyId(familyId);
        repayment2.setPayAccountId(accountId);
        repayment2.setAmount(new BigDecimal("80.00"));

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);
        account.setStatus(0);
        account.setCurrentBalance(new BigDecimal("500.00"));

        when(debtRepository.findById(debtId)).thenReturn(Optional.of(debt));
        when(debtRepaymentRepository.findByDebtIdOrderByRepaymentTimeDescIdDesc(debtId))
                .thenReturn(List.of(repayment1, repayment2));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        debtService.delete(debtId);

        assertEquals(new BigDecimal("700.00"), account.getCurrentBalance());
        verify(debtRepaymentRepository).deleteAll(List.of(repayment1, repayment2));
        verify(debtRepository).delete(debt);
    }

    @Test
    void repayShouldRejectInactivePayAccount() {
        Long familyId = 1L;
        Long debtId = 24L;
        Long accountId = 10L;

        Debt debt = new Debt();
        debt.setId(debtId);
        debt.setFamilyId(familyId);
        debt.setCurrentBalance(new BigDecimal("500.00"));
        debt.setStatus("ACTIVE");

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);
        account.setStatus(0);

        when(debtRepository.findById(debtId)).thenReturn(Optional.of(debt));
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> debtService.repay(
                        debtId,
                        new DebtApiModels.RepaymentCreateRequest(
                                familyId,
                                accountId,
                                null,
                                new BigDecimal("100.00"),
                                new BigDecimal("100.00"),
                                BigDecimal.ZERO,
                                null,
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("account is inactive", exception.getReason());
    }
}
