package com.example.finance.controller;

import com.example.finance.dto.RuleDTO;
import com.example.finance.mapper.RuleMapper;
import com.example.finance.service.RuleService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/rule")
public class RuleController {

    private final RuleService ruleService;

    public RuleController(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    /**
     * 查询所有规则（管理端用）
     */
    @GetMapping("/list")
    public List<RuleDTO> list() {
        return ruleService.listAll()
                .stream()
                .map(RuleMapper::toDTO)
                .toList();
    }
}
