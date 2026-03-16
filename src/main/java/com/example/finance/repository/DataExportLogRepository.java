package com.example.finance.repository;

import com.example.finance.entity.DataExportLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DataExportLogRepository extends JpaRepository<DataExportLog, Long> {

    List<DataExportLog> findByFamilyIdOrderByCreatedAtDescIdDesc(Long familyId);
}
