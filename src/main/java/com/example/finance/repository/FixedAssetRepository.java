package com.example.finance.repository;

import com.example.finance.entity.FixedAsset;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FixedAssetRepository extends JpaRepository<FixedAsset, Long> {

    List<FixedAsset> findByFamilyIdOrderByPurchaseDateDescIdDesc(Long familyId);

    List<FixedAsset> findByFamilyIdAndStatusOrderByPurchaseDateDescIdDesc(Long familyId, Integer status);
}
