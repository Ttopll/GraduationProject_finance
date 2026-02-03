package com.example.finance.mapper;

import com.example.finance.dto.RuleDTO;
import com.example.finance.entity.Rule;

public class RuleMapper {

    public static RuleDTO toDTO(Rule rule) {
        if (rule == null) {
            return null;
        }

        RuleDTO dto = new RuleDTO();
        dto.setCategory(rule.getCategory());
        dto.setThreshold(rule.getThreshold());
        dto.setMessage(rule.getMessage());
        return dto;
    }
}