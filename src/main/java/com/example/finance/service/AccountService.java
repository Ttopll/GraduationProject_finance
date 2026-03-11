package com.example.finance.service;

import com.example.finance.dto.AccountApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.FamilyMemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class AccountService {

    private final AccountRepository accountRepository;
    private final FamilyService familyService;
    private final FamilyMemberRepository familyMemberRepository;

    public AccountService(
            AccountRepository accountRepository,
            FamilyService familyService,
            FamilyMemberRepository familyMemberRepository
    ) {
        this.accountRepository = accountRepository;
        this.familyService = familyService;
        this.familyMemberRepository = familyMemberRepository;
    }

    public Account create(AccountApiModels.CreateRequest request) {
        familyService.getById(request.familyId());

        if (request.ownerMemberId() != null) {
            FamilyMember familyMember = familyMemberRepository.findById(request.ownerMemberId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "账户归属成员不存在"));
            if (!request.familyId().equals(familyMember.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账户归属成员不属于当前家庭");
            }
        }

        Account account = new Account();
        account.setFamilyId(request.familyId());
        account.setOwnerMemberId(request.ownerMemberId());
        account.setAccountName(request.accountName().trim());
        account.setAccountType(request.accountType().trim().toUpperCase(Locale.ROOT));
        account.setInstitutionName(normalize(request.institutionName()));
        account.setAccountNoMask(normalize(request.accountNoMask()));
        account.setCurrentBalance(defaultAmount(request.currentBalance()));
        account.setCreditLimit(defaultAmount(request.creditLimit()));
        account.setBillingDay(request.billingDay());
        account.setRepaymentDay(request.repaymentDay());
        account.setIsShared(request.isShared() == null ? 1 : request.isShared());
        account.setStatus(1);
        account.setRemark(normalize(request.remark()));
        return accountRepository.save(account);
    }

    public List<Account> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return accountRepository.findByFamilyIdOrderByIdDesc(familyId);
    }

    public Account getById(Long accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "账户不存在"));
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
