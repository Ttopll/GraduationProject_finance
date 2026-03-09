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
        name = "account",
        indexes = {
                @Index(name = "idx_account_family_id", columnList = "family_id"),
                @Index(name = "idx_account_owner_member_id", columnList = "owner_member_id"),
                @Index(name = "idx_account_type_status", columnList = "account_type, status")
        }
)
public class Account extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "owner_member_id")
    private Long ownerMemberId;

    @Column(name = "account_name", nullable = false, length = 50)
    private String accountName;

    @Column(name = "account_type", nullable = false, length = 20)
    private String accountType;

    @Column(name = "institution_name", length = 100)
    private String institutionName;

    @Column(name = "account_no_mask", length = 64)
    private String accountNoMask;

    @Column(name = "current_balance", nullable = false, precision = 14, scale = 2)
    private BigDecimal currentBalance = BigDecimal.ZERO;

    @Column(name = "credit_limit", nullable = false, precision = 14, scale = 2)
    private BigDecimal creditLimit = BigDecimal.ZERO;

    @Column(name = "billing_day")
    private Integer billingDay;

    @Column(name = "repayment_day")
    private Integer repaymentDay;

    @Column(name = "is_shared", nullable = false)
    private Integer isShared = 1;

    @Column(name = "status", nullable = false)
    private Integer status = 1;

    @Column(name = "remark", length = 255)
    private String remark;
}
