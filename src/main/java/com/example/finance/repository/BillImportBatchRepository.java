package com.example.finance.repository;

import com.example.finance.entity.BillImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BillImportBatchRepository extends JpaRepository<BillImportBatch, Long> {

    List<BillImportBatch> findByFamilyIdOrderByCreatedAtDescIdDesc(Long familyId);
}
