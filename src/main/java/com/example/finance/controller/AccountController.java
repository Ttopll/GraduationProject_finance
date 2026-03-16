package com.example.finance.controller;

import com.example.finance.dto.AccountApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.FamilyMember;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;
    private final FamilyAccessService familyAccessService;
    private final CurrentUserService currentUserService;

    public AccountController(
            AccountService accountService,
            FamilyAccessService familyAccessService,
            CurrentUserService currentUserService
    ) {
        this.accountService = accountService;
        this.familyAccessService = familyAccessService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountApiModels.Response create(@Valid @RequestBody AccountApiModels.CreateRequest request) {
        FamilyMember currentMember = familyAccessService.requireFamilyRead(request.familyId());
        Long normalizedOwnerMemberId = resolveCreateOwnerMemberId(request.familyId(), request.ownerMemberId(), currentMember);
        AccountApiModels.CreateRequest normalizedRequest = new AccountApiModels.CreateRequest(
                request.familyId(),
                normalizedOwnerMemberId,
                request.accountName(),
                request.accountType(),
                request.institutionName(),
                request.accountNoMask(),
                request.currentBalance(),
                request.creditLimit(),
                request.billingDay(),
                request.repaymentDay(),
                request.isShared(),
                request.remark()
        );
        return toResponse(accountService.create(normalizedRequest));
    }

    @PutMapping("/{accountId}")
    public AccountApiModels.Response update(
            @PathVariable Long accountId,
            @Valid @RequestBody AccountApiModels.UpdateRequest request
    ) {
        Account account = accountService.getById(accountId);
        FamilyMember currentMember = requireAccountManagePermission(account);
        AccountApiModels.UpdateRequest normalizedRequest = new AccountApiModels.UpdateRequest(
                resolveUpdatedOwnerMemberId(account, request.ownerMemberId()),
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
        return toResponse(accountService.update(accountId, normalizedRequest));
    }

    @PostMapping("/{accountId}/enable")
    public AccountApiModels.Response enable(@PathVariable Long accountId) {
        Account account = accountService.getById(accountId);
        requireAccountManagePermission(account);
        return toResponse(accountService.changeStatus(accountId, true));
    }

    @PostMapping("/{accountId}/disable")
    public AccountApiModels.Response disable(@PathVariable Long accountId) {
        Account account = accountService.getById(accountId);
        requireAccountManagePermission(account);
        return toResponse(accountService.changeStatus(accountId, false));
    }

    @GetMapping
    public List<AccountApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return accountService.listByFamilyId(familyId).stream()
                .map(AccountController::toResponse)
                .toList();
    }

    private Long resolveCreateOwnerMemberId(Long familyId, Long requestedOwnerMemberId, FamilyMember currentMember) {
        if (requestedOwnerMemberId != null) {
            return familyAccessService.resolveManagedMemberId(familyId, requestedOwnerMemberId, false);
        }
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return null;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return null;
        }
        return familyAccessService.resolveManagedMemberId(familyId, null, true);
    }

    private FamilyMember requireAccountManagePermission(Account account) {
        FamilyMember currentMember = familyAccessService.requireFamilyRead(account.getFamilyId());
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return currentMember;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return currentMember;
        }
        if (currentMember != null && account.getOwnerMemberId() != null
                && account.getOwnerMemberId().equals(currentMember.getId())) {
            return currentMember;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "cannot manage this account");
    }

    private Long resolveUpdatedOwnerMemberId(Account account, Long requestedOwnerMemberId) {
        if (requestedOwnerMemberId == null) {
            return account.getOwnerMemberId();
        }
        return familyAccessService.resolveManagedMemberId(account.getFamilyId(), requestedOwnerMemberId, false);
    }

    private static AccountApiModels.Response toResponse(Account account) {
        return new AccountApiModels.Response(
                account.getId(),
                account.getFamilyId(),
                account.getOwnerMemberId(),
                account.getAccountName(),
                account.getAccountType(),
                account.getInstitutionName(),
                account.getAccountNoMask(),
                account.getCurrentBalance(),
                account.getCreditLimit(),
                account.getBillingDay(),
                account.getRepaymentDay(),
                account.getIsShared(),
                account.getStatus(),
                account.getRemark()
        );
    }
}
