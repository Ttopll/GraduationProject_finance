package com.example.finance.repository;

import com.example.finance.entity.DebtRepayment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtRepaymentRepository extends JpaRepository<DebtRepayment, Long> {

    List<DebtRepayment> findByDebtIdOrderByRepaymentTimeDescIdDesc(Long debtId);

    boolean existsByFamilyIdAndPayAccountId(Long familyId, Long payAccountId);
}
