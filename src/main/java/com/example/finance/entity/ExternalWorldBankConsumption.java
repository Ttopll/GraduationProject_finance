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
        name = "external_world_bank_consumption",
        indexes = {
                @Index(name = "idx_ext_wb_country_year", columnList = "country_iso3,period_year")
        }
)
public class ExternalWorldBankConsumption extends AbstractAuditEntity {

    @Column(name = "source_dataset", nullable = false, length = 80)
    private String sourceDataset;

    @Column(name = "country_iso3", nullable = false, length = 8)
    private String countryIso3;

    @Column(name = "country_name", length = 100)
    private String countryName;

    @Column(name = "indicator", length = 80)
    private String indicator;

    @Column(name = "period_year", nullable = false)
    private Integer periodYear;

    @Column(name = "metric_value", precision = 18, scale = 4)
    private BigDecimal metricValue;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;
}
