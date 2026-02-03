package com.example.finance.repository;

import com.example.finance.entity.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface TransactionRepository
        extends JpaRepository<Transaction, Long> {

    // 按时间区间查询交易记录
    List<Transaction> findByTimeBetween(
            LocalDateTime start,
            LocalDateTime end
    );

    // 按类别查询
    List<Transaction> findByCategory(String category);
}