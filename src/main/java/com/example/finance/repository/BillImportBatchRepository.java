package com.example.finance.repository;

import com.example.finance.entity.BillImportBatch;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface BillImportBatchRepository extends JpaRepository<BillImportBatch, Long> {

    List<BillImportBatch> findByFamilyIdOrderByCreatedAtDescIdDesc(Long familyId);

    Optional<BillImportBatch> findFirstByFamilyIdAndFileHashAndImportStatusInOrderByCreatedAtDescIdDesc(
            Long familyId,
            String fileHash,
            Collection<String> importStatuses
    );
}
