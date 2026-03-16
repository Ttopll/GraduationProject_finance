package com.example.finance.controller;

import com.example.finance.dto.FamilyApiModels;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.security.CurrentUserService;
import com.example.finance.security.FamilyAccessService;
import com.example.finance.service.FamilyService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/families")
public class FamilyController {

    private final FamilyService familyService;
    private final FamilyAccessService familyAccessService;
    private final CurrentUserService currentUserService;

    public FamilyController(
            FamilyService familyService,
            FamilyAccessService familyAccessService,
            CurrentUserService currentUserService
    ) {
        this.familyService = familyService;
        this.familyAccessService = familyAccessService;
        this.currentUserService = currentUserService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FamilyApiModels.Response create(@Valid @RequestBody FamilyApiModels.CreateRequest request) {
        familyAccessService.requireCurrentUserMatches(request.ownerUserId());
        return toResponse(familyService.create(request));
    }

    @PostMapping("/join")
    @ResponseStatus(HttpStatus.CREATED)
    public FamilyApiModels.MemberResponse join(@Valid @RequestBody FamilyApiModels.JoinRequest request) {
        Long currentUserId = currentUserService.requireCurrentUser().getUserId();
        FamilyMember member = familyService.join(currentUserId, request);
        return familyService.listMembers(member.getFamilyId()).stream()
                .filter(item -> item.memberId().equals(member.getId()))
                .findFirst()
                .orElseThrow();
    }

    @GetMapping
    public List<FamilyApiModels.Response> list() {
        return familyAccessService.listAccessibleFamilies().stream()
                .map(FamilyController::toResponse)
                .toList();
    }

    @GetMapping("/{familyId}")
    public FamilyApiModels.Response getById(@PathVariable Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return toResponse(familyService.getById(familyId));
    }

    @GetMapping("/{familyId}/members")
    public List<FamilyApiModels.MemberResponse> listMembers(@PathVariable Long familyId) {
        familyAccessService.requireFamilyRead(familyId);
        return familyService.listMembers(familyId);
    }

    @PutMapping("/{familyId}/members/{memberId}")
    public FamilyApiModels.MemberResponse updateMember(
            @PathVariable Long familyId,
            @PathVariable Long memberId,
            @Valid @RequestBody FamilyApiModels.MemberUpdateRequest request
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        FamilyMember member = familyService.updateMember(familyId, memberId, request);
        return familyService.listMembers(familyId).stream()
                .filter(item -> item.memberId().equals(member.getId()))
                .findFirst()
                .orElseThrow();
    }

    @DeleteMapping("/{familyId}/members/{memberId}")
    public FamilyApiModels.MemberResponse removeMember(
            @PathVariable Long familyId,
            @PathVariable Long memberId
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        FamilyMember member = familyService.removeMember(familyId, memberId);
        return toInactiveMemberResponse(member);
    }

    @PostMapping("/{familyId}/transfer-owner")
    public FamilyApiModels.MemberResponse transferOwner(
            @PathVariable Long familyId,
            @Valid @RequestBody FamilyApiModels.OwnerTransferRequest request
    ) {
        familyAccessService.requireFamilyOwner(familyId);
        FamilyMember member = familyService.transferOwner(familyId, request);
        return familyService.listMembers(familyId).stream()
                .filter(item -> item.memberId().equals(member.getId()))
                .findFirst()
                .orElseThrow();
    }

    @PostMapping("/{familyId}/leave")
    public FamilyApiModels.LeaveResponse leave(
            @PathVariable Long familyId,
            @RequestBody(required = false) FamilyApiModels.LeaveRequest request
    ) {
        Long currentUserId = currentUserService.requireCurrentUser().getUserId();
        FamilyApiModels.LeaveRequest effectiveRequest = request == null
                ? new FamilyApiModels.LeaveRequest(null)
                : request;
        FamilyService.LeaveResult result = familyService.leave(familyId, currentUserId, effectiveRequest);
        return new FamilyApiModels.LeaveResponse(
                result.member().getId(),
                result.member().getFamilyId(),
                result.member().getUserId(),
                result.member().getMemberName(),
                result.member().getRoleCode(),
                result.member().getStatus(),
                result.family().getOwnerUserId(),
                result.family().getStatus()
        );
    }

    @PostMapping("/{familyId}/refresh-invite-code")
    public FamilyApiModels.Response refreshInviteCode(@PathVariable Long familyId) {
        familyAccessService.requireFamilyOwner(familyId);
        return toResponse(familyService.refreshInviteCode(familyId));
    }

    private static FamilyApiModels.Response toResponse(Family family) {
        return new FamilyApiModels.Response(
                family.getId(),
                family.getFamilyName(),
                family.getOwnerUserId(),
                family.getInviteCode(),
                family.getCurrencyCode(),
                family.getTimezone(),
                family.getStatus(),
                family.getRemark()
        );
    }

    private static FamilyApiModels.MemberResponse toInactiveMemberResponse(FamilyMember member) {
        return new FamilyApiModels.MemberResponse(
                member.getId(),
                member.getFamilyId(),
                member.getUserId(),
                null,
                null,
                member.getMemberName(),
                member.getRoleCode(),
                member.getPermissionJson(),
                member.getStatus(),
                member.getJoinedAt()
        );
    }
}
