package com.example.finance.service;

import com.example.finance.dto.TransactionRecordApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Family;
import com.example.finance.repository.AccountRepository;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TransactionRecordServiceTests {

    @Mock
    private TransactionRecordRepository transactionRecordRepository;

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private FamilyService familyService;

    @InjectMocks
    private TransactionRecordService transactionRecordService;

    @Test
    void createShouldRejectInactiveAccount() {
        Long familyId = 1L;
        Long accountId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);
        account.setStatus(0);

        when(familyService.getById(familyId)).thenReturn(family);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> transactionRecordService.create(
                        new TransactionRecordApiModels.CreateRequest(
                                familyId,
                                accountId,
                                null,
                                null,
                                null,
                                null,
                                "EXPENSE",
                                new BigDecimal("50.00"),
                                null,
                                null,
                                null,
                                null,
                                null,
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("account is inactive", exception.getReason());
    }
}
