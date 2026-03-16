package com.example.finance.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public final class FamilyApiModels {

    private FamilyApiModels() {
    }

    public record CreateRequest(
            @NotBlank @Size(max = 100) String familyName,
            @NotNull Long ownerUserId,
            @Size(max = 10) String currencyCode,
            @Size(max = 50) String timezone,
            @Size(max = 255) String remark
    ) {
    }

    public record Response(
            Long id,
            String familyName,
            Long ownerUserId,
            String inviteCode,
            String currencyCode,
            String timezone,
            Integer status,
            String remark
    ) {
    }

    public record JoinRequest(
            @NotBlank @Size(max = 20) String inviteCode,
            @Size(max = 50) String memberName
    ) {
    }

    public record MemberUpdateRequest(
            @NotBlank @Size(max = 20) String roleCode,
            @Size(max = 50) String memberName,
            String permissionJson
    ) {
    }

    public record OwnerTransferRequest(
            @NotNull Long targetMemberId
    ) {
    }

    public record LeaveRequest(
            Long successorMemberId
    ) {
    }

    public record MemberResponse(
            Long memberId,
            Long familyId,
            Long userId,
            String username,
            String nickname,
            String memberName,
            String roleCode,
            String permissionJson,
            Integer status,
            LocalDateTime joinedAt
    ) {
    }

    public record LeaveResponse(
            Long memberId,
            Long familyId,
            Long userId,
            String memberName,
            String roleCode,
            Integer memberStatus,
            Long ownerUserId,
            Integer familyStatus
    ) {
    }
}
