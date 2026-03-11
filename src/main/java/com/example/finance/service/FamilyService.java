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

@Service
public class FamilyService {

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
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "家庭创建人不存在"));

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
        family.setStatus(1);
        family.setRemark(normalize(request.remark()));
        Family savedFamily = familyRepository.save(family);

        if (!familyMemberRepository.existsByFamilyIdAndUserId(savedFamily.getId(), owner.getId())) {
            FamilyMember ownerMember = new FamilyMember();
            ownerMember.setFamilyId(savedFamily.getId());
            ownerMember.setUserId(owner.getId());
            ownerMember.setMemberName(owner.getNickname());
            ownerMember.setRoleCode("OWNER");
            ownerMember.setStatus(1);
            familyMemberRepository.save(ownerMember);
        }

        return savedFamily;
    }

    public List<Family> listAll() {
        return familyRepository.findAllByOrderByIdDesc();
    }

    public Family getById(Long familyId) {
        return familyRepository.findById(familyId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "家庭不存在"));
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

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
