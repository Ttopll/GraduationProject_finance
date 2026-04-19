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
        name = "external_retail_transaction",
        indexes = {
                @Index(name = "idx_ext_retail_invoice_time", columnList = "invoice_time"),
                @Index(name = "idx_ext_retail_country", columnList = "country")
        }
)
public class ExternalRetailTransaction extends AbstractAuditEntity {

    @Column(name = "source_dataset", nullable = false, length = 50)
    private String sourceDataset;

    @Column(name = "invoice_no", length = 50)
    private String invoiceNo;

    @Column(name = "stock_code", length = 50)
    private String stockCode;

    @Column(name = "description", length = 255)
    private String description;

    @Column(name = "quantity")
    private Integer quantity;

    @Column(name = "unit_price", precision = 14, scale = 4)
    private BigDecimal unitPrice;

    @Column(name = "amount", precision = 16, scale = 2)
    private BigDecimal amount;

    @Column(name = "invoice_time")
    private LocalDateTime invoiceTime;

    @Column(name = "customer_id", length = 50)
    private String customerId;

    @Column(name = "country", length = 100)
    private String country;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;
}
