package com.example.finance.controller;

import com.example.finance.dto.NotificationApiModels;
import com.example.finance.entity.Notification;
import com.example.finance.service.NotificationService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
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

    @PostMapping("/{notificationId}/read")
    public NotificationApiModels.Response markRead(@PathVariable Long notificationId) {
        return toResponse(notificationService.markRead(notificationId));
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
