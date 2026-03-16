package com.example.finance.service;

import com.example.finance.dto.TransactionRecordApiModels;
import com.example.finance.entity.Account;
import com.example.finance.entity.Category;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.TransactionRecord;
import com.example.finance.repository.AccountRepository;
import com.example.finance.repository.CategoryRepository;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.TransactionRecordRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class TransactionRecordService {

    private static final DateTimeFormatter MONTH_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM");
    private static final List<String> SUPPORTED_TRANSACTION_TYPES = List.of("INCOME", "EXPENSE", "TRANSFER");

    private final TransactionRecordRepository transactionRecordRepository;
    private final AccountRepository accountRepository;
    private final CategoryRepository categoryRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyService familyService;

    public TransactionRecordService(
            TransactionRecordRepository transactionRecordRepository,
            AccountRepository accountRepository,
            CategoryRepository categoryRepository,
            FamilyMemberRepository familyMemberRepository,
            FamilyService familyService
    ) {
        this.transactionRecordRepository = transactionRecordRepository;
        this.accountRepository = accountRepository;
        this.categoryRepository = categoryRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.familyService = familyService;
    }

    @Transactional
    public TransactionRecord create(TransactionRecordApiModels.CreateRequest request) {
        return createRecord(new CreateCommand(
                request.familyId(),
                request.accountId(),
                request.targetAccountId(),
                request.categoryId(),
                request.createdByMemberId(),
                request.sourceBatchId(),
                request.transactionType(),
                request.amount(),
                request.transactionTime(),
                request.merchantName(),
                request.counterpartyName(),
                request.sourcePlatform(),
                request.externalTradeNo(),
                request.note()
        ));
    }

    @Transactional
    public TransactionRecord createRecord(CreateCommand command) {
        familyService.getById(command.familyId());
        Account account = getFamilyAccount(command.accountId(), command.familyId(), "交易账户不存在");
        Account targetAccount = null;
        if (command.targetAccountId() != null) {
            targetAccount = getFamilyAccount(command.targetAccountId(), command.familyId(), "目标账户不存在");
        }

        if (command.categoryId() != null) {
            Category category = categoryRepository.findById(command.categoryId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "交易分类不存在"));
            if (!command.familyId().equals(category.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "交易分类不属于当前家庭");
            }
        }

        if (command.createdByMemberId() != null) {
            FamilyMember familyMember = familyMemberRepository.findById(command.createdByMemberId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "创建人不存在"));
            if (!command.familyId().equals(familyMember.getFamilyId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "创建人不属于当前家庭");
            }
        }

        String transactionType = command.transactionType().trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_TRANSACTION_TYPES.contains(transactionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "交易类型仅支持 INCOME、EXPENSE、TRANSFER");
        }
        if ("TRANSFER".equals(transactionType) && targetAccount == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "转账交易必须指定目标账户");
        }

        BigDecimal amount = command.amount();
        switch (transactionType) {
            case "INCOME" -> account.setCurrentBalance(account.getCurrentBalance().add(amount));
            case "EXPENSE" -> account.setCurrentBalance(account.getCurrentBalance().subtract(amount));
            case "TRANSFER" -> {
                if (account.getId().equals(targetAccount.getId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "转出账户和转入账户不能相同");
                }
                account.setCurrentBalance(account.getCurrentBalance().subtract(amount));
                targetAccount.setCurrentBalance(targetAccount.getCurrentBalance().add(amount));
                accountRepository.save(targetAccount);
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "不支持的交易类型");
        }
        accountRepository.save(account);

        TransactionRecord transactionRecord = new TransactionRecord();
        transactionRecord.setFamilyId(command.familyId());
        transactionRecord.setAccountId(command.accountId());
        transactionRecord.setTargetAccountId(command.targetAccountId());
        transactionRecord.setCategoryId(command.categoryId());
        transactionRecord.setCreatedByMemberId(command.createdByMemberId());
        transactionRecord.setSourceBatchId(command.sourceBatchId());
        transactionRecord.setTransactionType(transactionType);
        transactionRecord.setAmount(amount);
        transactionRecord.setTransactionTime(command.transactionTime() == null ? LocalDateTime.now() : command.transactionTime());
        transactionRecord.setMerchantName(normalize(command.merchantName()));
        transactionRecord.setCounterpartyName(normalize(command.counterpartyName()));
        transactionRecord.setSourcePlatform(StringUtils.hasText(command.sourcePlatform())
                ? command.sourcePlatform().trim().toUpperCase(Locale.ROOT)
                : "MANUAL");
        transactionRecord.setExternalTradeNo(normalize(command.externalTradeNo()));
        transactionRecord.setNote(normalize(command.note()));
        transactionRecord.setStatus(1);
        return transactionRecordRepository.save(transactionRecord);
    }

    public List<TransactionRecord> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return transactionRecordRepository.findByFamilyIdOrderByTransactionTimeDescIdDesc(familyId);
    }

    public List<TransactionRecordApiModels.MonthlySummaryResponse> monthlySummary(Long familyId, Integer months) {
        familyService.getById(familyId);
        int safeMonths = (months == null || months < 1) ? 6 : Math.min(months, 24);

        YearMonth currentMonth = YearMonth.now();
        YearMonth startMonth = currentMonth.minusMonths(safeMonths - 1L);
        LocalDateTime start = startMonth.atDay(1).atStartOfDay();
        LocalDateTime end = currentMonth.plusMonths(1).atDay(1).atStartOfDay().minusNanos(1);

        List<TransactionRecord> records = transactionRecordRepository
                .findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(familyId, start, end);

        Map<YearMonth, SummaryBucket> summaryMap = new LinkedHashMap<>();
        YearMonth cursor = startMonth;
        while (!cursor.isAfter(currentMonth)) {
            summaryMap.put(cursor, new SummaryBucket());
            cursor = cursor.plusMonths(1);
        }

        for (TransactionRecord record : records) {
            YearMonth month = YearMonth.from(record.getTransactionTime());
            SummaryBucket bucket = summaryMap.get(month);
            if (bucket == null) {
                continue;
            }
            switch (record.getTransactionType()) {
                case "INCOME" -> bucket.income = bucket.income.add(record.getAmount());
                case "EXPENSE" -> bucket.expense = bucket.expense.add(record.getAmount());
                default -> {
                }
            }
        }

        List<TransactionRecordApiModels.MonthlySummaryResponse> response = new ArrayList<>();
        for (Map.Entry<YearMonth, SummaryBucket> entry : summaryMap.entrySet()) {
            SummaryBucket bucket = entry.getValue();
            response.add(new TransactionRecordApiModels.MonthlySummaryResponse(
                    entry.getKey().format(MONTH_FORMATTER),
                    bucket.income,
                    bucket.expense,
                    bucket.income.subtract(bucket.expense)
            ));
        }
        return response;
    }

    private Account getFamilyAccount(Long accountId, Long familyId, String notFoundMessage) {
        Account account = accountRepository.findById(accountId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, notFoundMessage));
        if (!familyId.equals(account.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "账户不属于当前家庭");
        }
        if (!Integer.valueOf(1).equals(account.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "account is inactive");
        }
        return account;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static class SummaryBucket {
        private BigDecimal income = BigDecimal.ZERO;
        private BigDecimal expense = BigDecimal.ZERO;
    }

    public record CreateCommand(
            Long familyId,
            Long accountId,
            Long targetAccountId,
            Long categoryId,
            Long createdByMemberId,
            Long sourceBatchId,
            String transactionType,
            BigDecimal amount,
            LocalDateTime transactionTime,
            String merchantName,
            String counterpartyName,
            String sourcePlatform,
            String externalTradeNo,
            String note
    ) {
    }
}
