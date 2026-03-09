package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(
        name = "family_member",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_family_member_family_user", columnNames = {"family_id", "user_id"})
        },
        indexes = {
                @Index(name = "idx_family_member_user_id", columnList = "user_id"),
                @Index(name = "idx_family_member_role_code", columnList = "role_code")
        }
)
public class FamilyMember extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "member_name", length = 50)
    private String memberName;

    @Column(name = "role_code", nullable = false, length = 20)
    private String roleCode = "MEMBER";

    @Column(name = "permission_json", columnDefinition = "json")
    private String permissionJson;

    @Column(name = "status", nullable = false)
    private Integer status = 1;

    @Column(name = "joined_at", nullable = false)
    private LocalDateTime joinedAt;

    @PrePersist
    protected void initJoinedAt() {
        if (joinedAt == null) {
            joinedAt = LocalDateTime.now();
        }
    }
}
