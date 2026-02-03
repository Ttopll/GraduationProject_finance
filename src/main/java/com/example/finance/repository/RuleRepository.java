package com.example.finance.repository;

import com.example.finance.entity.Rule;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RuleRepository
        extends JpaRepository<Rule, Long> {
}