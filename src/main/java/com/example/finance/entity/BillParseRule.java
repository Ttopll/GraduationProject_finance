package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "bill_parse_rule",
        indexes = {
                @Index(name = "idx_bill_parse_rule_family_id", columnList = "family_id"),
                @Index(name = "idx_bill_parse_rule_category_id", columnList = "category_id"),
                @Index(name = "idx_bill_parse_rule_priority_enabled", columnList = "priority, enabled")
        }
)
public class BillParseRule extends AbstractAuditEntity {

    @Column(name = "family_id")
    private Long familyId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "merchant_keyword", length = 100)
    private String merchantKeyword;

    @Column(name = "regex_pattern", length = 255)
    private String regexPattern;

    @Column(name = "priority", nullable = false)
    private Integer priority = 100;

    @Column(name = "enabled", nullable = false)
    private Integer enabled = 1;

    @Column(name = "hit_count", nullable = false)
    private Integer hitCount = 0;

    @Column(name = "last_hit_at")
    private LocalDateTime lastHitAt;
}
