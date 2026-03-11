package com.example.finance.repository;

import com.example.finance.entity.RuleExecutionLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RuleExecutionLogRepository extends JpaRepository<RuleExecutionLog, Long> {
}
