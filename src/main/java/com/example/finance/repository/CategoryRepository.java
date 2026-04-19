package com.example.finance.repository;

import com.example.finance.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByFamilyIdOrderBySortOrderAscIdAsc(Long familyId);

    boolean existsByFamilyIdAndParentId(Long familyId, Long parentId);
}
