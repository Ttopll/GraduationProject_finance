package com.example.finance.repository;

import com.example.finance.entity.RealDataImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RealDataImportBatchRepository extends JpaRepository<RealDataImportBatch, Long> {

    List<RealDataImportBatch> findTop20ByOrderByCreatedAtDescIdDesc();
}
