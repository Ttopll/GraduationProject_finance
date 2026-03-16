package com.example.finance.service;

import com.example.finance.dto.FamilyApiModels;
import com.example.finance.entity.Family;
import com.example.finance.entity.FamilyMember;
import com.example.finance.entity.SysUser;
import com.example.finance.repository.FamilyMemberRepository;
import com.example.finance.repository.FamilyRepository;
import com.example.finance.repository.SysUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FamilyServiceTests {

    @Mock
    private FamilyRepository familyRepository;

    @Mock
    private FamilyMemberRepository familyMemberRepository;

    @Mock
    private SysUserRepository sysUserRepository;

    @InjectMocks
    private FamilyService familyService;

    @Test
    void joinShouldCreateMemberFromInviteCode() {
        Long userId = 2L;
        SysUser user = new SysUser();
        user.setId(userId);
        user.setUsername("member01");
        user.setNickname("Member 01");

        Family family = new Family();
        family.setId(1L);
        family.setInviteCode("ABCD1234");
        family.setStatus(1);

        when(sysUserRepository.findById(userId)).thenReturn(Optional.of(user));
        when(familyRepository.findByInviteCode("ABCD1234")).thenReturn(Optional.of(family));
        when(familyMemberRepository.findByFamilyIdAndUserId(1L, userId)).thenReturn(Optional.empty());
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> {
            FamilyMember member = invocation.getArgument(0);
            member.setId(10L);
            return member;
        });

        FamilyMember member = familyService.join(userId, new FamilyApiModels.JoinRequest("abcd1234", null));

        assertEquals(10L, member.getId());
        assertEquals(1L, member.getFamilyId());
        assertEquals(userId, member.getUserId());
        assertEquals("MEMBER", member.getRoleCode());
        assertEquals("Member 01", member.getMemberName());
        assertEquals(1, member.getStatus());
    }

    @Test
    void updateMemberShouldPromoteNewOwnerAndDemotePreviousOwner() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(100L);

        FamilyMember oldOwner = new FamilyMember();
        oldOwner.setId(11L);
        oldOwner.setFamilyId(familyId);
        oldOwner.setUserId(100L);
        oldOwner.setRoleCode("OWNER");
        oldOwner.setStatus(1);

        FamilyMember targetMember = new FamilyMember();
        targetMember.setId(12L);
        targetMember.setFamilyId(familyId);
        targetMember.setUserId(200L);
        targetMember.setRoleCode("MEMBER");
        targetMember.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findById(12L)).thenReturn(Optional.of(targetMember));
        when(familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId)).thenReturn(List.of(oldOwner, targetMember));
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(familyRepository.save(any(Family.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FamilyMember updated = familyService.updateMember(
                familyId,
                12L,
                new FamilyApiModels.MemberUpdateRequest("OWNER", "New Owner", "{\"canEdit\":true}")
        );

        assertEquals("MEMBER", oldOwner.getRoleCode());
        assertEquals("OWNER", updated.getRoleCode());
        assertEquals("New Owner", updated.getMemberName());
        assertEquals("{\"canEdit\":true}", updated.getPermissionJson());
        assertEquals(200L, family.getOwnerUserId());
    }

    @Test
    void removeMemberShouldRejectCurrentOwner() {
        Long familyId = 1L;
        FamilyMember ownerMember = new FamilyMember();
        ownerMember.setId(11L);
        ownerMember.setFamilyId(familyId);
        ownerMember.setRoleCode("OWNER");
        ownerMember.setStatus(1);

        when(familyMemberRepository.findById(11L)).thenReturn(Optional.of(ownerMember));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> familyService.removeMember(familyId, 11L)
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("cannot remove current owner", exception.getReason());
    }

    @Test
    void transferOwnerShouldPromoteTargetMember() {
        Long familyId = 1L;
        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(100L);

        FamilyMember currentOwner = new FamilyMember();
        currentOwner.setId(11L);
        currentOwner.setFamilyId(familyId);
        currentOwner.setUserId(100L);
        currentOwner.setRoleCode("OWNER");
        currentOwner.setStatus(1);

        FamilyMember targetMember = new FamilyMember();
        targetMember.setId(12L);
        targetMember.setFamilyId(familyId);
        targetMember.setUserId(200L);
        targetMember.setRoleCode("MEMBER");
        targetMember.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findById(12L)).thenReturn(Optional.of(targetMember));
        when(familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId)).thenReturn(List.of(currentOwner, targetMember));
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(familyRepository.save(any(Family.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FamilyMember updated = familyService.transferOwner(
                familyId,
                new FamilyApiModels.OwnerTransferRequest(12L)
        );

        assertEquals("MEMBER", currentOwner.getRoleCode());
        assertEquals("OWNER", updated.getRoleCode());
        assertEquals(200L, family.getOwnerUserId());
    }

    @Test
    void leaveShouldDeactivateRegularMember() {
        Long familyId = 1L;
        Long userId = 200L;

        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(100L);
        family.setStatus(1);

        FamilyMember member = new FamilyMember();
        member.setId(12L);
        member.setFamilyId(familyId);
        member.setUserId(userId);
        member.setRoleCode("MEMBER");
        member.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, userId, 1)).thenReturn(Optional.of(member));
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FamilyService.LeaveResult result = familyService.leave(
                familyId,
                userId,
                new FamilyApiModels.LeaveRequest(null)
        );

        assertEquals(0, result.member().getStatus());
        assertEquals(1, result.family().getStatus());
        assertEquals(100L, result.family().getOwnerUserId());
    }

    @Test
    void leaveShouldRequireSuccessorWhenOwnerLeavesAndOtherMembersExist() {
        Long familyId = 1L;
        Long ownerUserId = 100L;

        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(ownerUserId);
        family.setStatus(1);

        FamilyMember owner = new FamilyMember();
        owner.setId(11L);
        owner.setFamilyId(familyId);
        owner.setUserId(ownerUserId);
        owner.setRoleCode("OWNER");
        owner.setStatus(1);

        FamilyMember member = new FamilyMember();
        member.setId(12L);
        member.setFamilyId(familyId);
        member.setUserId(200L);
        member.setRoleCode("MEMBER");
        member.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, ownerUserId, 1))
                .thenReturn(Optional.of(owner));
        when(familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId)).thenReturn(List.of(owner, member));

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class,
                () -> familyService.leave(familyId, ownerUserId, new FamilyApiModels.LeaveRequest(null))
        );

        assertEquals(HttpStatus.BAD_REQUEST, exception.getStatusCode());
        assertEquals("owner leave requires successorMemberId when other active members exist", exception.getReason());
    }

    @Test
    void leaveShouldTransferOwnerAndDeactivateLeavingOwner() {
        Long familyId = 1L;
        Long ownerUserId = 100L;

        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(ownerUserId);
        family.setStatus(1);

        FamilyMember owner = new FamilyMember();
        owner.setId(11L);
        owner.setFamilyId(familyId);
        owner.setUserId(ownerUserId);
        owner.setRoleCode("OWNER");
        owner.setStatus(1);

        FamilyMember successor = new FamilyMember();
        successor.setId(12L);
        successor.setFamilyId(familyId);
        successor.setUserId(200L);
        successor.setRoleCode("MEMBER");
        successor.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, ownerUserId, 1))
                .thenReturn(Optional.of(owner));
        when(familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId)).thenReturn(List.of(owner, successor));
        when(familyMemberRepository.findById(12L)).thenReturn(Optional.of(successor));
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(familyRepository.save(any(Family.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FamilyService.LeaveResult result = familyService.leave(
                familyId,
                ownerUserId,
                new FamilyApiModels.LeaveRequest(12L)
        );

        assertEquals(0, result.member().getStatus());
        assertEquals("MEMBER", result.member().getRoleCode());
        assertEquals("OWNER", successor.getRoleCode());
        assertEquals(200L, result.family().getOwnerUserId());
        assertEquals(1, result.family().getStatus());
    }

    @Test
    void leaveShouldDeactivateFamilyWhenLastOwnerLeaves() {
        Long familyId = 1L;
        Long ownerUserId = 100L;

        Family family = new Family();
        family.setId(familyId);
        family.setOwnerUserId(ownerUserId);
        family.setStatus(1);

        FamilyMember owner = new FamilyMember();
        owner.setId(11L);
        owner.setFamilyId(familyId);
        owner.setUserId(ownerUserId);
        owner.setRoleCode("OWNER");
        owner.setStatus(1);

        when(familyRepository.findById(familyId)).thenReturn(Optional.of(family));
        when(familyMemberRepository.findByFamilyIdAndUserIdAndStatus(familyId, ownerUserId, 1))
                .thenReturn(Optional.of(owner));
        when(familyMemberRepository.findByFamilyIdOrderByIdAsc(familyId)).thenReturn(List.of(owner));
        when(familyMemberRepository.save(any(FamilyMember.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(familyRepository.save(any(Family.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FamilyService.LeaveResult result = familyService.leave(
                familyId,
                ownerUserId,
                new FamilyApiModels.LeaveRequest(null)
        );

        assertEquals(0, result.member().getStatus());
        assertEquals("MEMBER", result.member().getRoleCode());
        assertEquals(0, result.family().getStatus());
        assertEquals(ownerUserId, result.family().getOwnerUserId());
    }
}
