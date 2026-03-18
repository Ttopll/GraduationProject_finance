package com.example.finance.service;

import com.example.finance.dto.DebtApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Debt;
import com.example.finance.entity.DebtRepayment;
import com.example.finance.entity.FamilyMember;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.DebtRepaymentRepository;
import com.example.finance.repository.DebtRepository;
import com.example.finance.repository.FamilyMemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DebtService {

    private static final String ACTIVE = "ACTIVE";
    private static final String CLEARED = "CLEARED";

    private final DebtRepository debtRepository;
    private final DebtRepaymentRepository debtRepaymentRepository;
    private final AccountRepository accountRepository;
    private final FamilyService familyService;
    private final NotificationService notificationService;
    private final FamilyMemberRepository familyMemberRepository;

    public DebtService(
            DebtRepository debtRepository,
            DebtRepaymentRepository debtRepaymentRepository,
            AccountRepository accountRepository,
            FamilyService familyService,
            NotificationService notificationService,
            FamilyMemberRepository familyMemberRepository
    ) {
        this.debtRepository = debtRepository;
        this.debtRepaymentRepository = debtRepaymentRepository;
        this.accountRepository = accountRepository;
        this.familyService = familyService;
        this.notificationService = notificationService;
        this.familyMemberRepository = familyMemberRepository;
    }

    @Transactional
    public Debt create(DebtApiModels.CreateRequest request) {
        familyService.getById(request.familyId());
        validateFamilyMember(
                request.familyId(),
                request.debtorMemberId(),
                "debt debtor member not found",
                "debt debtor member does not belong to family"
        );

        Debt debt = new Debt();
        debt.setFamilyId(request.familyId());
        debt.setCurrentBalance(request.principalAmount());
        debt.setStatus(ACTIVE);
        applyDebtFields(
                debt,
                request.debtorMemberId(),
                request.debtName(),
                request.debtType(),
                request.lenderName(),
                request.principalAmount(),
                request.annualRate(),
                request.billingDay(),
                request.repaymentDay(),
                request.dueDate(),
                request.remark(),
                BigDecimal.ZERO
        );
        return debtRepository.save(debt);
    }

    @Transactional
    public Debt update(Long debtId, DebtApiModels.UpdateRequest request) {
        Debt debt = getDebt(debtId);
        familyService.getById(debt.getFamilyId());
        validateFamilyMember(
                debt.getFamilyId(),
                request.debtorMemberId(),
                "debt debtor member not found",
                "debt debtor member does not belong to family"
        );

        BigDecimal repaidPrincipal = debt.getPrincipalAmount().subtract(debt.getCurrentBalance());
        applyDebtFields(
                debt,
                request.debtorMemberId(),
                request.debtName(),
                request.debtType(),
                request.lenderName(),
                request.principalAmount(),
                request.annualRate(),
                request.billingDay(),
                request.repaymentDay(),
                request.dueDate(),
                request.remark(),
                repaidPrincipal
        );
        debt.setStatus(debt.getCurrentBalance().compareTo(BigDecimal.ZERO) == 0 ? CLEARED : ACTIVE);
        return debtRepository.save(debt);
    }

    @Transactional
    public Debt clear(Long debtId) {
        Debt debt = getDebt(debtId);
        familyService.getById(debt.getFamilyId());
        debt.setCurrentBalance(BigDecimal.ZERO);
        debt.setStatus(CLEARED);
        return debtRepository.save(debt);
    }

    @Transactional
    public void delete(Long debtId) {
        Debt debt = getDebt(debtId);
        familyService.getById(debt.getFamilyId());

        List<DebtRepayment> repayments = debtRepaymentRepository.findByDebtIdOrderByRepaymentTimeDescIdDesc(debtId);
        Map<Long, Account> accountCache = new LinkedHashMap<>();
        for (DebtRepayment repayment : repayments) {
            if (repayment.getPayAccountId() == null) {
                continue;
            }
            Account payAccount = getFamilyAccount(
                    repayment.getPayAccountId(),
                    debt.getFamilyId(),
                    "repayment account not found",
                    true,
                    accountCache
            );
            payAccount.setCurrentBalance(payAccount.getCurrentBalance().add(repayment.getAmount()));
        }

        saveAccounts(accountCache);
        if (!repayments.isEmpty()) {
            debtRepaymentRepository.deleteAll(repayments);
        }
        debtRepository.delete(debt);
    }

    public List<Debt> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return debtRepository.findByFamilyIdOrderByDueDateAscIdDesc(familyId);
    }

    public List<DebtRepayment> repaymentList(Long debtId) {
        getDebt(debtId);
        return debtRepaymentRepository.findByDebtIdOrderByRepaymentTimeDescIdDesc(debtId);
    }

    @Transactional
    public DebtRepayment repay(Long debtId, DebtApiModels.RepaymentCreateRequest request) {
        Debt debt = getDebt(debtId);
        if (!debt.getFamilyId().equals(request.familyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "debt does not belong to family");
        }
        validateFamilyMember(
                request.familyId(),
                request.createdByMemberId(),
                "repayment creator member not found",
                "repayment creator member does not belong to family"
        );

        Account payAccount = null;
        if (request.payAccountId() != null) {
            payAccount = accountRepository.findById(request.payAccountId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "repayment account not found"));
            if (!request.familyId().equals(payAccount.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "repayment account does not belong to family");
            }
            if (!Integer.valueOf(1).equals(payAccount.getStatus())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "account is inactive");
            }
        }

        BigDecimal principalPaid = request.principalPaid();
        BigDecimal interestPaid = request.interestPaid();
        if (principalPaid == null && interestPaid == null) {
            principalPaid = request.amount();
            interestPaid = BigDecimal.ZERO;
        } else {
            principalPaid = principalPaid == null ? BigDecimal.ZERO : principalPaid;
            interestPaid = interestPaid == null ? BigDecimal.ZERO : interestPaid;
        }
        if (principalPaid.compareTo(BigDecimal.ZERO) < 0 || interestPaid.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "principal and interest cannot be negative");
        }
        if (principalPaid.add(interestPaid).compareTo(request.amount()) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "repayment amount must equal principal plus interest");
        }
        if (principalPaid.compareTo(debt.getCurrentBalance()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "principal repayment cannot exceed current balance");
        }

        if (payAccount != null) {
            payAccount.setCurrentBalance(payAccount.getCurrentBalance().subtract(request.amount()));
            accountRepository.save(payAccount);
        }

        debt.setCurrentBalance(debt.getCurrentBalance().subtract(principalPaid));
        if (debt.getCurrentBalance().compareTo(BigDecimal.ZERO) == 0) {
            debt.setStatus(CLEARED);
        }
        debtRepository.save(debt);

        DebtRepayment debtRepayment = new DebtRepayment();
        debtRepayment.setDebtId(debtId);
        debtRepayment.setFamilyId(request.familyId());
        debtRepayment.setPayAccountId(request.payAccountId());
        debtRepayment.setCreatedByMemberId(request.createdByMemberId());
        debtRepayment.setAmount(request.amount());
        debtRepayment.setPrincipalPaid(principalPaid);
        debtRepayment.setInterestPaid(interestPaid);
        debtRepayment.setRepaymentTime(request.repaymentTime() == null ? LocalDateTime.now() : request.repaymentTime());
        debtRepayment.setNote(normalize(request.note()));
        return debtRepaymentRepository.save(debtRepayment);
    }

    @Transactional
    public DebtApiModels.ReminderCheckResponse checkReminders(Long familyId, Integer daysAhead) {
        familyService.getById(familyId);
        int safeDaysAhead = (daysAhead == null || daysAhead < 0) ? 7 : Math.min(daysAhead, 30);
        LocalDate today = LocalDate.now();
        LocalDate endDate = today.plusDays(safeDaysAhead);

        List<String> details = new ArrayList<>();
        int reminderCount = 0;
        for (Debt debt : debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, ACTIVE)) {
            if (debt.getCurrentBalance().compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            LocalDate nextReminderDate = resolveNextReminderDate(debt, today);
            if (nextReminderDate == null) {
                continue;
            }

            boolean overdue = nextReminderDate.isBefore(today);
            boolean inWindow = !overdue && !nextReminderDate.isAfter(endDate);
            if (!overdue && !inWindow) {
                continue;
            }

            String title = overdue ? "Debt overdue reminder" : "Debt due reminder";
            String content = overdue
                    ? String.format(
                    Locale.ROOT,
                    "Debt [%s] is overdue since %s, remaining balance is %.2f.",
                    debt.getDebtName(),
                    nextReminderDate,
                    debt.getCurrentBalance()
            )
                    : String.format(
                    Locale.ROOT,
                    "Debt [%s] will be due on %s, remaining balance is %.2f.",
                    debt.getDebtName(),
                    nextReminderDate,
                    debt.getCurrentBalance()
            );

            if (notificationService.createIfAbsentToday(
                    familyId,
                    debt.getDebtorMemberId(),
                    "DEBT",
                    debt.getId(),
                    title,
                    content,
                    overdue ? "WARN" : "INFO"
            ) != null) {
                reminderCount++;
                details.add(title + " - " + content);
            }
        }

        return new DebtApiModels.ReminderCheckResponse(today, safeDaysAhead, reminderCount, details);
    }

    public LocalDate resolveNextReminderDate(Debt debt, LocalDate baseDate) {
        if (debt.getDueDate() != null) {
            return debt.getDueDate();
        }
        if (debt.getRepaymentDay() == null) {
            return null;
        }
        YearMonth currentMonth = YearMonth.from(baseDate);
        LocalDate candidate = withSafeDay(currentMonth, debt.getRepaymentDay());
        if (candidate.isBefore(baseDate)) {
            candidate = withSafeDay(currentMonth.plusMonths(1), debt.getRepaymentDay());
        }
        return candidate;
    }

    public Debt getDebt(Long debtId) {
        return debtRepository.findById(debtId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "debt not found"));
    }

    private void applyDebtFields(
            Debt debt,
            Long debtorMemberId,
            String debtName,
            String debtType,
            String lenderName,
            BigDecimal principalAmount,
            BigDecimal annualRate,
            Integer billingDay,
            Integer repaymentDay,
            LocalDate dueDate,
            String remark,
            BigDecimal repaidPrincipal
    ) {
        if (principalAmount.compareTo(repaidPrincipal) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "principalAmount cannot be less than repaid principal");
        }
        debt.setDebtorMemberId(debtorMemberId);
        debt.setDebtName(debtName.trim());
        debt.setDebtType(debtType.trim().toUpperCase(Locale.ROOT));
        debt.setLenderName(normalize(lenderName));
        debt.setPrincipalAmount(principalAmount);
        debt.setCurrentBalance(principalAmount.subtract(repaidPrincipal));
        debt.setAnnualRate(annualRate == null ? BigDecimal.ZERO : annualRate);
        debt.setBillingDay(validateDayOfMonth(billingDay, "billingDay"));
        debt.setRepaymentDay(validateDayOfMonth(repaymentDay, "repaymentDay"));
        debt.setDueDate(dueDate);
        debt.setRemark(normalize(remark));
    }

    private LocalDate withSafeDay(YearMonth yearMonth, Integer repaymentDay) {
        int safeDay = Math.min(repaymentDay, yearMonth.lengthOfMonth());
        return yearMonth.atDay(safeDay);
    }

    private void validateFamilyMember(Long familyId, Long memberId, String notFoundMessage, String invalidMessage) {
        if (memberId == null) {
            return;
        }
        FamilyMember familyMember = familyMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, notFoundMessage));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, invalidMessage);
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

    private Account getFamilyAccount(
            Long accountId,
            Long familyId,
            String notFoundMessage,
            boolean allowInactive,
            Map<Long, Account> accountCache
    ) {
        Account account = accountCache.containsKey(accountId)
                ? accountCache.get(accountId)
                : accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, notFoundMessage));
        accountCache.putIfAbsent(accountId, account);
        if (!familyId.equals(account.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "account does not belong to family");
        }
        if (!allowInactive && !Integer.valueOf(1).equals(account.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "account is inactive");
        }
        return account;
    }

    private void saveAccounts(Map<Long, Account> accountCache) {
        for (Account account : accountCache.values()) {
            accountRepository.save(account);
        }
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
