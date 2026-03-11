package com.example.finance.security;

import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.Notification;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FamilyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class FamilyAccessService {

    private static final int ACTIVE_STATUS = 1;

    private final CurrentUserService currentUserService;
    private final FamilyMemberRepository familyMemberRepository;
    private final FamilyRepository familyRepository;

    public FamilyAccessService(
            CurrentUserService currentUserService,
            FamilyMemberRepository familyMemberRepository,
            FamilyRepository familyRepository
    ) {
        this.currentUserService = currentUserService;
        this.familyMemberRepository = familyMemberRepository;
        this.familyRepository = familyRepository;
    }

    public void requireCurrentUserMatches(Long userId) {
        AuthenticatedUser currentUser = currentUserService.requireCurrentUser();
        if (!currentUser.isAdmin() && !Objects.equals(currentUser.getUserId(), userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能代表其他用户执行该操作");
        }
    }

    public FamilyMember requireFamilyRead(Long familyId) {
        AuthenticatedUser currentUser = currentUserService.requireCurrentUser();
        if (currentUser.isAdmin()) {
            return findMembershipIfPresent(familyId, currentUser.getUserId());
        }
        return familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, currentUser.getUserId(), ACTIVE_STATUS)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "当前用户不属于该家庭"));
    }

    public FamilyMember requireFamilyOwner(Long familyId) {
        FamilyMember currentMember = requireFamilyRead(familyId);
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return currentMember;
        }
        if (currentMember == null || !"OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅家庭主账号可执行该操作");
        }
        return currentMember;
    }

    public Long resolveActorMemberId(Long familyId, Long requestedMemberId, boolean defaultToCurrentMember) {
        AuthenticatedUser currentUser = currentUserService.requireCurrentUser();
        FamilyMember currentMember = requireFamilyRead(familyId);
        if (requestedMemberId == null) {
            if (defaultToCurrentMember && currentMember != null) {
                return currentMember.getId();
            }
            return null;
        }

        FamilyMember targetMember = getActiveFamilyMember(familyId, requestedMemberId);
        if (!currentUser.isAdmin() && !Objects.equals(targetMember.getUserId(), currentUser.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能伪造其他家庭成员身份");
        }
        return targetMember.getId();
    }

    public Long resolveManagedMemberId(Long familyId, Long requestedMemberId, boolean defaultToCurrentMember) {
        AuthenticatedUser currentUser = currentUserService.requireCurrentUser();
        FamilyMember currentMember = requireFamilyRead(familyId);
        if (requestedMemberId == null) {
            if (defaultToCurrentMember && currentMember != null) {
                return currentMember.getId();
            }
            return null;
        }

        FamilyMember targetMember = getActiveFamilyMember(familyId, requestedMemberId);
        if (currentUser.isAdmin()) {
            return targetMember.getId();
        }
        if (Objects.equals(targetMember.getUserId(), currentUser.getUserId())) {
            return targetMember.getId();
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return targetMember.getId();
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能管理其他家庭成员数据");
    }

    public void requireNotificationAccess(Notification notification) {
        FamilyMember currentMember = requireFamilyRead(notification.getFamilyId());
        if (currentUserService.requireCurrentUser().isAdmin()) {
            return;
        }
        Long targetMemberId = notification.getTargetMemberId();
        if (targetMemberId == null) {
            return;
        }
        if (currentMember != null && Objects.equals(targetMemberId, currentMember.getId())) {
            return;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能访问其他成员的消息");
    }

    public void requireNotificationTargetReadable(Long familyId, Long targetMemberId) {
        if (targetMemberId == null) {
            return;
        }
        FamilyMember currentMember = requireFamilyRead(familyId);
        if (currentUserService.requireCurrentUser().isAdmin()) {
            getActiveFamilyMember(familyId, targetMemberId);
            return;
        }
        if (currentMember != null && Objects.equals(currentMember.getId(), targetMemberId)) {
            return;
        }
        if (currentMember != null && "OWNER".equalsIgnoreCase(currentMember.getRoleCode())) {
            getActiveFamilyMember(familyId, targetMemberId);
            return;
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "不能查看其他成员的消息");
    }

    public List<Family> listAccessibleFamilies() {
        AuthenticatedUser currentUser = currentUserService.requireCurrentUser();
        if (currentUser.isAdmin()) {
            return familyRepository.findAllByOrderByIdDesc();
        }

        List<FamilyMember> memberships = familyMemberRepository.findByUserIdAndStatusOrderByJoinedAtDescIdDesc(
                currentUser.getUserId(),
                ACTIVE_STATUS
        );
        Map<Long, Family> familyMap = new LinkedHashMap<>();
        for (Family family : familyRepository.findAllById(
                memberships.stream().map(FamilyMember::getFamilyId).distinct().toList()
        )) {
            familyMap.put(family.getId(), family);
        }

        List<Family> result = new ArrayList<>();
        for (FamilyMember membership : memberships) {
            Family family = familyMap.get(membership.getFamilyId());
            if (family != null) {
                result.add(family);
                familyMap.remove(membership.getFamilyId());
            }
        }
        return result;
    }

    private FamilyMember getActiveFamilyMember(Long familyId, Long memberId) {
        FamilyMember member = familyMemberRepository.findByIdAndStatus(memberId, ACTIVE_STATUS)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "家庭成员不存在"));
        if (!Objects.equals(member.getFamilyId(), familyId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "家庭成员不属于当前家庭");
        }
        return member;
    }

    private FamilyMember findMembershipIfPresent(Long familyId, Long userId) {
        return familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, userId, ACTIVE_STATUS)
                .orElse(null);
    }
}
