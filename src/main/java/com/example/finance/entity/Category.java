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
        name = "category",
        indexes = {
                @Index(name = "idx_category_family_id", columnList = "family_id"),
                @Index(name = "idx_category_parent_id", columnList = "parent_id"),
                @Index(name = "idx_category_type_enabled", columnList = "category_type, enabled")
        }
)
public class Category extends AbstractAuditEntity {

    @Column(name = "family_id")
    private Long familyId;

    @Column(name = "parent_id")
    private Long parentId;

    @Column(name = "category_name", nullable = false, length = 50)
    private String categoryName;

    @Column(name = "category_type", nullable = false, length = 20)
    private String categoryType;

    @Column(name = "scope_type", nullable = false, length = 20)
    private String scopeType = "FAMILY";

    @Column(name = "icon_code", length = 50)
    private String iconCode;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @Column(name = "enabled", nullable = false)
    private Integer enabled = 1;
}
