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
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
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
import java.util.Objects;

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

        Map<Long, Account> accountCache = new LinkedHashMap<>();
        Account account = getFamilyAccount(command.accountId(), command.familyId(), "transaction account not found", false, accountCache);
        Account targetAccount = getFamilyAccount(
                command.targetAccountId(),
                command.familyId(),
                "target account not found",
                false,
                accountCache
        );

        validateCategoryBelongsToFamily(command.familyId(), command.categoryId());
        validateCreatorMember(command.familyId(), command.createdByMemberId());

        String transactionType = normalizeTransactionType(command.transactionType());
        validateTransferAccounts(transactionType, account, targetAccount);
        applyTransactionImpact(transactionType, command.amount(), account, targetAccount, false);
        saveAccounts(accountCache);

        TransactionRecord transactionRecord = new TransactionRecord();
        transactionRecord.setFamilyId(command.familyId());
        transactionRecord.setAccountId(command.accountId());
        transactionRecord.setTargetAccountId(command.targetAccountId());
        transactionRecord.setCategoryId(command.categoryId());
        transactionRecord.setCreatedByMemberId(command.createdByMemberId());
        transactionRecord.setSourceBatchId(command.sourceBatchId());
        transactionRecord.setTransactionType(transactionType);
        transactionRecord.setAmount(command.amount());
        transactionRecord.setTransactionTime(command.transactionTime() == null ? LocalDateTime.now() : command.transactionTime());
        transactionRecord.setMerchantName(normalize(command.merchantName()));
        transactionRecord.setCounterpartyName(normalize(command.counterpartyName()));
        transactionRecord.setSourcePlatform(resolveSourcePlatform(command.sourcePlatform(), "MANUAL"));
        transactionRecord.setExternalTradeNo(normalize(command.externalTradeNo()));
        transactionRecord.setNote(normalize(command.note()));
        transactionRecord.setStatus(1);
        return transactionRecordRepository.save(transactionRecord);
    }

    public TransactionRecord getById(Long recordId) {
        return transactionRecordRepository.findById(recordId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction record not found"));
    }

    @Transactional
    public TransactionRecord update(Long recordId, TransactionRecordApiModels.UpdateRequest request) {
        TransactionRecord record = getById(recordId);
        familyService.getById(record.getFamilyId());

        Map<Long, Account> accountCache = new LinkedHashMap<>();
        Account originalAccount = getFamilyAccount(
                record.getAccountId(),
                record.getFamilyId(),
                "transaction account not found",
                true,
                accountCache
        );
        Account originalTargetAccount = getFamilyAccount(
                record.getTargetAccountId(),
                record.getFamilyId(),
                "target account not found",
                true,
                accountCache
        );
        Account updatedAccount = getFamilyAccount(
                request.accountId(),
                record.getFamilyId(),
                "transaction account not found",
                Objects.equals(request.accountId(), record.getAccountId()),
                accountCache
        );
        Account updatedTargetAccount = getFamilyAccount(
                request.targetAccountId(),
                record.getFamilyId(),
                "target account not found",
                Objects.equals(request.targetAccountId(), record.getTargetAccountId()),
                accountCache
        );

        validateCategoryBelongsToFamily(record.getFamilyId(), request.categoryId());
        if (request.createdByMemberId() != null && !Objects.equals(request.createdByMemberId(), record.getCreatedByMemberId())) {
            validateCreatorMember(record.getFamilyId(), request.createdByMemberId());
        }

        String transactionType = normalizeTransactionType(request.transactionType());
        validateTransferAccounts(transactionType, updatedAccount, updatedTargetAccount);

        applyTransactionImpact(record.getTransactionType(), record.getAmount(), originalAccount, originalTargetAccount, true);
        applyTransactionImpact(transactionType, request.amount(), updatedAccount, updatedTargetAccount, false);
        saveAccounts(accountCache);

        record.setAccountId(request.accountId());
        record.setTargetAccountId(request.targetAccountId());
        record.setCategoryId(request.categoryId());
        if (request.createdByMemberId() != null) {
            record.setCreatedByMemberId(request.createdByMemberId());
        }
        record.setTransactionType(transactionType);
        record.setAmount(request.amount());
        record.setTransactionTime(request.transactionTime());
        record.setMerchantName(normalize(request.merchantName()));
        record.setCounterpartyName(normalize(request.counterpartyName()));
        record.setSourcePlatform(resolveSourcePlatform(request.sourcePlatform(), record.getSourcePlatform()));
        record.setExternalTradeNo(normalize(request.externalTradeNo()));
        record.setNote(normalize(request.note()));
        return transactionRecordRepository.save(record);
    }

    @Transactional
    public void delete(Long recordId) {
        TransactionRecord record = getById(recordId);
        familyService.getById(record.getFamilyId());

        Map<Long, Account> accountCache = new LinkedHashMap<>();
        Account account = getFamilyAccount(
                record.getAccountId(),
                record.getFamilyId(),
                "transaction account not found",
                true,
                accountCache
        );
        Account targetAccount = getFamilyAccount(
                record.getTargetAccountId(),
                record.getFamilyId(),
                "target account not found",
                true,
                accountCache
        );

        applyTransactionImpact(record.getTransactionType(), record.getAmount(), account, targetAccount, true);
        saveAccounts(accountCache);
        transactionRecordRepository.delete(record);
    }

    public List<TransactionRecord> listByFamilyId(Long familyId) {
        familyService.getById(familyId);
        return transactionRecordRepository.findByFamilyIdOrderByTransactionTimeDescIdDesc(familyId);
    }

    public TransactionRecordApiModels.SearchPageResponse searchByFamilyId(
            Long familyId,
            String transactionType,
            LocalDateTime startTime,
            LocalDateTime endTime,
            Integer page,
            Integer size
    ) {
        familyService.getById(familyId);
        if (startTime != null && endTime != null && startTime.isAfter(endTime)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "startTime cannot be later than endTime");
        }

        int safePage = (page == null || page < 0) ? 0 : page;
        int safeSize = (size == null || size < 1) ? 20 : Math.min(size, 200);
        String normalizedType = StringUtils.hasText(transactionType)
                ? normalizeTransactionType(transactionType)
                : null;
        PageRequest pageable = PageRequest.of(
                safePage,
                safeSize,
                Sort.by(Sort.Direction.DESC, "transactionTime").and(Sort.by(Sort.Direction.DESC, "id"))
        );

        Specification<TransactionRecord> specification = (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("familyId"), familyId));
            if (normalizedType != null) {
                predicates.add(criteriaBuilder.equal(root.get("transactionType"), normalizedType));
            }
            if (startTime != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("transactionTime"), startTime));
            }
            if (endTime != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("transactionTime"), endTime));
            }
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };

        Page<TransactionRecord> pageResult = transactionRecordRepository.findAll(specification, pageable);
        return new TransactionRecordApiModels.SearchPageResponse(
                pageResult.getContent().stream().map(TransactionRecordService::toResponse).toList(),
                pageResult.getNumber(),
                pageResult.getSize(),
                pageResult.getTotalElements(),
                pageResult.getTotalPages()
        );
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

    private void validateCategoryBelongsToFamily(Long familyId, Long categoryId) {
        if (categoryId == null) {
            return;
        }
        Category category = categoryRepository.findById(categoryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction category not found"));
        if (!familyId.equals(category.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transaction category does not belong to family");
        }
    }

    private void validateCreatorMember(Long familyId, Long createdByMemberId) {
        if (createdByMemberId == null) {
            return;
        }
        FamilyMember familyMember = familyMemberRepository.findById(createdByMemberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "transaction creator member not found"));
        if (!familyId.equals(familyMember.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transaction creator member does not belong to family");
        }
    }

    private String normalizeTransactionType(String transactionType) {
        String normalizedTransactionType = transactionType.trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_TRANSACTION_TYPES.contains(normalizedTransactionType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transactionType only supports INCOME, EXPENSE, TRANSFER");
        }
        return normalizedTransactionType;
    }

    private void validateTransferAccounts(String transactionType, Account account, Account targetAccount) {
        if ("TRANSFER".equals(transactionType)) {
            if (targetAccount == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transfer transaction must specify targetAccountId");
            }
            if (account.getId().equals(targetAccount.getId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "source and target account cannot be the same");
            }
            return;
        }
        if (targetAccount != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "targetAccountId is only supported for transfer");
        }
    }

    private void applyTransactionImpact(
            String transactionType,
            BigDecimal amount,
            Account account,
            Account targetAccount,
            boolean reverse
    ) {
        BigDecimal delta = reverse ? amount.negate() : amount;
        switch (transactionType) {
            case "INCOME" -> account.setCurrentBalance(account.getCurrentBalance().add(delta));
            case "EXPENSE" -> account.setCurrentBalance(account.getCurrentBalance().subtract(delta));
            case "TRANSFER" -> {
                if (targetAccount == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "transfer transaction target account is missing");
                }
                account.setCurrentBalance(account.getCurrentBalance().subtract(delta));
                targetAccount.setCurrentBalance(targetAccount.getCurrentBalance().add(delta));
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "unsupported transaction type");
        }
    }

    private void saveAccounts(Map<Long, Account> accountCache) {
        for (Account account : accountCache.values()) {
            accountRepository.save(account);
        }
    }

    private Account getFamilyAccount(
            Long accountId,
            Long familyId,
            String notFoundMessage,
            boolean allowInactive,
            Map<Long, Account> accountCache
    ) {
        if (accountId == null) {
            return null;
        }
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

    private String resolveSourcePlatform(String sourcePlatform, String defaultValue) {
        return StringUtils.hasText(sourcePlatform)
                ? sourcePlatform.trim().toUpperCase(Locale.ROOT)
                : defaultValue;
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static TransactionRecordApiModels.Response toResponse(TransactionRecord record) {
        return new TransactionRecordApiModels.Response(
                record.getId(),
                record.getFamilyId(),
                record.getAccountId(),
                record.getTargetAccountId(),
                record.getCategoryId(),
                record.getCreatedByMemberId(),
                record.getSourceBatchId(),
                record.getTransactionType(),
                record.getAmount(),
                record.getTransactionTime(),
                record.getMerchantName(),
                record.getCounterpartyName(),
                record.getSourcePlatform(),
                record.getExternalTradeNo(),
                record.getNote(),
                record.getStatus()
        );
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
