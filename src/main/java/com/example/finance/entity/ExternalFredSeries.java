package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "external_fred_series",
        indexes = {
                @Index(name = "idx_ext_fred_series_date", columnList = "series_id,metric_date")
        }
)
public class ExternalFredSeries extends AbstractAuditEntity {

    @Column(name = "source_dataset", nullable = false, length = 20)
    private String sourceDataset;

    @Column(name = "series_id", nullable = false, length = 30)
    private String seriesId;

    @Column(name = "series_name", length = 100)
    private String seriesName;

    @Column(name = "metric_date")
    private LocalDate metricDate;

    @Column(name = "metric_value", precision = 18, scale = 4)
    private BigDecimal metricValue;

    @Column(name = "fetched_at")
    private LocalDateTime fetchedAt;
}
