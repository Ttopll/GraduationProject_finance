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
        name = "debt",
        indexes = {
                @Index(name = "idx_debt_family_id", columnList = "family_id"),
                @Index(name = "idx_debt_debtor_member_id", columnList = "debtor_member_id"),
                @Index(name = "idx_debt_status_due_date", columnList = "status, due_date")
        }
)
public class Debt extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "debtor_member_id")
    private Long debtorMemberId;

    @Column(name = "debt_name", nullable = false, length = 100)
    private String debtName;

    @Column(name = "debt_type", nullable = false, length = 20)
    private String debtType;

    @Column(name = "lender_name", length = 100)
    private String lenderName;

    @Column(name = "principal_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal principalAmount;

    @Column(name = "current_balance", nullable = false, precision = 14, scale = 2)
    private BigDecimal currentBalance;

    @Column(name = "annual_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal annualRate = BigDecimal.ZERO;

    @Column(name = "billing_day")
    private Integer billingDay;

    @Column(name = "repayment_day")
    private Integer repaymentDay;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "ACTIVE";

    @Column(name = "remark", length = 255)
    private String remark;
}
