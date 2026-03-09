package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "budget_plan",
        indexes = {
                @Index(name = "idx_budget_plan_family_id", columnList = "family_id"),
                @Index(name = "idx_budget_plan_category_id", columnList = "category_id"),
                @Index(name = "idx_budget_plan_period_enabled", columnList = "period_type, enabled")
        }
)
public class BudgetPlan extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    @Column(name = "created_by_member_id")
    private Long createdByMemberId;

    @Column(name = "budget_name", nullable = false, length = 100)
    private String budgetName;

    @Column(name = "period_type", nullable = false, length = 20)
    private String periodType;

    @Column(name = "amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "alert_ratio", nullable = false, precision = 5, scale = 2)
    private BigDecimal alertRatio = new BigDecimal("0.80");

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "enabled", nullable = false)
    private Integer enabled = 1;

    @Column(name = "remark", length = 255)
    private String remark;
}
