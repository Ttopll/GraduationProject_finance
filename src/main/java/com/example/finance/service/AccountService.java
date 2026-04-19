package com.example.finance.service;

import com.example.finance.dto.AccountApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.DebtRepaymentRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;

@Service
public class AccountService {

    private static final int ACTIVE_STATUS = 1;
    private static final int INACTIVE_STATUS = 0;

    private final AccountRepository accountRepository;
    private final TransactionRecordRepository transactionRecordRepository;
    private final DebtRepaymentRepository debtRepaymentRepository;
    private final FamilyService familyService;
    private final FamilyMemberRepository familyMemberRepository;

    public AccountService(
            AccountRepository accountRepository,
            TransactionRecordRepository transactionRecordRepository,
            DebtRepaymentRepository debtRepaymentRepository,
            FamilyService familyService,
            FamilyMemberRepository familyMemberRepository
    ) {
        this.accountRepository = accountRepository;
        this.transactionRecordRepository = transactionRecordRepository;
        this.debtRepaymentRepository = debtRepaymentRepository;
        this.familyService = familyService;
        this.familyMemberRepository = familyMemberRepository;
    }

    @Transactional
    public Account create(AccountApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateOwnerMember(request.familyId(), request.ownerMemberId());

        Account account = new Account();
        account.setFamilyId(request.familyId());
        account.setCurrentBalance(defaultAmount(request.currentBalance()));
        account.setStatus(ACTIVE_STATUS);
        applyAccountFields(
                account,
                request.ownerMemberId(),
                request.accountName(),
                request.accountType(),
                request.institutionName(),
                request.accountNoMask(),
                request.creditLimit(),
                request.billingDay(),
                request.repaymentDay(),
                request.isShared(),
                request.remark()
        );
        return accountRepository.save(account);
    }

    @Transactional
    public Account update(Long accountId, AccountApiModels.UpdateRequest request) {
        Account account = getById(accountId);
        familyService.getById(account.getFamilyId());
        validateOwnerMember(account.getFamilyId(), request.ownerMemberId());

        applyAccountFields(
                account,
                request.ownerMemberId(),
                request.accountName(),
                request.accountType(),
                request.institutionName(),
                request.accountNoMask(),
                request.creditLimit(),
                request.billingDay(),
                request.repaymentDay(),
                request.isShared(),
                request.remark()
        );
        return accountRepository.save(account);
    }

    @Transactional
    public Account changeStatus(Long accountId, boolean active) {
        Account account = getById(accountId);
        familyService.getById(account.getFamilyId());
        account.setStatus(active ? ACTIVE_STATUS : INACTIVE_STATUS);
        return accountRepository.save(account);
    }

    @Transactional
    public void delete(Long accountId) {
        Account account = getById(accountId);
        familyService.getById(account.getFamilyId());

        Long familyId = account.getFamilyId();
        if (transactionRecordRepository.existsByFamilyIdAndAccountId(familyId, accountId)
                || transactionRecordRepository.existsByFamilyIdAndTargetAccountId(familyId, accountId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "account is referenced by transaction records");
        }
        if (debtRepaymentRepository.existsByFamilyIdAndPayAccountId(familyId, accountId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "account is referenced by debt repayments");
        }
        accountRepository.delete(account);
    }

    public List<Account> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return accountRepository.findByFamilyIdOrderByIdDesc(familyId);
    }

    public Account getById(Long accountId) {
        return accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account not found"));
    }

    private void applyAccountFields(
            Account account,
            Long ownerMemberId,
            String accountName,
            String accountType,
            String institutionName,
            String accountNoMask,
            BigDecimal creditLimit,
            Integer billingDay,
            Integer repaymentDay,
            Integer isShared,
            String remark
    ) {
        account.setOwnerMemberId(ownerMemberId);
        account.setAccountName(accountName.trim());
        account.setAccountType(accountType.trim().toUpperCase(Locale.ROOT));
        account.setInstitutionName(normalize(institutionName));
        account.setAccountNoMask(normalize(accountNoMask));
        account.setCreditLimit(defaultAmount(creditLimit));
        account.setBillingDay(validateDayOfMonth(billingDay, "billingDay"));
        account.setRepaymentDay(validateDayOfMonth(repaymentDay, "repaymentDay"));
        account.setIsShared(isShared == null ? 1 : isShared);
        account.setRemark(normalize(remark));
    }

    private void validateOwnerMember(Long familyId, Long ownerMemberId) {
        if (ownerMemberId == null) {
            return;
        }
        FamilyMember familyMember = familyMemberRepository.findByIdAndStatus(ownerMemberId, ACTIVE_STATUS)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "account owner member not found"));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "account owner member does not belong to family");
        }
    }

    private Integer validateDayOfMonth(Integer value, String fieldName) {
        if (value == null) {
            return null;
        }
        if (value < 1 || value > 31) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, fieldName + " must be between 1 and 31");
        }
        return value;
    }

    private BigDecimal defaultAmount(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
