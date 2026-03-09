package com.example.finance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(
        name = "family_financial_profile",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_family_financial_profile_family_id", columnNames = {"family_id"})
        }
)
public class FamilyFinancialProfile extends AbstractAuditEntity {

    @Column(name = "family_id", nullable = false)
    private Long familyId;

    @Column(name = "risk_preference", nullable = false, length = 20)
    private String riskPreference = "LOW";

    @Column(name = "savings_target_rate", precision = 5, scale = 2)
    private BigDecimal savingsTargetRate;

    @Column(name = "emergency_fund_months")
    private Integer emergencyFundMonths;

    @Column(name = "investment_preference_json", columnDefinition = "json")
    private String investmentPreferenceJson;
}
