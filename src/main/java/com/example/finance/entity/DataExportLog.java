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
        name = "data_export_log",
        indexes = {
                @Index(name = "idx_data_export_log_family_id", columnList = "family_id"),
                @Index(name = "idx_data_export_log_member_id", columnList = "requested_by_member_id"),
                @Index(name = "idx_data_export_log_status_created_at", columnList = "status, created_at")
        }
)
public class DataExportLog extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "requested_by_member_id")
    private Long requestedByMemberId;

    @Column(name = "export_type", nullable = false, length = 30)
    private String exportType;

    @Column(name = "file_format", nullable = false, length = 20)
    private String fileFormat;

    @Column(name = "file_path", length = 255)
    private String filePath;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PENDING";

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
