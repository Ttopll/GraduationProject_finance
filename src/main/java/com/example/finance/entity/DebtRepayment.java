package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "debt_repayment",
        indexes = {
                @Index(name = "idx_debt_repayment_debt_id", columnList = "debt_id"),
                @Index(name = "idx_debt_repayment_family_id", columnList = "family_id"),
                @Index(name = "idx_debt_repayment_time", columnList = "repayment_time")
        }
)
public class DebtRepayment extends AbstractAuditEntity {

    @Column(name = "debt_id", nullable = false)
    private Long debtId;

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "pay_account_id")
    private Long payAccountId;

    @Column(name = "created_by_member_id")
    private Long createdByMemberId;

    @Column(name = "amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "principal_paid", nullable = false, precision = 14, scale = 2)
    private BigDecimal principalPaid = BigDecimal.ZERO;

    @Column(name = "interest_paid", nullable = false, precision = 14, scale = 2)
    private BigDecimal interestPaid = BigDecimal.ZERO;

    @Column(name = "repayment_time", nullable = false)
    private LocalDateTime repaymentTime;

    @Column(name = "note", length = 255)
    private String note;
}
