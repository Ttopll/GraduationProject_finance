package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
@Entity
@Table(
        name = "fixed_asset",
        indexes = {
                @Index(name = "idx_fixed_asset_family_id", columnList = "family_id"),
                @Index(name = "idx_fixed_asset_owner_member_id", columnList = "owner_member_id"),
                @Index(name = "idx_fixed_asset_type_status", columnList = "asset_type, status")
        }
)
public class FixedAsset extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "owner_member_id")
    private Long ownerMemberId;

    @Column(name = "asset_name", nullable = false, length = 100)
    private String assetName;

    @Column(name = "asset_type", nullable = false, length = 20)
    private String assetType;

    @Column(name = "purchase_amount", nullable = false, precision = 14, scale = 2)
    private BigDecimal purchaseAmount;

    @Column(name = "purchase_date")
    private LocalDate purchaseDate;

    @Column(name = "valuation_amount", precision = 14, scale = 2)
    private BigDecimal valuationAmount;

    @Column(name = "valuation_date")
    private LocalDate valuationDate;

    @Column(name = "remark", length = 255)
    private String remark;

    @Column(name = "status", nullable = false)
    private Integer status = 1;
}
