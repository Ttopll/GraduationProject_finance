package com.example.finance.mapper;

import com.example.finance.dto.TransactionDTO;
import com.example.finance.entity.Transaction;

public class TransactionMapper {

    // Entity -> DTO
    public static TransactionDTO toDTO(Transaction entity) {
        if (entity == null) {
            return null;
        }

        TransactionDTO dto = new TransactionDTO();
        dto.setAmount(entity.getAmount());
        dto.setCategory(entity.getCategory());
        dto.setTime(entity.getTime());
        return dto;
    }
}
