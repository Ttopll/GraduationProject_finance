package com.example.finance.repository;

import com.example.finance.entity.FamilyMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FamilyMemberRepository extends JpaRepository<FamilyMember, Long> {

    boolean existsByFamilyIdAndUserId(Long familyId, Long userId);

    List<FamilyMember> findByFamilyIdOrderByIdAsc(Long familyId);

    Optional<FamilyMember> findByFamilyIdAndUserId(Long familyId, Long userId);

    Optional<FamilyMember> findByFamilyIdAndUserIdAndStatus(Long familyId, Long userId, Integer status);

    Optional<FamilyMember> findByIdAndStatus(Long id, Integer status);

    List<FamilyMember> findByUserIdAndStatusOrderByJoinedAtDescIdDesc(Long userId, Integer status);
}
