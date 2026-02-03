package com.example.finance.ruleengine;

import com.example.finance.entity.Rule;
import com.example.finance.entity.Transaction;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class RuleEngineService {

    public List<String> checkRules(List<Transaction> transactions, List<Rule> rules) {
        List<String> alerts = new ArrayList<>();

        for (Rule rule : rules) {
            BigDecimal sum = transactions.stream()
                    .filter(t -> t.getCategory().equals(rule.getCategory()))
                    .map(Transaction::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            if (sum.compareTo(rule.getThreshold()) > 0) {
                alerts.add(rule.getMessage());
            }
        }
        return alerts;
    }
}

