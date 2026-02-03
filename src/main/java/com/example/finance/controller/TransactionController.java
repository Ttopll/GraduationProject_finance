package com.example.finance.controller;

import com.example.finance.dto.TransactionDTO;
import com.example.finance.entity.Transaction;
import com.example.finance.mapper.TransactionMapper;
import com.example.finance.service.TransactionService;
import com.example.finance.util.CsvParserUtil;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/transaction")
public class TransactionController {

    private final TransactionService transactionService;

    public TransactionController(TransactionService transactionService) {
        this.transactionService = transactionService;
    }

    /**
     * 查询所有交易记录（小程序用）
     */
    @GetMapping("/list")
    public List<TransactionDTO> list() {
        return transactionService.listAll()
                .stream()
                .map(TransactionMapper::toDTO)
                .toList();
    }

    /**
     * 新增一条交易记录
     */
    @PostMapping("/add")
    public void add(@RequestBody Transaction transaction) {
        transactionService.save(transaction);
    }
}

