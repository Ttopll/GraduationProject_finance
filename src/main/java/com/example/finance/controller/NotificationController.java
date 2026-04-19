package com.example.finance.controller;

import com.example.finance.dto.NotificationApiModels;
import com.example.finance.entity.Notification;
import com.example.finance.service.NotificationService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationApiModels.Response> list(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long targetMemberId
    ) {
        return notificationService.list(familyId, targetMemberId).stream()
                .map(NotificationController::toResponse)
                .toList();
    }

    @GetMapping("/search")
    public NotificationApiModels.SearchPageResponse search(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long targetMemberId,
            @RequestParam(required = false) Integer readStatus,
            @RequestParam(required = false) String sourceType,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size
    ) {
        return notificationService.search(familyId, targetMemberId, readStatus, sourceType, page, size);
    }

    @PostMapping("/{notificationId}/read")
    public NotificationApiModels.Response markRead(@PathVariable Long notificationId) {
        return toResponse(notificationService.markRead(notificationId));
    }

    @PostMapping("/read-all")
    public NotificationApiModels.BulkActionResponse markAllRead(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long targetMemberId
    ) {
        return new NotificationApiModels.BulkActionResponse(
                notificationService.markAllRead(familyId, targetMemberId)
        );
    }

    @DeleteMapping("/{notificationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long notificationId) {
        notificationService.delete(notificationId);
    }

    @DeleteMapping("/read")
    public NotificationApiModels.BulkActionResponse deleteRead(
            @RequestParam Long familyId,
            @RequestParam(required = false) Long targetMemberId
    ) {
        return new NotificationApiModels.BulkActionResponse(
                notificationService.deleteRead(familyId, targetMemberId)
        );
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
