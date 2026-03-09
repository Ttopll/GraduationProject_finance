package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "rule_execution_log",
        indexes = {
                @Index(name = "idx_rule_execution_log_rule_id", columnList = "rule_id"),
                @Index(name = "idx_rule_execution_log_family_id", columnList = "family_id"),
                @Index(name = "idx_rule_execution_log_status_time", columnList = "result_status, trigger_time")
        }
)
public class RuleExecutionLog extends AbstractAuditEntity {

    @Column(name = "rule_id", nullable = false)
    private Long ruleId;

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "result_status", nullable = false, length = 20)
    private String resultStatus;

    @Column(name = "metric_value", precision = 14, scale = 2)
    private BigDecimal metricValue;

    @Column(name = "context_json", columnDefinition = "json")
    private String contextJson;

    @Column(name = "message_snapshot", length = 255)
    private String messageSnapshot;

    @Column(name = "trigger_time", nullable = false)
    private LocalDateTime triggerTime;

    @PrePersist
    protected void initTriggerTime() {
        if (triggerTime == null) {
            triggerTime = LocalDateTime.now();
        }
    }
}
