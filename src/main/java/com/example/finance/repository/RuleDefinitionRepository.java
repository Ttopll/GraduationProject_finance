package com.example.finance.repository;

import com.example.finance.entity.RuleDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RuleDefinitionRepository extends JpaRepository<RuleDefinition, Long> {

    List<RuleDefinition> findByFamilyIdOrderByPriorityAscIdAsc(Long familyId);

    List<RuleDefinition> findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(Long familyId, Integer enabled);

    boolean existsByFamilyIdAndCategoryId(Long familyId, Long categoryId);
}
