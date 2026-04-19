package com.example.finance.service;

import com.example.finance.entity.Family;
import com.example.finance.entity.Notification;
import com.example.finance.repository.NotificationRepository;
import com.example.finance.security.AuthenticatedUser;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTests {

    @Mock
    private NotificationRepository notificationRepository;

    @Mock
    private FamilyService familyService;

    @Mock
    private FamilyAccessService familyAccessService;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private NotificationService notificationService;

    @Test
    void markAllReadShouldOnlyUpdateUnreadNotifications() {
        Long familyId = 1L;

        Family family = new Family();
        family.setId(familyId);

        Notification unread = new Notification();
        unread.setId(10L);
        unread.setFamilyId(familyId);
        unread.setReadStatus(0);
        unread.setSentAt(null);

        Notification read = new Notification();
        read.setId(11L);
        read.setFamilyId(familyId);
        read.setReadStatus(1);
        read.setSentAt(LocalDateTime.now());

        when(familyService.getById(familyId)).thenReturn(family);
        when(familyAccessService.requireFamilyRead(familyId)).thenReturn(null);
        when(currentUserService.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(1L, "admin", "hash", "ADMIN", 1)
        );
        when(notificationRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId)).thenReturn(List.of(unread, read));

        int affected = notificationService.markAllRead(familyId, null);

        assertEquals(1, affected);
        assertEquals(1, unread.getReadStatus());
        assertTrue(unread.getSentAt() != null);
        verify(notificationRepository).saveAll(List.of(unread, read));
    }

    @Test
    void deleteShouldRemoveNotification() {
        Long notificationId = 10L;
        Long familyId = 1L;

        Notification notification = new Notification();
        notification.setId(notificationId);
        notification.setFamilyId(familyId);

        when(notificationRepository.findById(notificationId)).thenReturn(Optional.of(notification));

        notificationService.delete(notificationId);

        verify(notificationRepository).delete(notification);
    }

    @Test
    void deleteReadShouldDeleteOnlyReadNotifications() {
        Long familyId = 1L;

        Family family = new Family();
        family.setId(familyId);

        Notification read = new Notification();
        read.setId(20L);
        read.setFamilyId(familyId);
        read.setReadStatus(1);

        Notification unread = new Notification();
        unread.setId(21L);
        unread.setFamilyId(familyId);
        unread.setReadStatus(0);

        when(familyService.getById(familyId)).thenReturn(family);
        when(familyAccessService.requireFamilyRead(familyId)).thenReturn(null);
        when(currentUserService.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(1L, "admin", "hash", "ADMIN", 1)
        );
        when(notificationRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId)).thenReturn(List.of(read, unread));

        int affected = notificationService.deleteRead(familyId, null);

        assertEquals(1, affected);
        verify(notificationRepository).deleteAll(List.of(read));
    }

    @Test
    void searchShouldReturnPagedUnreadNotifications() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);

        Notification unread = new Notification();
        unread.setId(30L);
        unread.setFamilyId(familyId);
        unread.setReadStatus(0);
        unread.setSourceType("RULE");
        unread.setTitle("rule-notify");

        Notification read = new Notification();
        read.setId(31L);
        read.setFamilyId(familyId);
        read.setReadStatus(1);
        read.setSourceType("DEBT");
        read.setTitle("debt-notify");

        when(familyService.getById(familyId)).thenReturn(family);
        when(familyAccessService.requireFamilyRead(familyId)).thenReturn(null);
        when(currentUserService.requireCurrentUser()).thenReturn(
                new AuthenticatedUser(1L, "admin", "hash", "ADMIN", 1)
        );
        when(notificationRepository.findByFamilyIdOrderByCreatedAtDescIdDesc(familyId))
                .thenReturn(List.of(unread, read));

        var page = notificationService.search(familyId, null, 0, "rule", 0, 10);

        assertEquals(1, page.items().size());
        assertEquals(30L, page.items().get(0).id());
        assertEquals(1L, page.totalElements());
        assertEquals(1, page.totalPages());
    }

    @Test
    void searchShouldRejectInvalidReadStatus() {
        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> notificationService.search(1L, null, 2, null, 0, 20)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("readStatus only supports 0 or 1", exception.getReason());
    }
}
