package com.example.finance.repository;

import com.example.finance.entity.TransactionRecord;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRecordRepository extends JpaRepository<TransactionRecord, Long> {

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
}
