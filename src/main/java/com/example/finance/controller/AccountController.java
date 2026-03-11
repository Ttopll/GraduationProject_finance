package com.example.finance.controller;

import com.example.finance.dto.AccountApiModels;
import com.example.finance.entity.Account;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.AccountService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {

    private final AccountService accountService;
    private final FamilyAccessService familyAccessService;

    public AccountController(AccountService accountService, FamilyAccessService familyAccessService) {
        this.accountService = accountService;
        this.familyAccessService = familyAccessService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountApiModels.Response create(@Valid @RequestBody AccountApiModels.CreateRequest request) {
        familyAccessService.requireFamilyRead(request.familyId());
        AccountApiModels.CreateRequest normalizedRequest = new AccountApiModels.CreateRequest(
                request.familyId(),
                familyAccessService.resolveManagedMemberId(request.familyId(), request.ownerMemberId(), false),
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

    @GetMapping
    public List<AccountApiModels.Response> list(@RequestParam Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return accountService.listByFamilyId(familyId).stream()
                .map(AccountController::toResponse)
                .toList();
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
