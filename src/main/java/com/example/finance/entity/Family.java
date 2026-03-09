package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(
        name = "family",
        indexes = {
                @Index(name = "uk_family_invite_code", columnList = "invite_code", unique = true),
                @Index(name = "idx_family_owner_user_id", columnList = "owner_user_id")
        }
)
public class Family extends AbstractAuditEntity {

    @Column(name = "family_name", nullable = false, length = 100)
    private String familyName;

    @Column(name = "owner_user_id", nullable = false)
    private Long ownerUserId;

    @Column(name = "invite_code", nullable = false, length = 20)
    private String inviteCode;

    @Column(name = "currency_code", nullable = false, length = 10)
    private String currencyCode = "CNY";

    @Column(name = "timezone", nullable = false, length = 50)
    private String timezone = "Asia/Shanghai";

    @Column(name = "status", nullable = false)
    private Integer status = 1;

    @Column(name = "remark", length = 255)
    private String remark;
}
