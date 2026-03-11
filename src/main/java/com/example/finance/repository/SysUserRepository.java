package com.example.finance.repository;

import com.example.finance.entity.SysUser;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SysUserRepository extends JpaRepository<SysUser, Long> {

    boolean existsByUsername(String username);

    boolean existsByPhone(String phone);

    boolean existsByEmail(String email);

    List<SysUser> findAllByOrderByIdDesc();

    Optional<SysUser> findByUsername(String username);
}
