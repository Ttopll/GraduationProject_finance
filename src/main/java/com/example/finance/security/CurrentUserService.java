package com.example.finance.security;

import com.example.finance.entity.SysUser;
import com.example.finance.repository.SysUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class CurrentUserService {

    private final SysUserRepository sysUserRepository;

    public CurrentUserService(SysUserRepository sysUserRepository) {
        this.sysUserRepository = sysUserRepository;
    }

    public AuthenticatedUser requireCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication.getPrincipal() instanceof AuthenticatedUser authenticatedUser)) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
        }
        return authenticatedUser;
    }

    public SysUser requireCurrentUserEntity() {
        Long userId = requireCurrentUser().getUserId();
        return sysUserRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "当前登录用户不存在"));
    }

    public void requireAdmin() {
        if (!requireCurrentUser().isAdmin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "仅管理员可执行该操作");
        }
    }
}
