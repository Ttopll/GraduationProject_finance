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
        name = "bill_import_batch",
        indexes = {
                @Index(name = "idx_bill_import_batch_family_id", columnList = "family_id"),
                @Index(name = "idx_bill_import_batch_uploaded_by", columnList = "uploaded_by_member_id"),
                @Index(name = "idx_bill_import_batch_status", columnList = "import_status")
        }
)
public class BillImportBatch extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "uploaded_by_member_id", nullable = false)
    private Long uploadedByMemberId;

    @Column(name = "source_platform", nullable = false, length = 20)
    private String sourcePlatform;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;

    @Column(name = "file_hash", length = 64)
    private String fileHash;

    @Column(name = "file_path", length = 255)
    private String filePath;

    @Column(name = "total_count", nullable = false)
    private Integer totalCount = 0;

    @Column(name = "success_count", nullable = false)
    private Integer successCount = 0;

    @Column(name = "fail_count", nullable = false)
    private Integer failCount = 0;

    @Column(name = "import_status", nullable = false, length = 20)
    private String importStatus = "PENDING";

    @Column(name = "error_summary", length = 500)
    private String errorSummary;

    @Column(name = "imported_at")
    private LocalDateTime importedAt;
}
