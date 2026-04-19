package com.example.finance.repository;

import com.example.finance.entity.BillParseRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillParseRuleRepository extends JpaRepository<BillParseRule, Long> {

    List<BillParseRule> findByFamilyIdOrderByPriorityAscIdAsc(Long familyId);

    List<BillParseRule> findByFamilyIdAndEnabledOrderByPriorityAscIdAsc(Long familyId, Integer enabled);

    List<BillParseRule> findByFamilyIdIsNullAndEnabledOrderByPriorityAscIdAsc(Integer enabled);

    boolean existsByFamilyIdAndCategoryId(Long familyId, Long categoryId);
}
