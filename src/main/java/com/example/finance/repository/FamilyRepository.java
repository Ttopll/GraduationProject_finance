package com.example.finance.repository;

import com.example.finance.entity.Family;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FamilyRepository extends JpaRepository<Family, Long> {

    boolean existsByInviteCode(String inviteCode);

    List<Family> findAllByOrderByIdDesc();
}
