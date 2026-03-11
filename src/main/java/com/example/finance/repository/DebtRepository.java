package com.example.finance.repository;

import com.example.finance.entity.Debt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtRepository extends JpaRepository<Debt, Long> {

    List<Debt> findByFamilyIdOrderByDueDateAscIdDesc(Long familyId);

    List<Debt> findByFamilyIdAndStatusOrderByDueDateAscIdAsc(Long familyId, String status);
}
