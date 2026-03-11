package com.example.finance.service;

import com.example.finance.entity.Notification;
import com.example.finance.repository.NotificationRepository;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final FamilyService familyService;
    private final FamilyAccessService familyAccessService;
    private final CurrentUserService currentUserService;

    public NotificationService(
            NotificationRepository notificationRepository,
            FamilyService familyService,
            FamilyAccessService familyAccessService,
            CurrentUserService currentUserService
    ) {
        this.notificationRepository = notificationRepository;
        this.familyService = familyService;
        this.familyAccessService = familyAccessService;
        this.currentUserService = currentUserService;
    }

    public List<Notification> list(Long familyId, Long targetMemberId) {
        familyService.getById(familyId);
        var currentMember = familyAccessService.requireFamilyRead(familyId);
        familyAccessService.requireNotificationTargetReadable(familyId, targetMemberId);

        List<Notification> notifications = targetMemberId == null
                ? notificationRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId)
                : notificationRepository.findByFamilyIdAndTargetMemberIdOrderByCreatedAtDescIdDesc(familyId, targetMemberId);
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return notifications;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return notifications;
        }
        Long currentMemberId = currentMember == null ? null : currentMember.getId();
        return notifications.stream()
                .filter(notification -> notification.getTargetMemberId() == null
                        || (currentMemberId != null && currentMemberId.equals(notification.getTargetMemberId())))
                .toList();
    }

    @Transactional
    public Notification markRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "消息不存在"));
        familyAccessService.requireNotificationAccess(notification);
        notification.setReadStatus(1);
        if (notification.getSentAt() == null) {
            notification.setSentAt(LocalDateTime.now());
        }
        return notificationRepository.save(notification);
    }

    @Transactional
    public Notification createIfAbsentToday(
            Long familyId,
            Long targetMemberId,
            String sourceType,
            Long sourceId,
            String title,
            String content,
            String levelCode
    ) {
        LocalDateTime start = LocalDateTime.now().toLocalDate().atStartOfDay();
        LocalDateTime end = start.plusDays(1).minusNanos(1);
        boolean exists = notificationRepository.existsByFamilyIdAndSourceTypeAndSourceIdAndTitleAndCreatedAtBetween(
                familyId,
                sourceType,
                sourceId,
                title,
                start,
                end
        );
        if (exists) {
            return null;
        }

        Notification notification = new Notification();
        notification.setFamilyId(familyId);
        notification.setTargetMemberId(targetMemberId);
        notification.setSourceType(sourceType);
        notification.setSourceId(sourceId);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setLevelCode(levelCode);
        notification.setReadStatus(0);
        notification.setSentAt(LocalDateTime.now());
        return notificationRepository.save(notification);
    }
}
