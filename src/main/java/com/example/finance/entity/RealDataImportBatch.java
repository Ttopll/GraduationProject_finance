package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "real_data_import_batch",
        indexes = {
                @Index(name = "idx_real_data_import_batch_created_at", columnList = "created_at"),
                @Index(name = "idx_real_data_import_batch_status", columnList = "import_status")
        }
)
public class RealDataImportBatch extends AbstractAuditEntity {

    @Column(name = "processed_dir", nullable = false, length = 255)
    private String processedDir;

    @Column(name = "truncated_before_import", nullable = false)
    private Boolean truncatedBeforeImport;

    @Column(name = "batch_size", nullable = false)
    private Integer batchSize;

    @Column(name = "retail_imported", nullable = false)
    private Integer retailImported;

    @Column(name = "world_bank_imported", nullable = false)
    private Integer worldBankImported;

    @Column(name = "fred_imported", nullable = false)
    private Integer fredImported;

    @Column(name = "import_status", nullable = false, length = 20)
    private String importStatus;

    @Column(name = "imported_at", nullable = false)
    private LocalDateTime importedAt;
}
