package com.example.finance.repository;

import com.example.finance.entity.TransactionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface TransactionRecordRepository extends JpaRepository<TransactionRecord, Long>, JpaSpecificationExecutor<TransactionRecord> {

    List<TransactionRecord> findByFamilyIdOrderByTransactionTimeDescIdDesc(Long familyId);

    List<TransactionRecord> findByFamilyIdAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
            Long familyId,
            LocalDateTime start,
            LocalDateTime end
    );

    List<TransactionRecord> findByFamilyIdAndTransactionTypeAndTransactionTimeBetweenOrderByTransactionTimeAscIdAsc(
            Long familyId,
            String transactionType,
            LocalDateTime start,
            LocalDateTime end
    );

    boolean existsByFamilyIdAndSourcePlatformAndExternalTradeNo(
            Long familyId,
            String sourcePlatform,
            String externalTradeNo
    );

    Optional<TransactionRecord> findByIdAndFamilyId(Long id, Long familyId);

    boolean existsByFamilyIdAndCategoryId(Long familyId, Long categoryId);

    boolean existsByFamilyIdAndAccountId(Long familyId, Long accountId);

    boolean existsByFamilyIdAndTargetAccountId(Long familyId, Long targetAccountId);
}
