package com.example.finance.service;

import com.example.finance.dto.AuthApiModels;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.SysUser;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FamilyRepository;
import com.example.finance.repository.SysUserRepository;
import com.example.finance.security.AuthenticatedUser;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.JwtService;
import com.example.finance.util.PasswordHashUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AuthService {

    private static final int ACTIVE_STATUS = 1;

    private final SysUserRepository sysUserRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyRepository familyRepository;
    private final JwtService jwtService;
    private final CurrentUserService currentUserService;

    public AuthService(
            SysUserRepository sysUserRepository,
            FamilyMemberRepository familyMemberRepository,
            FamilyRepository familyRepository,
            JwtService jwtService,
            CurrentUserService currentUserService
    ) {
        this.sysUserRepository = sysUserRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.familyRepository = familyRepository;
        this.jwtService = jwtService;
        this.currentUserService = currentUserService;
    }

    @Transactional
    public AuthApiModels.LoginResponse login(AuthApiModels.LoginRequest request) {
        SysUser user = sysUserRepository.findByUsername(request.username().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误"));
        if (user.getStatus() == null || user.getStatus() != ACTIVE_STATUS) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "用户已被禁用");
        }
        if (!PasswordHashUtil.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "用户名或密码错误");
        }

        user.setLastLoginAt(LocalDateTime.now());
        SysUser savedUser = sysUserRepository.save(user);
        AuthenticatedUser authenticatedUser = AuthenticatedUser.from(savedUser);
        return new AuthApiModels.LoginResponse(
                jwtService.generateToken(authenticatedUser),
                "Bearer",
                jwtService.getExpirationSeconds(),
                toUserProfile(savedUser),
                listMemberships(savedUser.getId())
        );
    }

    public AuthApiModels.MeResponse me() {
        SysUser currentUser = currentUserService.requireCurrentUserEntity();
        return new AuthApiModels.MeResponse(
                toUserProfile(currentUser),
                listMemberships(currentUser.getId())
        );
    }

    private List<AuthApiModels.Membership> listMemberships(Long userId) {
        List<FamilyMember> memberships = familyMemberRepository.findByUserIdAndStatusOrderByJoinedAtDescIdDesc(
                userId,
                ACTIVE_STATUS
        );
        Map<Long, Family> familyMap = new LinkedHashMap<>();
        for (Family family : familyRepository.findAllById(memberships.stream().map(FamilyMember::getFamilyId).distinct().toList())) {
            familyMap.put(family.getId(), family);
        }

        return memberships.stream()
                .map(member -> new AuthApiModels.Membership(
                        member.getFamilyId(),
                        familyMap.containsKey(member.getFamilyId()) ? familyMap.get(member.getFamilyId()).getFamilyName() : null,
                        member.getId(),
                        member.getRoleCode(),
                        member.getStatus(),
                        member.getJoinedAt()
                ))
                .toList();
    }

    private AuthApiModels.UserProfile toUserProfile(SysUser user) {
        return new AuthApiModels.UserProfile(
                user.getId(),
                user.getUsername(),
                user.getNickname(),
                user.getRealName(),
                user.getPhone(),
                user.getEmail(),
                user.getUserType(),
                user.getStatus(),
                user.getLastLoginAt()
        );
    }
}
