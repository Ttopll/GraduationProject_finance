package com.example.finance.repository;

import com.example.finance.entity.BillImportPendingItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillImportPendingItemRepository extends JpaRepository<BillImportPendingItem, Long> {

    List<BillImportPendingItem> findByFamilyIdOrderByCreatedAtDescIdDesc(Long familyId);

    List<BillImportPendingItem> findByFamilyIdAndStatusOrderByCreatedAtDescIdDesc(Long familyId, String status);
}
