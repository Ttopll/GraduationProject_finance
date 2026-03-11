package com.example.finance.security;

import com.example.finance.entity.SysUser;
import com.example.finance.repository.SysUserRepository;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class SysUserPrincipalService implements UserDetailsService {

    private final SysUserRepository sysUserRepository;

    public SysUserPrincipalService(SysUserRepository sysUserRepository) {
        this.sysUserRepository = sysUserRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        SysUser user = sysUserRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("用户不存在"));
        if (user.getStatus() == null || user.getStatus() != 1) {
            throw new DisabledException("用户已被禁用");
        }
        return AuthenticatedUser.from(user);
    }
}
