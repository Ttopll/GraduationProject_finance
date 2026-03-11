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
        name = "bill_import_pending_item",
        indexes = {
                @Index(name = "idx_bill_import_pending_family_status", columnList = "family_id, status"),
                @Index(name = "idx_bill_import_pending_batch_id", columnList = "source_batch_id"),
                @Index(name = "idx_bill_import_pending_record_id", columnList = "transaction_record_id")
        }
)
public class BillImportPendingItem extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "source_batch_id", nullable = false)
    private Long sourceBatchId;

    @Column(name = "transaction_record_id")
    private Long transactionRecordId;

    @Column(name = "source_platform", nullable = false, length = 20)
    private String sourcePlatform;

    @Column(name = "external_trade_no", length = 64)
    private String externalTradeNo;

    @Column(name = "merchant_name", length = 100)
    private String merchantName;

    @Column(name = "raw_category_name", length = 100)
    private String rawCategoryName;

    @Column(name = "transaction_type", nullable = false, length = 20)
    private String transactionType;

    @Column(name = "amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal amount;

    @Column(name = "transaction_time", nullable = false)
    private LocalDateTime transactionTime;

    @Column(name = "note", length = 255)
    private String note;

    @Column(name = "raw_line", columnDefinition = "text")
    private String rawLine;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "resolved_category_id")
    private Long resolvedCategoryId;

    @Column(name = "resolved_by_member_id")
    private Long resolvedByMemberId;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}
