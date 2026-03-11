package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalDateTime;
import java.util.List;

public final class AuthApiModels {

    private AuthApiModels() {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password
    ) {
    }

    public record UserProfile(
            Long id,
            String username,
            String nickname,
            String realName,
            String phone,
            String email,
            String userType,
            Integer status,
            LocalDateTime lastLoginAt
    ) {
    }

    public record Membership(
            Long familyId,
            String familyName,
            Long familyMemberId,
            String roleCode,
            Integer status,
            LocalDateTime joinedAt
    ) {
    }

    public record LoginResponse(
            String accessToken,
            String tokenType,
            Long expiresInSeconds,
            UserProfile user,
            List<Membership> memberships
    ) {
    }

    public record MeResponse(
            UserProfile user,
            List<Membership> memberships
    ) {
    }
}
