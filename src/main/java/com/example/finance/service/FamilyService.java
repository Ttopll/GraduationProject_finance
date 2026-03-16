package com.example.finance.service;

import com.example.finance.dto.FamilyApiModels;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.SysUser;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FamilyRepository;
import com.example.finance.repository.SysUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FamilyService {

    private static final int ACTIVE_STATUS = 1;
    private static final int INACTIVE_STATUS = 0;
    private static final List<String> SUPPORTED_MEMBER_ROLES = List.of("OWNER", "MEMBER");

    private final FamilyRepository familyRepository;
    private final FamilyMemberRepository familyMemberRepository;
    private final SysUserRepository sysUserRepository;

    public FamilyService(
            FamilyRepository familyRepository,
            FamilyMemberRepository familyMemberRepository,
            SysUserRepository sysUserRepository
    ) {
        this.familyRepository = familyRepository;
        this.familyMemberRepository = familyMemberRepository;
        this.sysUserRepository = sysUserRepository;
    }

    @Transactional
    public Family create(FamilyApiModels.CreateRequest request) {
        SysUser owner = sysUserRepository.findById(request.ownerUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "family owner not found"));

        Family family = new Family();
        family.setFamilyName(request.familyName().trim());
        family.setOwnerUserId(owner.getId());
        family.setInviteCode(generateInviteCode());
        family.setCurrencyCode(StringUtils.hasText(request.currencyCode())
                ? request.currencyCode().trim().toUpperCase(Locale.ROOT)
                : "CNY");
        family.setTimezone(StringUtils.hasText(request.timezone())
                ? request.timezone().trim()
                : "Asia/Shanghai");
        family.setStatus(ACTIVE_STATUS);
        family.setRemark(normalize(request.remark()));
        Family savedFamily = familyRepository.save(family);

        if (!familyMemberRepository.existsByFamilyIdAndUserId(savedFamily.getId(), owner.getId())) {
            FamilyMember ownerMember = new FamilyMember();
            ownerMember.setFamilyId(savedFamily.getId());
            ownerMember.setUserId(owner.getId());
            ownerMember.setMemberName(resolveMemberName(null, owner));
            ownerMember.setRoleCode("OWNER");
            ownerMember.setStatus(ACTIVE_STATUS);
            familyMemberRepository.save(ownerMember);
        }

        return savedFamily;
    }

    @Transactional
    public FamilyMember join(Long userId, FamilyApiModels.JoinRequest request) {
        SysUser user = sysUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "user not found"));
        Family family = familyRepository.findByInviteCode(request.inviteCode().trim().toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "invite code not found"));
        if (!Integer.valueOf(ACTIVE_STATUS).equals(family.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "family is not active");
        }

        FamilyMember existingMember = familyMemberRepository.findByFamilyIdAndUserId(family.getId(), user.getId())
                .orElse(null);
        if (existingMember != null && Integer.valueOf(ACTIVE_STATUS).equals(existingMember.getStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "user already joined this family");
        }

        FamilyMember member = existingMember == null ? new FamilyMember() : existingMember;
        member.setFamilyId(family.getId());
        member.setUserId(user.getId());
        member.setMemberName(resolveMemberName(request.memberName(), user));
        member.setRoleCode("MEMBER");
        member.setStatus(ACTIVE_STATUS);
        if (existingMember == null) {
            member.setPermissionJson(null);
        }
        return familyMemberRepository.save(member);
    }

    public List<Family> listAll() {
        return familyRepository.findAllByOrderByIdDesc();
    }

    public List<FamilyApiModels.MemberResponse> listMembers(Long familyId) {
        getById(familyId);
        List<FamilyMember> members = getActiveMembers(familyId);
        var userMap = sysUserRepository.findAllById(members.stream().map(FamilyMember::getUserId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(SysUser::getId, user -> user));

        return members.stream()
                .map(member -> {
                    SysUser user = userMap.get(member.getUserId());
                    return new FamilyApiModels.MemberResponse(
                            member.getId(),
                            member.getFamilyId(),
                            member.getUserId(),
                            user == null ? null : user.getUsername(),
                            user == null ? null : user.getNickname(),
                            member.getMemberName(),
                            member.getRoleCode(),
                            member.getPermissionJson(),
                            member.getStatus(),
                            member.getJoinedAt()
                    );
                })
                .toList();
    }

    @Transactional
    public FamilyMember updateMember(Long familyId, Long memberId, FamilyApiModels.MemberUpdateRequest request) {
        Family family = getById(familyId);
        FamilyMember member = getFamilyMember(familyId, memberId);
        if (!Integer.valueOf(ACTIVE_STATUS).equals(member.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "member is inactive");
        }

        String roleCode = request.roleCode().trim().toUpperCase(Locale.ROOT);
        if (!SUPPORTED_MEMBER_ROLES.contains(roleCode)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "roleCode only supports OWNER or MEMBER");
        }

        if ("OWNER".equals(roleCode)) {
            promoteOwner(family, member);
        } else if ("OWNER".equalsIgnoreCase(member.getRoleCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot demote current owner directly");
        }

        member.setRoleCode(roleCode);
        member.setMemberName(resolveUpdatedMemberName(request.memberName(), member.getMemberName()));
        member.setPermissionJson(normalize(request.permissionJson()));
        return familyMemberRepository.save(member);
    }

    @Transactional
    public FamilyMember transferOwner(Long familyId, FamilyApiModels.OwnerTransferRequest request) {
        Family family = getById(familyId);
        FamilyMember targetMember = getFamilyMember(familyId, request.targetMemberId());
        if (!Integer.valueOf(ACTIVE_STATUS).equals(targetMember.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "target member is inactive");
        }
        if ("OWNER".equalsIgnoreCase(targetMember.getRoleCode())
                && targetMember.getUserId().equals(family.getOwnerUserId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "target member is already owner");
        }
        promoteOwner(family, targetMember);
        return familyMemberRepository.save(targetMember);
    }

    @Transactional
    public FamilyMember removeMember(Long familyId, Long memberId) {
        FamilyMember member = getFamilyMember(familyId, memberId);
        if (!Integer.valueOf(ACTIVE_STATUS).equals(member.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "member is already inactive");
        }
        if ("OWNER".equalsIgnoreCase(member.getRoleCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "cannot remove current owner");
        }
        member.setStatus(INACTIVE_STATUS);
        return familyMemberRepository.save(member);
    }

    @Transactional
    public LeaveResult leave(Long familyId, Long userId, FamilyApiModels.LeaveRequest request) {
        Family family = getById(familyId);
        FamilyMember member = familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, userId, ACTIVE_STATUS)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "current user is not an active family member"));

        if (!"OWNER".equalsIgnoreCase(member.getRoleCode())) {
            member.setStatus(INACTIVE_STATUS);
            return new LeaveResult(family, familyMemberRepository.save(member));
        }

        List<FamilyMember> otherActiveMembers = getActiveMembers(familyId).stream()
                .filter(activeMember -> !activeMember.getId().equals(member.getId()))
                .toList();

        if (otherActiveMembers.isEmpty()) {
            member.setStatus(INACTIVE_STATUS);
            member.setRoleCode("MEMBER");
            family.setStatus(INACTIVE_STATUS);
            familyRepository.save(family);
            return new LeaveResult(family, familyMemberRepository.save(member));
        }

        Long successorMemberId = request == null ? null : request.successorMemberId();
        if (successorMemberId == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "owner leave requires successorMemberId when other active members exist"
            );
        }
        if (successorMemberId.equals(member.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "successor member cannot be current owner");
        }

        FamilyMember successor = getFamilyMember(familyId, successorMemberId);
        if (!Integer.valueOf(ACTIVE_STATUS).equals(successor.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "successor member is inactive");
        }

        promoteOwner(family, successor);
        familyMemberRepository.save(successor);

        member.setStatus(INACTIVE_STATUS);
        member.setRoleCode("MEMBER");
        return new LeaveResult(family, familyMemberRepository.save(member));
    }

    @Transactional
    public Family refreshInviteCode(Long familyId) {
        Family family = getById(familyId);
        family.setInviteCode(generateInviteCode());
        return familyRepository.save(family);
    }

    public Family getById(Long familyId) {
        return familyRepository.findById(familyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "family not found"));
    }

    public FamilyMember getFamilyMember(Long familyId, Long memberId) {
        FamilyMember member = familyMemberRepository.findById(memberId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "family member not found"));
        if (!familyId.equals(member.getFamilyId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "family member does not belong to family");
        }
        return member;
    }

    public record LeaveResult(Family family, FamilyMember member) {
    }

    private String generateInviteCode() {
        String inviteCode;
        do {
            inviteCode = UUID.randomUUID().toString()
                    .replace("-", "")
                    .substring(0, 8)
                    .toUpperCase(Locale.ROOT);
        } while (familyRepository.existsByInviteCode(inviteCode));
        return inviteCode;
    }

    private void promoteOwner(Family family, FamilyMember targetMember) {
        for (FamilyMember existingMember : familyMemberRepository.findByFamilyIdOrderByIdAsc(family.getId())) {
            if (Integer.valueOf(ACTIVE_STATUS).equals(existingMember.getStatus())
                    && "OWNER".equalsIgnoreCase(existingMember.getRoleCode())
                    && !existingMember.getId().equals(targetMember.getId())) {
                existingMember.setRoleCode("MEMBER");
                familyMemberRepository.save(existingMember);
            }
        }
        targetMember.setRoleCode("OWNER");
        family.setOwnerUserId(targetMember.getUserId());
        familyRepository.save(family);
    }

    private List<FamilyMember> getActiveMembers(Long familyId) {
        return familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId).stream()
                .filter(member -> Integer.valueOf(ACTIVE_STATUS).equals(member.getStatus()))
                .toList();
    }

    private String resolveMemberName(String requestedMemberName, SysUser user) {
        if (StringUtils.hasText(requestedMemberName)) {
            return requestedMemberName.trim();
        }
        if (StringUtils.hasText(user.getNickname())) {
            return user.getNickname().trim();
        }
        return user.getUsername();
    }

    private String resolveUpdatedMemberName(String requestedMemberName, String existingMemberName) {
        if (StringUtils.hasText(requestedMemberName)) {
            return requestedMemberName.trim();
        }
        return normalize(existingMemberName);
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
