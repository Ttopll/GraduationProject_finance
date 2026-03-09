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
        name = "notification",
        indexes = {
                @Index(name = "idx_notification_family_id", columnList = "family_id"),
                @Index(name = "idx_notification_target_member_id", columnList = "target_member_id"),
                @Index(name = "idx_notification_read_status_created_at", columnList = "read_status, created_at")
        }
)
public class Notification extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "target_member_id")
    private Long targetMemberId;

    @Column(name = "source_type", nullable = false, length = 20)
    private String sourceType;

    @Column(name = "source_id")
    private Long sourceId;

    @Column(name = "title", nullable = false, length = 100)
    private String title;

    @Column(name = "content", nullable = false, length = 500)
    private String content;

    @Column(name = "level_code", nullable = false, length = 20)
    private String levelCode = "INFO";

    @Column(name = "read_status", nullable = false)
    private Integer readStatus = 0;

    @Column(name = "sent_at")
    private LocalDateTime sentAt;
}
