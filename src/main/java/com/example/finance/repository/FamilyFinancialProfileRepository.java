package com.example.finance.repository;

import com.example.finance.entity.FamilyFinancialProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FamilyFinancialProfileRepository extends JpaRepository<FamilyFinancialProfile, Long> {

    Optional<FamilyFinancialProfile> findByFamilyId(Long familyId);

    long deleteByFamilyId(Long familyId);
}
