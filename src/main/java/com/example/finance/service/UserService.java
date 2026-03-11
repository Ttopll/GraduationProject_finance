package com.example.finance.service;

import com.example.finance.dto.UserApiModels;
import com.example.finance.entity.SysUser;
import com.example.finance.repository.SysUserRepository;
import com.example.finance.util.PasswordHashUtil;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class UserService {

    private final SysUserRepository sysUserRepository;

    public UserService(SysUserRepository sysUserRepository) {
        this.sysUserRepository = sysUserRepository;
    }

    public SysUser create(UserApiModels.CreateRequest request) {
        String username = request.username().trim();
        if (sysUserRepository.existsByUsername(username)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "用户名已存在");
        }

        String phone = normalize(request.phone());
        if (StringUtils.hasText(phone) && sysUserRepository.existsByPhone(phone)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "手机号已存在");
        }

        String email = normalize(request.email());
        if (StringUtils.hasText(email) && sysUserRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "邮箱已存在");
        }

        SysUser user = new SysUser();
        user.setUsername(username);
        user.setPasswordHash(PasswordHashUtil.sha256(request.password()));
        user.setNickname(request.nickname().trim());
        user.setRealName(normalize(request.realName()));
        user.setPhone(phone);
        user.setEmail(email);
        String userType = StringUtils.hasText(request.userType())
                ? request.userType().trim().toUpperCase()
                : "USER";
        if (!"USER".equals(userType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "当前仅支持注册 USER 类型账户");
        }
        user.setUserType("USER");
        user.setStatus(1);
        return sysUserRepository.save(user);
    }

    public List<SysUser> listAll() {
        return sysUserRepository.findAllByOrderByIdDesc();
    }

    private String normalize(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
