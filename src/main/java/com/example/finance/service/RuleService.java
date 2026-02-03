package com.example.finance.service;

import com.example.finance.entity.Rule;
import com.example.finance.repository.RuleRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class RuleService {

    private final RuleRepository ruleRepository;

    public RuleService(RuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    public List<Rule> listAll() {
        return ruleRepository.findAll();
    }

    public Rule save(Rule rule) {
        return ruleRepository.save(rule);
    }
}
