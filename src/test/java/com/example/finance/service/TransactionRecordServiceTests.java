package com.example.finance.service;

import com.example.finance.dto.TransactionRecordApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Family;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
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
    void updateShouldRebalanceAccountsWhenChangingExpenseToTransfer() {
        Long familyId = 1L;
        Long sourceAccountId = 10L;
        Long targetAccountId = 11L;
        Long recordId = 100L;

        Family family = new Family();
        family.setId(familyId);

        Account sourceAccount = new Account();
        sourceAccount.setId(sourceAccountId);
        sourceAccount.setFamilyId(familyId);
        sourceAccount.setStatus(1);
        sourceAccount.setCurrentBalance(new BigDecimal("950.00"));

        Account targetAccount = new Account();
        targetAccount.setId(targetAccountId);
        targetAccount.setFamilyId(familyId);
        targetAccount.setStatus(1);
        targetAccount.setCurrentBalance(new BigDecimal("200.00"));

        TransactionRecord record = new TransactionRecord();
        record.setId(recordId);
        record.setFamilyId(familyId);
        record.setAccountId(sourceAccountId);
        record.setTransactionType("EXPENSE");
        record.setAmount(new BigDecimal("50.00"));
        record.setTransactionTime(LocalDateTime.of(2026, 3, 18, 10, 0));
        record.setSourcePlatform("MANUAL");
        record.setCreatedByMemberId(7L);

        when(familyService.getById(familyId)).thenReturn(family);
        when(transactionRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(accountRepository.findById(sourceAccountId)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findById(targetAccountId)).thenReturn(Optional.of(targetAccount));
        when(transactionRecordRepository.save(any(TransactionRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionRecord updated = transactionRecordService.update(
                recordId,
                new TransactionRecordApiModels.UpdateRequest(
                        sourceAccountId,
                        targetAccountId,
                        null,
                        null,
                        "TRANSFER",
                        new BigDecimal("80.00"),
                        LocalDateTime.of(2026, 3, 18, 11, 0),
                        "Wallet Transfer",
                        "Savings",
                        "manual",
                        null,
                        "move cash"
                )
        );

        assertEquals(new BigDecimal("920.00"), sourceAccount.getCurrentBalance());
        assertEquals(new BigDecimal("280.00"), targetAccount.getCurrentBalance());
        assertEquals("TRANSFER", updated.getTransactionType());
        assertEquals(targetAccountId, updated.getTargetAccountId());
        assertEquals(new BigDecimal("80.00"), updated.getAmount());
        assertEquals("MANUAL", updated.getSourcePlatform());
        assertEquals(7L, updated.getCreatedByMemberId());
    }

    @Test
    void deleteShouldRollbackTransferBalancesAndRemoveRecord() {
        Long familyId = 1L;
        Long sourceAccountId = 10L;
        Long targetAccountId = 11L;
        Long recordId = 101L;

        Family family = new Family();
        family.setId(familyId);

        Account sourceAccount = new Account();
        sourceAccount.setId(sourceAccountId);
        sourceAccount.setFamilyId(familyId);
        sourceAccount.setStatus(0);
        sourceAccount.setCurrentBalance(new BigDecimal("440.00"));

        Account targetAccount = new Account();
        targetAccount.setId(targetAccountId);
        targetAccount.setFamilyId(familyId);
        targetAccount.setStatus(0);
        targetAccount.setCurrentBalance(new BigDecimal("360.00"));

        TransactionRecord record = new TransactionRecord();
        record.setId(recordId);
        record.setFamilyId(familyId);
        record.setAccountId(sourceAccountId);
        record.setTargetAccountId(targetAccountId);
        record.setTransactionType("TRANSFER");
        record.setAmount(new BigDecimal("60.00"));

        when(familyService.getById(familyId)).thenReturn(family);
        when(transactionRecordRepository.findById(recordId)).thenReturn(Optional.of(record));
        when(accountRepository.findById(sourceAccountId)).thenReturn(Optional.of(sourceAccount));
        when(accountRepository.findById(targetAccountId)).thenReturn(Optional.of(targetAccount));

        transactionRecordService.delete(recordId);

        assertEquals(new BigDecimal("500.00"), sourceAccount.getCurrentBalance());
        assertEquals(new BigDecimal("300.00"), targetAccount.getCurrentBalance());
        verify(transactionRecordRepository).delete(record);
    }

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

    @Test
    void searchShouldReturnPagedFilteredResult() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        when(familyService.getById(familyId)).thenReturn(family);

        TransactionRecord record = new TransactionRecord();
        record.setId(201L);
        record.setFamilyId(familyId);
        record.setAccountId(10L);
        record.setTransactionType("EXPENSE");
        record.setAmount(new BigDecimal("88.00"));
        record.setTransactionTime(LocalDateTime.of(2026, 4, 1, 12, 0));
        record.setStatus(1);

        when(transactionRecordRepository.findAll(any(Specification.class), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(record), PageRequest.of(0, 10), 1));

        TransactionRecordApiModels.SearchPageResponse response = transactionRecordService.searchByFamilyId(
                familyId,
                "expense",
                LocalDateTime.of(2026, 4, 1, 0, 0),
                LocalDateTime.of(2026, 4, 30, 23, 59),
                0,
                10
        );

        assertEquals(1, response.items().size());
        assertEquals("EXPENSE", response.items().get(0).transactionType());
        assertEquals(1L, response.totalElements());
        assertEquals(1, response.totalPages());
    }

    @Test
    void searchShouldRejectInvalidTimeRange() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> transactionRecordService.searchByFamilyId(
                        1L,
                        null,
                        LocalDateTime.of(2026, 4, 10, 0, 0),
                        LocalDateTime.of(2026, 4, 1, 0, 0),
                        0,
                        20
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("startTime cannot be later than endTime", exception.getReason());
    }
}
