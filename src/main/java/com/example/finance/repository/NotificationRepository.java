package com.example.finance.repository;

import com.example.finance.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDateTime;
import java.util.List;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByFamilyIdOrderByCreatedAtDescIdDesc(Long familyId);

    List<Notification> findByFamilyIdAndTargetMemberIdOrderByCreatedAtDescIdDesc(Long familyId, Long targetMemberId);

    boolean existsByFamilyIdAndSourceTypeAndSourceIdAndTitleAndCreatedAtBetween(
            Long familyId,
            String sourceType,
            Long sourceId,
            String title,
            LocalDateTime start,
            LocalDateTime end
    );
}
