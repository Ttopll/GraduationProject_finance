package com.example.finance.repository;

import com.example.finance.entity.Family;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface FamilyRepository extends JpaRepository<Family, Long> {

    boolean existsByInviteCode(String inviteCode);

    Optional<Family> findByInviteCode(String inviteCode);

    List<Family> findAllByOrderByIdDesc();
}
