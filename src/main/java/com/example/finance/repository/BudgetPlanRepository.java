package com.example.finance.repository;

import com.example.finance.entity.BudgetPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BudgetPlanRepository extends JpaRepository<BudgetPlan, Long> {

    List<BudgetPlan> findByFamilyIdOrderByIdDesc(Long familyId);

    List<BudgetPlan> findByFamilyIdAndEnabledOrderByIdDesc(Long familyId, Integer enabled);

    boolean existsByFamilyIdAndCategoryId(Long familyId, Long categoryId);
}
