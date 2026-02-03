package com.example.finance.service;

import com.example.finance.entity.Transaction;
import com.example.finance.repository.TransactionRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;

    public TransactionService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    // 查询全部交易
    public List<Transaction> listAll() {
        return transactionRepository.findAll();
    }

    // 保存一条交易
    public Transaction save(Transaction transaction) {
        return transactionRepository.save(transaction);
    }

    // 按时间查询
    public List<Transaction> listByTime(
            LocalDateTime start,
            LocalDateTime end
    ) {
        return transactionRepository.findByTimeBetween(start, end);
    }
}
