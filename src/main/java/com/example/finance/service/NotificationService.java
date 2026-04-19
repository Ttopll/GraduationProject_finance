package com.example.finance.service;

import com.example.finance.dto.NotificationApiModels;
import com.example.finance.entity.Notification;
import com.example.finance.repository.NotificationRepository;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

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

    public NotificationApiModels.SearchPageResponse search(
            Long familyId,
            Long targetMemberId,
            Integer readStatus,
            String sourceType,
            Integer page,
            Integer size
    ) {
        if (readStatus != null && readStatus != 0 && readStatus != 1) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "readStatus only supports 0 or 1");
        }
        String normalizedSourceType = StringUtils.hasText(sourceType)
                ? sourceType.trim().toUpperCase(Locale.ROOT)
                : null;
        List<Notification> notifications = list(familyId, targetMemberId);

        List<Notification> filtered = notifications.stream()
                .filter(notification -> readStatus == null || readStatus.equals(notification.getReadStatus()))
                .filter(notification -> normalizedSourceType == null
                        || normalizedSourceType.equalsIgnoreCase(notification.getSourceType()))
                .toList();

        int safePage = (page == null || page < 0) ? 0 : page;
        int safeSize = (size == null || size < 1) ? 20 : Math.min(size, 200);
        int fromIndex = Math.min(safePage * safeSize, filtered.size());
        int toIndex = Math.min(fromIndex + safeSize, filtered.size());

        List<NotificationApiModels.Response> items = filtered.subList(fromIndex, toIndex).stream()
                .map(NotificationService::toResponse)
                .toList();
        int totalPages = filtered.isEmpty() ? 0 : (int) Math.ceil(filtered.size() * 1.0 / safeSize);
        return new NotificationApiModels.SearchPageResponse(
                items,
                safePage,
                safeSize,
                (long) filtered.size(),
                totalPages
        );
    }

    @Transactional
    public Notification markRead(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "notification not found"));
        familyAccessService.requireNotificationAccess(notification);
        notification.setReadStatus(1);
        if (notification.getSentAt() == null) {
            notification.setSentAt(LocalDateTime.now());
        }
        return notificationRepository.save(notification);
    }

    @Transactional
    public int markAllRead(Long familyId, Long targetMemberId) {
        List<Notification> notifications = list(familyId, targetMemberId);
        int affectedCount = 0;
        LocalDateTime now = LocalDateTime.now();
        for (Notification notification : notifications) {
            if (Integer.valueOf(1).equals(notification.getReadStatus())) {
                continue;
            }
            notification.setReadStatus(1);
            if (notification.getSentAt() == null) {
                notification.setSentAt(now);
            }
            affectedCount++;
        }
        if (affectedCount > 0) {
            notificationRepository.saveAll(notifications);
        }
        return affectedCount;
    }

    @Transactional
    public void delete(Long notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "notification not found"));
        familyAccessService.requireNotificationAccess(notification);
        notificationRepository.delete(notification);
    }

    @Transactional
    public int deleteRead(Long familyId, Long targetMemberId) {
        List<Notification> notifications = list(familyId, targetMemberId);
        List<Notification> readNotifications = notifications.stream()
                .filter(notification -> Integer.valueOf(1).equals(notification.getReadStatus()))
                .toList();
        if (readNotifications.isEmpty()) {
            return 0;
        }
        notificationRepository.deleteAll(readNotifications);
        return readNotifications.size();
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

    private static NotificationApiModels.Response toResponse(Notification notification) {
        return new NotificationApiModels.Response(
                notification.getId(),
                notification.getFamilyId(),
                notification.getTargetMemberId(),
                notification.getSourceType(),
                notification.getSourceId(),
                notification.getTitle(),
                notification.getContent(),
                notification.getLevelCode(),
                notification.getReadStatus(),
                notification.getSentAt(),
                notification.getCreatedAt()
        );
    }
}
