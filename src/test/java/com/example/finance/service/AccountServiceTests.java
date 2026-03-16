package com.example.finance.service;

import com.example.finance.dto.AccountApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.AccountRepository;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountServiceTests {

    @Mock
    private AccountRepository accountRepository;

    @Mock
    private FamilyService familyService;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @InjectMocks
    private AccountService accountService;

    @Test
    void updateShouldModifyMetadataAndPreserveBalance() {
        Long familyId = 1L;
        Long accountId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);
        account.setOwnerMemberId(11L);
        account.setAccountName("Old Name");
        account.setAccountType("CASH");
        account.setInstitutionName("Old Bank");
        account.setAccountNoMask("1111");
        account.setCurrentBalance(new BigDecimal("500.00"));
        account.setCreditLimit(new BigDecimal("1000.00"));
        account.setBillingDay(10);
        account.setRepaymentDay(20);
        account.setIsShared(0);
        account.setStatus(1);
        account.setRemark("old");

        FamilyMember owner = new FamilyMember();
        owner.setId(12L);
        owner.setFamilyId(familyId);
        owner.setStatus(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(familyMemberRepository.findByIdAndStatus(12L, 1)).thenReturn(Optional.of(owner));
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Account updated = accountService.update(
                accountId,
                new AccountApiModels.UpdateRequest(
                        12L,
                        "New Name",
                        "credit",
                        "New Bank",
                        "2222",
                        new BigDecimal("3000.00"),
                        15,
                        25,
                        1,
                        "updated"
                )
        );

        assertEquals(12L, updated.getOwnerMemberId());
        assertEquals("New Name", updated.getAccountName());
        assertEquals("CREDIT", updated.getAccountType());
        assertEquals("New Bank", updated.getInstitutionName());
        assertEquals("2222", updated.getAccountNoMask());
        assertEquals(new BigDecimal("500.00"), updated.getCurrentBalance());
        assertEquals(new BigDecimal("3000.00"), updated.getCreditLimit());
        assertEquals(15, updated.getBillingDay());
        assertEquals(25, updated.getRepaymentDay());
        assertEquals(1, updated.getIsShared());
        assertEquals("updated", updated.getRemark());
    }

    @Test
    void changeStatusShouldDisableAccount() {
        Long familyId = 1L;
        Long accountId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);
        account.setStatus(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));
        when(accountRepository.save(any(Account.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Account disabled = accountService.changeStatus(accountId, false);

        assertEquals(0, disabled.getStatus());
    }

    @Test
    void createShouldRejectOwnerMemberOutsideFamily() {
        Long familyId = 1L;

        Family family = new Family();
        family.setId(familyId);

        FamilyMember owner = new FamilyMember();
        owner.setId(15L);
        owner.setFamilyId(2L);
        owner.setStatus(1);

        when(familyService.getById(familyId)).thenReturn(family);
        when(familyMemberRepository.findByIdAndStatus(15L, 1)).thenReturn(Optional.of(owner));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> accountService.create(
                        new AccountApiModels.CreateRequest(
                                familyId,
                                15L,
                                "Wallet",
                                "CASH",
                                "Bank",
                                "1234",
                                new BigDecimal("100.00"),
                                BigDecimal.ZERO,
                                10,
                                20,
                                1,
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("account owner member does not belong to family", exception.getReason());
    }

    @Test
    void updateShouldRejectInvalidBillingDay() {
        Long familyId = 1L;
        Long accountId = 10L;

        Family family = new Family();
        family.setId(familyId);

        Account account = new Account();
        account.setId(accountId);
        account.setFamilyId(familyId);

        when(familyService.getById(familyId)).thenReturn(family);
        when(accountRepository.findById(accountId)).thenReturn(Optional.of(account));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> accountService.update(
                        accountId,
                        new AccountApiModels.UpdateRequest(
                                null,
                                "Wallet",
                                "CASH",
                                null,
                                null,
                                BigDecimal.ZERO,
                                32,
                                null,
                                1,
                                null
                        )
                )
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("billingDay must be between 1 and 31", exception.getReason());
    }
}
