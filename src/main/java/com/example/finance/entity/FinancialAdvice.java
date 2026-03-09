package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "financial_advice",
        indexes = {
                @Index(name = "idx_financial_advice_family_id", columnList = "family_id"),
                @Index(name = "idx_financial_advice_rule_id", columnList = "rule_id"),
                @Index(name = "idx_financial_advice_status_generated_at", columnList = "status, generated_at")
        }
)
public class FinancialAdvice extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "rule_id")
    private Long ruleId;

    @Column(name = "advice_type", nullable = false, length = 20)
    private String adviceType;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "content", nullable = false, length = 500)
    private String content;

    @Column(name = "suggestion_level", nullable = false, length = 20)
    private String suggestionLevel = "NORMAL";

    @Column(name = "snapshot_json", columnDefinition = "json")
    private String snapshotJson;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "UNREAD";

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @PrePersist
    protected void initGeneratedAt() {
        if (generatedAt == null) {
            generatedAt = LocalDateTime.now();
        }
    }
}
