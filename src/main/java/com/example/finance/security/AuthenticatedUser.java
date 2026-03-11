package com.example.finance.security;

import com.example.finance.entity.SysUser;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;
import java.util.Locale;

public class AuthenticatedUser implements UserDetails {

    private final Long userId;
    private final String username;
    private final String passwordHash;
    private final String userType;
    private final Integer status;
    private final List<GrantedAuthority> authorities;

    public AuthenticatedUser(
            Long userId,
            String username,
            String passwordHash,
            String userType,
            Integer status
    ) {
        this.userId = userId;
        this.username = username;
        this.passwordHash = passwordHash;
        this.userType = userType;
        this.status = status;
        this.authorities = List.of(new SimpleGrantedAuthority("ROLE_" + userType.toUpperCase(Locale.ROOT)));
    }

    public static AuthenticatedUser from(SysUser user) {
        return new AuthenticatedUser(
                user.getId(),
                user.getUsername(),
                user.getPasswordHash(),
                user.getUserType(),
                user.getStatus()
        );
    }

    public Long getUserId() {
        return userId;
    }

    public String getUserType() {
        return userType;
    }

    public boolean isAdmin() {
        return "ADMIN".equalsIgnoreCase(userType);
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return status != null && status == 1;
    }
}
