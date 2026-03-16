package com.example.finance.repository;

import com.example.finance.entity.FinancialAdvice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface FinancialAdviceRepository extends JpaRepository<FinancialAdvice, Long> {

    List<FinancialAdvice> findByFamilyIdOrderByGeneratedAtDescIdDesc(Long familyId);

    List<FinancialAdvice> findByFamilyIdAndStatusOrderByGeneratedAtDescIdDesc(Long familyId, String status);

    boolean existsByFamilyIdAndAdviceTypeAndTitleAndGeneratedAtBetween(
            Long familyId,
            String adviceType,
            String title,
            LocalDateTime start,
            LocalDateTime end
    );
}
