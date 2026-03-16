package com.example.finance.service;

import com.example.finance.dto.DebtApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Debt;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
    void repayShouldRejectInactivePayAccount() {
        Long familyId = 1L;
        Long debtId = 20L;
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
