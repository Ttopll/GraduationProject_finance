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
import java.util.List;
import java.util.Locale;

@Service
public class DebtService {

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
        validateFamilyMember(request.familyId(), request.debtorMemberId(), "债务归属成员不存在", "债务归属成员不属于当前家庭");

        Debt debt = new Debt();
        debt.setFamilyId(request.familyId());
        debt.setDebtorMemberId(request.debtorMemberId());
        debt.setDebtName(request.debtName().trim());
        debt.setDebtType(request.debtType().trim().toUpperCase(Locale.ROOT));
        debt.setLenderName(normalize(request.lenderName()));
        debt.setPrincipalAmount(request.principalAmount());
        debt.setCurrentBalance(request.principalAmount());
        debt.setAnnualRate(request.annualRate() == null ? BigDecimal.ZERO : request.annualRate());
        debt.setBillingDay(request.billingDay());
        debt.setRepaymentDay(request.repaymentDay());
        debt.setDueDate(request.dueDate());
        debt.setStatus("ACTIVE");
        debt.setRemark(normalize(request.remark()));
        return debtRepository.save(debt);
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "债务不属于当前家庭");
        }
        validateFamilyMember(request.familyId(), request.createdByMemberId(), "还款记录创建人不存在", "还款记录创建人不属于当前家庭");

        Account payAccount = null;
        if (request.payAccountId() != null) {
            payAccount = accountRepository.findById(request.payAccountId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "付款账户不存在"));
            if (!request.familyId().equals(payAccount.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "付款账户不属于当前家庭");
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
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "本金和利息不能为负数");
        }
        if (principalPaid.add(interestPaid).compareTo(request.amount()) != 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "还款金额必须等于本金和利息之和");
        }
        if (principalPaid.compareTo(debt.getCurrentBalance()) > 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "归还本金不能超过当前剩余欠款");
        }

        if (payAccount != null) {
            payAccount.setCurrentBalance(payAccount.getCurrentBalance().subtract(request.amount()));
            accountRepository.save(payAccount);
        }

        debt.setCurrentBalance(debt.getCurrentBalance().subtract(principalPaid));
        if (debt.getCurrentBalance().compareTo(BigDecimal.ZERO) == 0) {
            debt.setStatus("CLEARED");
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
        for (Debt debt : debtRepository.findByFamilyIdAndStatusOrderByDueDateAscIdAsc(familyId, "ACTIVE")) {
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

            String title = overdue ? "债务逾期提醒" : "债务到期提醒";
            String content = overdue
                    ? String.format(
                    Locale.ROOT,
                    "债务[%s]已逾期，原到期日为 %s，当前剩余欠款 %.2f 元。",
                    debt.getDebtName(),
                    nextReminderDate,
                    debt.getCurrentBalance()
            )
                    : String.format(
                    Locale.ROOT,
                    "债务[%s]将于 %s 到期，当前剩余欠款 %.2f 元，请及时处理。",
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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "债务不存在"));
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

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
