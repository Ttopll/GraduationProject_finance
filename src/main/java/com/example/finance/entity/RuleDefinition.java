package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(
        name = "rule_definition",
        indexes = {
                @Index(name = "idx_rule_definition_family_id", columnList = "family_id"),
                @Index(name = "idx_rule_definition_category_id", columnList = "category_id"),
                @Index(name = "idx_rule_definition_type_enabled", columnList = "rule_type, enabled")
        }
)
public class RuleDefinition extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "created_by_member_id")
    private Long createdByMemberId;

    @Column(name = "rule_name", nullable = false, length = 100)
    private String ruleName;

    @Column(name = "rule_type", nullable = false, length = 30)
    private String ruleType;

    @Column(name = "metric_type", nullable = false, length = 30)
    private String metricType;

    @Column(name = "time_scope", nullable = false, length = 20)
    private String timeScope = "MONTH";

    @Column(name = "operator_type", nullable = false, length = 10)
    private String operatorType;

    @Column(name = "threshold_value", precision = 14, scale = 2)
    private BigDecimal thresholdValue;

    @Column(name = "threshold_json", columnDefinition = "json")
    private String thresholdJson;

    @Column(name = "action_type", nullable = false, length = 20)
    private String actionType;

    @Column(name = "message_template", nullable = false, length = 255)
    private String messageTemplate;

    @Column(name = "enabled", nullable = false)
    private Integer enabled = 1;

    @Column(name = "priority", nullable = false)
    private Integer priority = 100;
}
