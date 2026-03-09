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
        name = "transaction_record",
        indexes = {
                @Index(name = "idx_transaction_record_family_time", columnList = "family_id, transaction_time"),
                @Index(name = "idx_transaction_record_account_time", columnList = "account_id, transaction_time"),
                @Index(name = "idx_transaction_record_category_time", columnList = "category_id, transaction_time"),
                @Index(name = "idx_transaction_record_source_batch_id", columnList = "source_batch_id")
        }
)
public class TransactionRecord extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "account_id", nullable = false)
    private Long accountId;

    @Column(name = "target_account_id")
    private Long targetAccountId;

    @Column(name = "category_id")
    private Long categoryId;

    @Column(name = "created_by_member_id")
    private Long createdByMemberId;

    @Column(name = "source_batch_id")
    private Long sourceBatchId;

    @Column(name = "transaction_type", nullable = false, length = 20)
    private String transactionType;

    @Column(name = "amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "transaction_time", nullable = false)
    private LocalDateTime transactionTime;

    @Column(name = "merchant_name", length = 100)
    private String merchantName;

    @Column(name = "counterparty_name", length = 100)
    private String counterpartyName;

    @Column(name = "source_platform", nullable = false, length = 20)
    private String sourcePlatform = "MANUAL";

    @Column(name = "external_trade_no", length = 64)
    private String externalTradeNo;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "status", nullable = false)
    private Integer status = 1;
}
