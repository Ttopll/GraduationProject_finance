package com.example.finance.service;

import com.example.finance.dto.AuthApiModels;
import com.example.finance.entity.SysUser;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FamilyRepository;
import com.example.finance.repository.SysUserRepository;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.JwtService;
import com.example.finance.util.PasswordHashUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTests {

    @Mock
    private SysUserRepository sysUserRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private FamilyRepository familyRepository;

    @Mock
    private JwtService jwtService;

    @Mock
    private CurrentUserService currentUserService;

    @InjectMocks
    private AuthService authService;

    @Test
    void changePasswordShouldUpdatePasswordHash() {
        SysUser currentUser = new SysUser();
        currentUser.setId(1L);
        currentUser.setPasswordHash(PasswordHashUtil.sha256("OldPass123"));

        when(currentUserService.requireCurrentUserEntity()).thenReturn(currentUser);
        when(sysUserRepository.save(any(SysUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        authService.changePassword(new AuthApiModels.ChangePasswordRequest("OldPass123", "NewPass123"));

        verify(sysUserRepository).save(currentUser);
        assertEquals(PasswordHashUtil.sha256("NewPass123"), currentUser.getPasswordHash());
    }

    @Test
    void changePasswordShouldRejectWrongOldPassword() {
        SysUser currentUser = new SysUser();
        currentUser.setId(1L);
        currentUser.setPasswordHash(PasswordHashUtil.sha256("OldPass123"));
        when(currentUserService.requireCurrentUserEntity()).thenReturn(currentUser);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.changePassword(new AuthApiModels.ChangePasswordRequest("WrongPass123", "NewPass123"))
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("旧密码错误", exception.getReason());
        verify(sysUserRepository, never()).save(any(SysUser.class));
    }

    @Test
    void changePasswordShouldRejectSamePassword() {
        SysUser currentUser = new SysUser();
        currentUser.setId(1L);
        currentUser.setPasswordHash(PasswordHashUtil.sha256("SamePass123"));
        when(currentUserService.requireCurrentUserEntity()).thenReturn(currentUser);

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> authService.changePassword(new AuthApiModels.ChangePasswordRequest("SamePass123", "SamePass123"))
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("新密码不能与旧密码相同", exception.getReason());
        verify(sysUserRepository, never()).save(any(SysUser.class));
    }
}
